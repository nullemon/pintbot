#!/usr/bin/env python3
"""Run Port Scout with Python 3.10+; no installation or administrator access."""
import sys

if sys.version_info < (3, 10):
    print("Port Scout needs Python 3.10 or newer. Get it from https://www.python.org/downloads/")
    raise SystemExit(1)

import argparse
import copy
import csv
import datetime as dt
import io
import ipaddress
import json
import secrets
import socket
import threading
import time
import urllib.parse
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from scanner import MAX_CHECKS, MAX_HOSTS, PRESETS, VERSION, ScanJob, make_plan

ROOT = Path(__file__).resolve().parent
MAX_VERIFICATIONS = 256
MAX_ACTIVE_VERIFICATIONS = 4


def verify_service(**kwargs):
    """Import on use so the scanner remains independent of verification work."""
    from verifier import verify_service as run_verification
    return run_verification(**kwargs)


def make_verification_request(data):
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object.")
    host = data.get("host", "")
    if not isinstance(host, str) or len(host) > 256 or any(ord(c) < 32 or ord(c) == 127 for c in host):
        raise ValueError("Enter one literal camera IP address.")
    try:
        address = ipaddress.ip_address(host.strip())
    except ValueError:
        raise ValueError("Enter one camera IP address, not a hostname, range, or full URL.") from None
    if address.is_multicast or address.is_unspecified:
        raise ValueError("Enter an individual camera IP address.")
    port = data.get("port")
    if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        raise ValueError("Port must be a whole number between 1 and 65535.")
    mode = data.get("mode", "auto")
    if not isinstance(mode, str) or mode not in ("auto", "http", "https", "rtsp"):
        raise ValueError("Choose Auto, HTTP, HTTPS, or RTSP.")
    path = data.get("path", "/")
    if not isinstance(path, str) or not 1 <= len(path) <= 2048 or not path.startswith("/") or path.startswith("//"):
        raise ValueError("Stream path must start with a single slash, such as /Streaming/Channels/101.")
    if any(ord(c) <= 32 or ord(c) == 127 for c in path) or "#" in path:
        raise ValueError("Stream path cannot contain spaces, control characters, or a URL fragment. Encode spaces as %20.")
    protected_query_keys = {"user", "username", "password", "passwd", "pwd", "pass", "token", "access_token", "authorization", "auth", "key"}
    if any(key.lower() in protected_query_keys for key, _ in urllib.parse.parse_qsl(urllib.parse.urlsplit(path).query)):
        raise ValueError("Put camera login details in the username and password fields, not the stream path.")
    credentials = {}
    for name in ("username", "password"):
        value = data.get(name, "")
        if not isinstance(value, str) or len(value) > 512 or any(ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValueError("Camera login fields must be text of at most 512 characters, without control characters.")
        credentials[name] = value
    timeout_ms = data.get("timeout_ms", 2500)
    if isinstance(timeout_ms, bool) or not isinstance(timeout_ms, int) or not 500 <= timeout_ms <= 5000:
        raise ValueError("Verification timeout must be a whole number between 500 and 5000 ms.")
    allow_self_signed = data.get("allow_self_signed", False)
    if not isinstance(allow_self_signed, bool):
        raise ValueError("allow_self_signed must be true or false.")
    return {"host": str(address), "port": port, "mode": mode, "path": path,
            "timeout_ms": timeout_ms, "allow_self_signed": allow_self_signed, **credentials}


class VerificationJob:
    def __init__(self, request):
        self.id = uuid.uuid4().hex
        self.host, self.port = request["host"], request["port"]
        self.created_at = dt.datetime.now(dt.timezone.utc).isoformat()
        self.started = time.monotonic()
        self.ended = None
        self.status = "running"
        self.result = None
        self.error = None
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self._request = request.copy()
        self.thread = threading.Thread(target=self._run, name="port-scout-verify", daemon=True)

    def start(self):
        self.thread.start()

    def cancel(self):
        self.stop_event.set()

    def snapshot(self):
        with self.lock:
            return {"id": self.id, "host": self.host, "port": self.port,
                    "status": self.status, "created_at": self.created_at,
                    "elapsed": round(max(0, (self.ended or time.monotonic()) - self.started), 2),
                    "cancel_requested": self.stop_event.is_set(),
                    "result": copy.deepcopy(self.result), "error": self.error}

    def _run(self):
        try:
            result = verify_service(**self._request, cancel_event=self.stop_event)
            with self.lock:
                self.result = result
                self.status = "cancelled" if self.stop_event.is_set() or result.get("state") == "cancelled" else "completed"
        except Exception as exc:
            with self.lock:
                self.status = "cancelled" if self.stop_event.is_set() else "failed"
                self.error = f"Verification could not finish ({type(exc).__name__}). Check the device address and protocol, then retry."
        finally:
            self._request.clear()  # Credentials are never included in snapshots or exports.
            with self.lock:
                self.ended = time.monotonic()


class ScoutServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 16
    allow_reuse_address = True

    def __init__(self, address):
        super().__init__(address, ScoutHandler)
        self.token = secrets.token_urlsafe(32)
        self.job = None
        self.job_lock = threading.Lock()
        self.verifications = {}
        port = self.server_address[1]
        self.allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if port == 80:
            self.allowed_hosts.update({"127.0.0.1", "localhost"})
        self.allowed_origins = {f"http://{host}" for host in self.allowed_hosts}


class ScoutHandler(BaseHTTPRequestHandler):
    server_version = "PortScout/" + VERSION
    sys_version = ""

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *_args):
        pass

    def _send(self, status, body, content_type="application/json; charset=utf-8", filename=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=True).encode()
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, socket.timeout):
            pass

    def _error(self, status, message):
        self._send(status, {"error": message})

    def _check_host(self):
        if self.headers.get("Host", "") not in self.server.allowed_hosts:
            self._error(403, "Open this app using the localhost URL printed in your terminal.")
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin not in self.server.allowed_origins:
            self._error(403, "Cross-origin requests are not accepted.")
            return False
        return True

    def _check_api(self):
        if not self._check_host():
            return False
        if not secrets.compare_digest(self.headers.get("X-Scout-Token", "").encode("utf-8"), self.server.token.encode("utf-8")):
            self._error(403, "Session expired. Refresh the app page and try again.")
            return False
        return True

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path)
        if path.path.startswith("/api/"):
            if self._check_api():
                self._get_api(path)
            return
        if not self._check_host():
            return
        files = {"/": ("index.html", "text/html; charset=utf-8"),
                 "/index.html": ("index.html", "text/html; charset=utf-8"),
                 "/styles.css": ("styles.css", "text/css; charset=utf-8"),
                 "/app.js": ("app.js", "text/javascript; charset=utf-8")}
        if path.path == "/favicon.ico":
            self._send(204, b"", "image/x-icon")
        elif path.path in files:
            filename, mime = files[path.path]
            try:
                content = (ROOT / "web" / filename).read_text(encoding="utf-8")
            except OSError:
                self._error(500, "App files are missing. Extract the full Port Scout ZIP, then launch again.")
                return
            if filename == "index.html":
                content = content.replace("__SESSION_TOKEN__", self.server.token)
            self._send(200, content, mime)
        else:
            self._error(404, "Page not found.")

    def _get_api(self, path):
        with self.server.job_lock:
            job = self.server.job
            verifications = [v.snapshot() for v in self.server.verifications.values()]
        if path.path == "/api/config":
            self._send(200, {"version": VERSION, "presets": PRESETS,
                             "limits": {"max_hosts": MAX_HOSTS, "max_checks": MAX_CHECKS},
                             "active_job": job.snapshot() if job else None,
                             "verifications": verifications})
        elif path.path == "/api/scan":
            self._send(200, {"job": job.snapshot() if job else None})
        elif path.path == "/api/verifications":
            self._send(200, {"verifications": verifications})
        elif path.path == "/api/verify":
            query = urllib.parse.parse_qs(path.query)
            requested_id = query.get("id", [""])[0]
            verification = next((v for v in verifications if v["id"] == requested_id), None)
            if verification is None:
                self._error(404, "That service check is no longer available.")
            else:
                self._send(200, {"verification": verification})
        elif path.path == "/api/export":
            query = urllib.parse.parse_qs(path.query)
            if not job or query.get("id", [""])[0] != job.id:
                self._error(404, "That scan is no longer available.")
                return
            report = job.snapshot()
            report["verifications"] = verifications
            report["notes"] = ["TCP connect scan only. No UDP tested.",
                               "Service names in port scan results are port-based hints. Separate service checks include their evidence.",
                               "Video advertised in SDP is distinct from video packets observed; no video is decoded or recorded.",
                               "A timeout does not establish that a port is closed."]
            fmt = query.get("format", ["json"])[0]
            filename = "port-scout-" + job.id[:8]
            if fmt == "json":
                self._send(200, json.dumps(report, indent=2), filename=filename + ".json")
            elif fmt == "csv":
                stream = io.StringIO(newline="")
                fields = ["host", "port", "protocol", "service", "latency_ms", "verification_state", "verified_protocol", "verification_summary"]
                writer = csv.DictWriter(stream, fieldnames=fields)
                writer.writeheader()
                latest = {(v["host"], v["port"]): v for v in verifications if v["result"] is not None}
                for row in report["results"]:
                    verification = latest.get((row["host"], row["port"]), {}).get("result", {})
                    summary = verification.get("summary", "")
                    if summary.lstrip().startswith(("=", "+", "-", "@")):
                        summary = "'" + summary
                    writer.writerow({**row, "verification_state": verification.get("state", ""),
                                     "verified_protocol": verification.get("protocol", ""),
                                     "verification_summary": summary})
                self._send(200, stream.getvalue(), "text/csv; charset=utf-8", filename + ".csv")
            else:
                self._error(400, "Export format must be csv or json.")
        else:
            self._error(404, "API route not found.")

    def do_POST(self):
        if not self._check_api():
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            self._error(415, "Send application/json.")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 200_000 or self.headers.get("Transfer-Encoding"):
                raise ValueError("Request body must be between 1 and 200,000 bytes.")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("Expected a JSON object.")
            path = urllib.parse.urlsplit(self.path).path
            if path == "/api/preview":
                self._send(200, make_plan(body).preview())
            elif path == "/api/scan":
                plan = make_plan(body)
                with self.server.job_lock:
                    if any(v.snapshot()["status"] == "running" for v in self.server.verifications.values()):
                        self._error(409, "A service check is running. Stop it or wait before starting a new port scan.")
                        return
                    if self.server.job and self.server.job.snapshot()["status"] in ("running", "cancelling"):
                        self._error(409, "A scan is already running. Stop it before starting another.")
                        return
                    job = ScanJob(plan)
                    self.server.job = job
                    self.server.verifications.clear()
                    job.start()
                self._send(201, job.snapshot())
            elif path == "/api/cancel":
                with self.server.job_lock:
                    job = self.server.job
                    if not job or body.get("id") != job.id:
                        self._error(404, "That scan is no longer available.")
                        return
                    job.cancel()
                self._send(200, job.snapshot())
            elif path == "/api/verify":
                request = make_verification_request(body)
                with self.server.job_lock:
                    active = [v for v in self.server.verifications.values() if v.snapshot()["status"] == "running"]
                    if len(active) >= MAX_ACTIVE_VERIFICATIONS:
                        self._error(409, "Four service checks are already running. Wait for one to finish or stop it.")
                        return
                    if len(self.server.verifications) >= MAX_VERIFICATIONS:
                        oldest = next(key for key, value in self.server.verifications.items() if value.snapshot()["status"] != "running")
                        del self.server.verifications[oldest]
                    verification = VerificationJob(request)
                    self.server.verifications[verification.id] = verification
                    verification.start()
                self._send(201, {"verification": verification.snapshot()})
            elif path == "/api/verify/cancel":
                if not isinstance(body.get("id"), str):
                    raise ValueError("Service check ID must be text.")
                with self.server.job_lock:
                    verification = self.server.verifications.get(body.get("id"))
                    if verification is None:
                        self._error(404, "That service check is no longer available.")
                        return
                    verification.cancel()
                self._send(200, {"verification": verification.snapshot()})
            else:
                self._error(404, "API route not found.")
        except (ValueError, UnicodeError) as exc:
            self._error(400, str(exc))
        except (socket.timeout, ConnectionError):
            self._error(408, "Request timed out. Try again.")


def main():
    parser = argparse.ArgumentParser(description="Port Scout — local TCP port scanner for your home cameras.")
    parser.add_argument("--port", type=int, default=8765, help="Local interface port (default 8765; 0 chooses an available port)")
    parser.add_argument("--no-browser", action="store_true", help="Print the URL without opening a browser")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    try:
        server = ScoutServer(("127.0.0.1", args.port))
    except OSError as exc:
        print(f"Could not open local port {args.port}: {exc}\nTry: python app.py --port 0", file=sys.stderr)
        return 1
    url = f"http://127.0.0.1:{server.server_address[1]}"
    print(f"\n  PORT SCOUT {VERSION}\n  Open {url}\n  Keep this terminal open. Press Ctrl+C to stop.\n", flush=True)
    if not args.no_browser:
        def open_browser():
            try:
                webbrowser.open(url)
            except Exception:
                pass  # The printed URL also works when no desktop browser is available.
        threading.Timer(0.4, open_browser).start()
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\nStopping Port Scout.")
    finally:
        with server.job_lock:
            job = server.job
            verifications = list(server.verifications.values())
        for verification in verifications:
            verification.cancel()
        if job:
            job.cancel()
            job.thread.join(timeout=2)
        for verification in verifications:
            verification.thread.join(timeout=2)
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
