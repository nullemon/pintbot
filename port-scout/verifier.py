"""Bounded, credential-aware HTTP/RTSP checks using only Python's standard library.

An open port is not a camera identity. Video confirmation requires an observed
MJPEG frame or a nonempty RTP packet on the SDP's negotiated video track.
No media is retained and no alternate stream paths or passwords are guessed.
"""
from __future__ import annotations

import base64
import datetime as dt
import errno
import hashlib
import html
import ipaddress
import re
import secrets
import select
import socket
import ssl
import struct
import time
import urllib.parse

HEADER_LIMIT = 16_384
BODY_LIMIT = 65_536
POLL_SECONDS = 0.15
SSH_PORTS = frozenset({22})
SECRET_KEYS = {"user", "username", "password", "passwd", "pwd", "pass", "token", "access_token", "auth", "key"}


class ProbeError(Exception):
    """Expected malformed, unsupported, or unavailable service response."""


class ProbeCancelled(Exception):
    pass


def _clean(value: str, limit: int = 180) -> str:
    return re.sub(r"[\x00-\x1f\x7f]+", " ", str(value)).strip()[:limit]


def _public_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    address = parsed.hostname or ""
    authority = f"[{address}]" if ":" in address else address
    if parsed.port:
        authority += f":{parsed.port}"
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    query = [(key, "[redacted]" if key.lower() in SECRET_KEYS else value) for key, value in query]
    return urllib.parse.urlunsplit((parsed.scheme, authority, parsed.path or "/", urllib.parse.urlencode(query), ""))


def _make_url(host: str, port: int, scheme: str, path: str) -> str:
    # RFC 6874 encodes an IPv6 scope separator in a URL, not in the socket target.
    address = host.replace("%", "%25")
    address = f"[{address}]" if ":" in address else address
    return f"{scheme}://{address}:{port}{path}"


def _result(state: str, protocol: str, summary: str, url: str | None = None,
            evidence: list[str] | None = None, video: dict | None = None) -> dict:
    return {"state": state, "protocol": protocol, "summary": summary,
            "evidence": evidence or [], "url": _public_url(url) if url else None,
            "video": video, "authentication_required": state == "authentication_required"}


class Deadline:
    def __init__(self, seconds: float, cancel_event=None):
        self.until = time.monotonic() + seconds
        self.cancel_event = cancel_event

    def remaining(self) -> float:
        if self.cancel_event is not None and self.cancel_event.is_set():
            raise ProbeCancelled
        left = self.until - time.monotonic()
        if left <= 0:
            raise TimeoutError("Service check timed out")
        return left


class Connection:
    def __init__(self, host: str, port: int, deadline: Deadline,
                 tls: bool = False, allow_self_signed: bool = False):
        self.deadline = deadline
        self.buffer = bytearray()
        family = socket.AF_INET6 if ":" in host else socket.AF_INET
        self.socket = socket.socket(family, socket.SOCK_STREAM)
        self.socket.setblocking(False)
        try:
            if family == socket.AF_INET6:
                address, sep, scope = host.partition("%")
                scope_id = (int(scope) if scope.isdigit() else socket.if_nametoindex(scope)) if sep else 0
                target = (address, port, 0, scope_id)
            else:
                target = (host, port)
            status = self.socket.connect_ex(target)
            allowed = {0, errno.EINPROGRESS, errno.EWOULDBLOCK, errno.EALREADY,
                       getattr(errno, "WSAEWOULDBLOCK", 10035), 10036, 10037}
            if status not in allowed:
                raise OSError(status, "Connection could not be established")
            if status:
                self._wait(write=True)
                status = self.socket.getsockopt(socket.SOL_SOCKET, socket.SO_ERROR)
                if status:
                    raise OSError(status, "Connection could not be established")
            if tls:
                context = ssl.create_default_context()
                if allow_self_signed:
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                self.socket = context.wrap_socket(self.socket, server_hostname=host.split("%", 1)[0], do_handshake_on_connect=False)
                while True:
                    self.deadline.remaining()
                    try:
                        self.socket.do_handshake()
                        break
                    except ssl.SSLWantReadError:
                        self._wait()
                    except ssl.SSLWantWriteError:
                        self._wait(write=True)
        except BaseException:
            self.socket.close()
            raise

    def _wait(self, write: bool = False):
        while True:
            timeout = min(POLL_SECONDS, self.deadline.remaining())
            ready = select.select([] if write else [self.socket], [self.socket] if write else [], [self.socket], timeout)
            if ready[2]:
                raise OSError("Socket failed")
            if ready[1] if write else ready[0]:
                return

    def send(self, data: bytes):
        pending = memoryview(data)
        while pending:
            self.deadline.remaining()
            try:
                sent = self.socket.send(pending)
                if not sent:
                    raise ConnectionError("Connection closed while sending")
                pending = pending[sent:]
            except (BlockingIOError, ssl.SSLWantWriteError):
                self._wait(write=True)
            except ssl.SSLWantReadError:
                self._wait()

    def receive(self, limit: int = BODY_LIMIT) -> bytes:
        while True:
            self.deadline.remaining()
            try:
                return self.socket.recv(min(8192, limit))
            except (BlockingIOError, ssl.SSLWantReadError):
                self._wait()
            except ssl.SSLWantWriteError:
                self._wait(write=True)

    def read_header(self, protocol: str) -> tuple[int, dict[str, str]]:
        while True:
            marker = self.buffer.find(b"\r\n\r\n")
            width = 4
            if marker < 0:
                marker = self.buffer.find(b"\n\n")
                width = 2
            if marker >= 0:
                if marker > HEADER_LIMIT:
                    raise ProbeError("Response headers exceeded the size limit")
                header = bytes(self.buffer[:marker])
                del self.buffer[:marker + width]
                lines = header.decode("iso-8859-1").replace("\r", "").split("\n")
                pattern = r"HTTP/1\.[01] ([0-9]{3})(?: |$)" if protocol == "http" else r"RTSP/1\.0 ([0-9]{3})(?: |$)"
                match = re.match(pattern, lines[0])
                if not match:
                    raise ProbeError(f"No valid {protocol.upper()} response")
                headers: dict[str, str] = {}
                for line in lines[1:]:
                    if not line or ":" not in line:
                        continue
                    name, value = line.split(":", 1)
                    name = name.strip().lower()
                    if not re.fullmatch(r"[a-z0-9!#$%&'*+.^_`|~-]+", name):
                        continue
                    headers[name] = headers.get(name, "") + ("\n" if name in headers else "") + value.strip()
                return int(match[1]), headers
            if len(self.buffer) > HEADER_LIMIT:
                raise ProbeError("Response headers exceeded the size limit")
            received = self.receive(HEADER_LIMIT + 4 - len(self.buffer))
            if not received:
                raise ProbeError("Connection closed before a protocol response")
            self.buffer.extend(received)

    def read_exact(self, count: int) -> bytes:
        if not 0 <= count <= BODY_LIMIT:
            raise ProbeError("Response body exceeded the size limit")
        while len(self.buffer) < count:
            received = self.receive(count - len(self.buffer))
            if not received:
                raise ProbeError("Connection closed before the response body completed")
            self.buffer.extend(received)
        data = bytes(self.buffer[:count])
        del self.buffer[:count]
        return data

    def close(self):
        self.socket.close()


class Authentication:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.challenge: tuple[str, dict[str, str]] | None = None
        self.counter = 0

    def set_challenge(self, value: str) -> bool:
        digest = re.search(r"(?:^|\n)Digest\s+([^\n]+)", value, re.I)
        basic = re.search(r"(?:^|\n)Basic(?:\s|$)", value, re.I)
        if digest:
            params = {}
            for match in re.finditer(r'(\w+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^,\s]+))', digest[1]):
                params[match[1].lower()] = re.sub(r"\\(.)", r"\1", match[2] if match[2] is not None else match[3])
            algorithm = params.get("algorithm", "MD5").upper()
            qop = [v.strip().lower() for v in params.get("qop", "").split(",") if v.strip()]
            if not params.get("nonce") or algorithm not in {"MD5", "MD5-SESS", "SHA-256", "SHA-256-SESS"} or (qop and "auth" not in qop):
                return False
            self.challenge = ("digest", params)
        elif basic:
            self.challenge = ("basic", {})
        else:
            return False
        self.counter = 0
        return bool(self.username)

    def header(self, method: str, uri: str) -> str | None:
        if not self.challenge or not self.username:
            return None
        kind, params = self.challenge
        if kind == "basic":
            encoded = base64.b64encode(f"{self.username}:{self.password}".encode()).decode("ascii")
            return "Basic " + encoded
        algorithm = params.get("algorithm", "MD5").upper()
        hash_function = hashlib.sha256 if algorithm.startswith("SHA-256") else hashlib.md5
        def hashed(value: str) -> str:
            return hash_function(value.encode("utf-8")).hexdigest()
        self.counter += 1
        nonce_count = f"{self.counter:08x}"
        cnonce = secrets.token_hex(12)
        realm, nonce = params.get("realm", ""), params["nonce"]
        ha1 = hashed(f"{self.username}:{realm}:{self.password}")
        if algorithm.endswith("-SESS"):
            ha1 = hashed(f"{ha1}:{nonce}:{cnonce}")
        ha2 = hashed(f"{method}:{uri}")
        qop = "auth" if params.get("qop") else None
        response = hashed(f"{ha1}:{nonce}:{nonce_count}:{cnonce}:auth:{ha2}") if qop else hashed(f"{ha1}:{nonce}:{ha2}")
        def quoted(value: str) -> str:
            return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
        values = ["username=" + quoted(self.username), "realm=" + quoted(realm), "nonce=" + quoted(nonce),
                  "uri=" + quoted(uri), "response=" + quoted(response), "algorithm=" + algorithm]
        if params.get("opaque"):
            values.append("opaque=" + quoted(params["opaque"]))
        if qop:
            values += ["qop=auth", "nc=" + nonce_count, "cnonce=" + quoted(cnonce)]
        elif algorithm.endswith("-SESS"):
            values.append("cnonce=" + quoted(cnonce))
        return "Digest " + ", ".join(values)


def _chunk_body(data: bytes) -> bytes:
    output = bytearray()
    offset = 0
    while offset < len(data) and len(output) < BODY_LIMIT:
        end = data.find(b"\r\n", offset)
        if end < 0 or end - offset > 80:
            break
        try:
            size = int(data[offset:end].split(b";", 1)[0], 16)
        except ValueError:
            break
        if size < 0 or not size:
            break
        offset = end + 2
        available = min(size, len(data) - offset, BODY_LIMIT - len(output))
        output.extend(data[offset:offset + available])
        if available < size:
            break
        offset += size + 2
    return bytes(output)


def _jpeg_present(body: bytes) -> bool:
    """Require JPEG frame/scan structure, not just an image MIME label or magic."""
    start = body.find(b"\xff\xd8\xff")
    if start < 0:
        return False
    offset = start + 2
    frame = False
    while offset + 1 < len(body):
        if body[offset] != 0xff:
            return False
        while offset < len(body) and body[offset] == 0xff:
            offset += 1
        if offset >= len(body):
            return False
        marker = body[offset]
        offset += 1
        if marker in {0xd8, 0xd9, 0x00}:
            return False
        if marker == 0x01 or 0xd0 <= marker <= 0xd7:
            continue
        if offset + 2 > len(body):
            return False
        size = int.from_bytes(body[offset:offset + 2], "big")
        if size < 2 or offset + size > len(body):
            return False
        if marker in {0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf}:
            if size < 11:
                return False
            height = int.from_bytes(body[offset + 3:offset + 5], "big")
            width = int.from_bytes(body[offset + 5:offset + 7], "big")
            components = body[offset + 7]
            frame = bool(width and height and 1 <= components <= 4 and size >= 8 + components * 3)
        if marker == 0xda:
            scan = offset + size
            # JPEG entropy is not decoded; require frame metadata and real scan
            # bytes followed by EOI, with byte-stuffed/RST markers tolerated.
            eoi = body.find(b"\xff\xd9", scan)
            return frame and size >= 6 and eoi > scan
        offset += size
    return False


def _mjpeg_frame(body: bytes, content_type: str) -> bool:
    boundary = re.search(r'boundary\s*=\s*(?:"([^"\r\n]{1,200})"|([^;\s]{1,200}))', content_type, re.I)
    if not boundary:
        return False
    try:
        marker = b"--" + (boundary[1] or boundary[2]).encode("ascii")
    except UnicodeEncodeError:
        return False
    for part in body.split(marker)[1:]:
        part = part.lstrip(b"\r\n")
        end = part.find(b"\r\n\r\n")
        width = 4
        if end < 0:
            end = part.find(b"\n\n")
            width = 2
        if not 0 <= end <= 4096:
            continue
        if re.search(br"(?:^|\r?\n)content-type\s*:\s*image/jpeg(?:\s|;|$)", part[:end], re.I) and _jpeg_present(part[end + width:]):
            return True
    return False


def _probe_ssh(host: str, port: int, timeout: float, cancel_event) -> dict:
    connection = None
    try:
        connection = Connection(host, port, Deadline(timeout, cancel_event))
        banner = bytearray()
        while len(banner) < 255 and b"\n" not in banner:
            data = connection.receive(255 - len(banner))
            if not data:
                break
            banner.extend(data)
        line = bytes(banner).split(b"\n", 1)[0].rstrip(b"\r")
        if re.fullmatch(br"SSH-(?:2\.0|1\.99)-[\x21-\x7e]+(?: [\x20-\x7e]*)?", line):
            return _result("ssh_service", "ssh", "An SSH server banner was received. This is not video streaming.",
                           evidence=["SSH identification: " + _clean(line.decode("ascii"), 255),
                                     "No SSH login was attempted and no commands were sent."])
        return _result("unconfirmed", "ssh", "No valid SSH identification banner was received.")
    except ProbeCancelled:
        raise
    except (OSError, TimeoutError, ProbeError):
        return _result("unconfirmed", "ssh", "No valid SSH identification banner was received.")
    finally:
        if connection:
            connection.close()


def _http_body(connection: Connection, headers: dict) -> bytes:
    raw = bytearray(connection.buffer)
    connection.buffer.clear()
    length_text = headers.get("content-length", "")
    length = int(length_text) if length_text.isdigit() else None
    chunked = "chunked" in headers.get("transfer-encoding", "").lower()
    content_type = headers.get("content-type", "").lower()
    while len(raw) < BODY_LIMIT:
        body = _chunk_body(bytes(raw)) if chunked else bytes(raw)
        if _jpeg_present(body) or (body and (body.lstrip().startswith(b"#EXTM3U") or content_type.startswith("video/"))):
            break
        if body and "multipart/" not in content_type and (len(body) >= 4096 or (length is not None and len(body) >= length)):
            break
        if length == 0 or (length is not None and not chunked and len(raw) >= length):
            break
        try:
            data = connection.receive(BODY_LIMIT - len(raw))
        except TimeoutError:
            break
        if not data:
            break
        raw.extend(data)
    body = _chunk_body(bytes(raw)) if chunked else bytes(raw)
    return body[:BODY_LIMIT]


def _probe_http(host: str, port: int, scheme: str, path: str, username: str,
                password: str, timeout: float, allow_self_signed: bool, cancel_event) -> dict:
    url = _make_url(host, port, scheme, path)
    deadline = Deadline(timeout, cancel_event)
    auth = Authentication(username, password)
    for attempt in range(2):
        connection = None
        try:
            connection = Connection(host, port, deadline, scheme == "https", allow_self_signed)
            authority = urllib.parse.urlsplit(url).netloc
            headers = [f"GET {path} HTTP/1.1", "Host: " + authority,
                       "User-Agent: PortScout/1.1", "Accept: */*", "Connection: close"]
            authorization = auth.header("GET", path)
            if authorization:
                headers.append("Authorization: " + authorization)
            connection.send(("\r\n".join(headers) + "\r\n\r\n").encode("utf-8"))
            status, response_headers = connection.read_header("http")
            evidence = [f"{scheme.upper()} responded with status {status}."]
            if scheme == "https" and allow_self_signed:
                evidence.append("TLS certificate validation was explicitly disabled for this check.")
            if status == 401:
                if attempt == 0 and auth.set_challenge(response_headers.get("www-authenticate", "")):
                    continue
                return _result("authentication_required", scheme,
                               "The service requires camera credentials; video is not confirmed.", url, evidence)
            if status in {301, 302, 303, 307, 308}:
                evidence.append("The service returned a redirect. Redirects are not followed automatically.")
                return _result("web_service", scheme, "A web service responded with a redirect; video is not confirmed.", url, evidence)
            content_type = _clean(response_headers.get("content-type", ""))
            if content_type:
                evidence.append("Content-Type: " + content_type)
            if response_headers.get("server"):
                evidence.append("Server header: " + _clean(response_headers["server"]))
            body = _http_body(connection, response_headers) if 200 <= status < 300 else b""
            lower_type = content_type.lower()
            if 200 <= status < 300 and "multipart/x-mixed-replace" in lower_type and _mjpeg_frame(body, content_type):
                evidence.append("A JPEG frame was received inside a multipart MJPEG response; no media was saved.")
                return _result("video_confirmed", scheme, "MJPEG video data received.", url, evidence,
                               {"codec": "MJPEG", "packets": 1, "bytes": len(body)})
            if 200 <= status < 300 and _jpeg_present(body):
                evidence.append("JPEG image bytes were received. One snapshot does not establish live video.")
                return _result("snapshot_confirmed", scheme, "A camera/image snapshot was received; live video is not confirmed.", url, evidence)
            if 200 <= status < 300 and body.lstrip().startswith(b"#EXTM3U"):
                evidence.append("An HLS/M3U playlist was received. Media segments were not downloaded.")
                return _result("playlist_found", scheme, "A media playlist was found; video playback is not confirmed.", url, evidence)
            if 200 <= status < 300 and lower_type.startswith("video/") and body:
                evidence.append(f"Received {len(body):,} bytes labeled as video; no video decoder was used.")
                return _result("media_response", scheme, "The service returned media data; video decoding is not confirmed.", url, evidence)
            title = re.search(br"<title\b[^>]*>(.{0,512}?)</title\s*>", body, re.I | re.S)
            if title:
                evidence.append("Page title: " + _clean(html.unescape(re.sub(r"<[^>]+>", "", title[1].decode("utf-8", "replace")))))
            return _result("web_service", scheme,
                           "A web service responded; this does not confirm a camera or live video.", url, evidence)
        except ssl.SSLCertVerificationError:
            return _result("tls_untrusted", scheme,
                           "HTTPS is present, but its certificate is not trusted. Enable the self-signed certificate option only for your own camera.", url,
                           ["TLS certificate validation failed; no camera credentials were sent over this TLS connection."])
        except ProbeCancelled:
            raise
        except (OSError, TimeoutError, ValueError, ProbeError, ssl.SSLError):
            return _result("unconfirmed", scheme, "No readable HTTP response was received on this port.", url)
        finally:
            if connection:
                connection.close()
    return _result("authentication_required", scheme, "Camera credentials were not accepted.", url)


def _same_endpoint_url(reference: str, base: str, host: str, port: int) -> str:
    if not reference or reference == "*":
        return base
    if any(ord(char) < 32 or ord(char) == 127 for char in reference):
        raise ProbeError("Invalid RTSP track address")
    if reference.lower().startswith("rtsp://"):
        result = reference
    elif reference.startswith("/"):
        parsed = urllib.parse.urlsplit(base)
        result = urllib.parse.urlunsplit(("rtsp", parsed.netloc, reference, "", ""))
    else:
        # RTSP Content-Base is a presentation directory even if it omits '/'.
        parsed = urllib.parse.urlsplit(base)
        base_path = parsed.path if parsed.path.endswith("/") else parsed.path + "/"
        path = urllib.parse.urljoin(base_path, reference)
        result = urllib.parse.urlunsplit(("rtsp", parsed.netloc, path, "", ""))
    parsed = urllib.parse.urlsplit(result)
    normalized = (parsed.hostname or "").replace("%25", "%")
    if parsed.scheme.lower() != "rtsp" or parsed.username or parsed.password or normalized != host or (parsed.port or 554) != port:
        raise ProbeError("The RTSP track points to another endpoint; it was not contacted")
    return result


def _sdp_video(body: bytes) -> dict | None:
    lines = body.decode("utf-8", "replace").replace("\r", "").split("\n")
    current = None
    videos = []
    for line in lines:
        if line.startswith("m="):
            parts = line[2:].split()
            current = None
            if len(parts) >= 4 and parts[0].lower() == "video":
                payloads = {int(value) for value in parts[3:] if value.isdigit() and 0 <= int(value) <= 127}
                current = {"payloads": payloads, "codec": "Unspecified", "control": None}
                videos.append(current)
        elif current is not None and line.startswith("a=control:"):
            current["control"] = line[len("a=control:"):].strip()
        elif current is not None and line.startswith("a=rtpmap:"):
            match = re.match(r"a=rtpmap:([0-9]+)\s+([^/\s]+)", line)
            if match and int(match[1]) in current["payloads"] and current["codec"] == "Unspecified":
                current["codec"] = _clean(match[2], 40)
    return next((video for video in videos if video["payloads"]), None)


def _rtp_payload(packet: bytes, payloads: set[int]) -> int:
    if len(packet) < 12 or packet[0] >> 6 != 2 or packet[1] & 0x7f not in payloads:
        return 0
    # RTCP's second byte is an unmasked packet type, and is not RTP video.
    if 192 <= packet[1] <= 223:
        return 0
    header = 12 + (packet[0] & 15) * 4
    if len(packet) < header:
        return 0
    if packet[0] & 0x10:
        if len(packet) < header + 4:
            return 0
        extension_words = struct.unpack("!H", packet[header + 2:header + 4])[0]
        header += 4 + extension_words * 4
    padding = packet[-1] if packet[0] & 0x20 else 0
    if packet[0] & 0x20 and (not padding or padding > len(packet) - header):
        return 0
    return max(0, len(packet) - header - padding)


def _video_packets(connection: Connection, payloads: set[int], channel: int,
                   timeout: float, cancel_event) -> tuple[int, int]:
    connection.deadline = Deadline(timeout, cancel_event)
    seen = total = inspected = 0
    while inspected < 128:
        try:
            prefix = connection.read_exact(4)
            if prefix[0] != 0x24:
                # An unsolicited RTSP message is not evidence of media.
                return seen, total
            size = int.from_bytes(prefix[2:], "big")
            packet = connection.read_exact(size)
            inspected += 1
            payload_size = _rtp_payload(packet, payloads) if prefix[1] == channel else 0
            if payload_size:
                seen += 1
                total += payload_size
                # One actual video packet suffices to report observed RTP data.
                return seen, total
        except (TimeoutError, OSError, ProbeError):
            return seen, total
    return seen, total


def _probe_rtsp(host: str, port: int, path: str, username: str, password: str,
                timeout: float, cancel_event) -> dict:
    url = _make_url(host, port, "rtsp", path)
    connection = None
    session = None
    cseq = 0
    auth = Authentication(username, password)
    evidence = []
    base = url
    video = None

    def request(method: str, target: str, extra: dict | None = None):
        nonlocal cseq
        for attempt in range(2):
            cseq += 1
            headers = [f"{method} {target} RTSP/1.0", f"CSeq: {cseq}", "User-Agent: PortScout/1.1"]
            if session and method not in {"OPTIONS", "DESCRIBE", "SETUP"}:
                headers.append("Session: " + session)
            authorization = auth.header(method, target)
            if authorization:
                headers.append("Authorization: " + authorization)
            for key, value in (extra or {}).items():
                headers.append(key + ": " + value)
            connection.send(("\r\n".join(headers) + "\r\n\r\n").encode("utf-8"))
            status, response_headers = connection.read_header("rtsp")
            length_text = response_headers.get("content-length", "0")
            if not length_text.isdigit() or int(length_text) > BODY_LIMIT:
                raise ProbeError("RTSP response body exceeded the size limit")
            body = connection.read_exact(int(length_text))
            if status == 401 and attempt == 0 and auth.set_challenge(response_headers.get("www-authenticate", "")):
                continue
            return status, response_headers, body
        raise ProbeError("RTSP authentication could not complete")

    try:
        connection = Connection(host, port, Deadline(timeout, cancel_event))
        # DESCRIBE both identifies RTSP and asks for this exact stream's metadata.
        status, headers, body = request("DESCRIBE", url, {"Accept": "application/sdp"})
        evidence.append(f"RTSP DESCRIBE responded with status {status}.")
        if status == 401:
            return _result("authentication_required", "rtsp", "RTSP requires camera credentials; video is not confirmed.", url, evidence)
        if not 200 <= status < 300:
            if status == 404:
                evidence.append("This stream path was not found. Enter the stream path supplied by the camera or its app.")
            return _result("rtsp_service", "rtsp", "An RTSP service responded, but this stream path did not advertise video.", url, evidence)
        video = _sdp_video(body)
        if video is None:
            return _result("rtsp_service", "rtsp", "RTSP responded, but no video track was present in its stream description.", url, evidence)
        evidence.append(f"The SDP advertises a video track ({video['codec']}). This alone does not prove media is arriving.")
        descriptor = {"codec": video["codec"], "packets": 0, "bytes": 0}
        if not video.get("control"):
            return _result("video_advertised", "rtsp", "A video track is advertised, but no usable video track address was supplied.", url, evidence, descriptor)
        # Content-Base/Location are untrusted network data. Never follow another endpoint.
        if headers.get("content-base"):
            base = _same_endpoint_url(headers["content-base"], url, host, port)
        elif headers.get("content-location"):
            base = _same_endpoint_url(headers["content-location"], url, host, port)
        track = _same_endpoint_url(video["control"], base, host, port)
        status, headers, _body = request("SETUP", track, {"Transport": "RTP/AVP/TCP;unicast;interleaved=0-1"})
        evidence.append(f"RTSP SETUP responded with status {status}.")
        if status == 401:
            return _result("authentication_required", "rtsp", "Video is advertised, but stream setup requires accepted camera credentials.", url, evidence, descriptor)
        if not 200 <= status < 300:
            return _result("video_advertised", "rtsp", "Video is advertised, but RTP over TCP could not be started.", url, evidence, descriptor)
        session_header = headers.get("session", "").split(";", 1)[0].strip()
        if not session_header or not re.fullmatch(r"[A-Za-z0-9._~+/-]{1,256}", session_header):
            return _result("video_advertised", "rtsp", "Video is advertised, but the camera returned no valid RTSP session.", url, evidence, descriptor)
        session = session_header
        transport = headers.get("transport", "")
        channels = re.search(r"interleaved\s*=\s*([0-9]+)-([0-9]+)", transport, re.I)
        if "RTP/AVP/TCP" not in transport.upper() or not channels or not 0 <= int(channels[1]) <= 255:
            return _result("video_advertised", "rtsp", "Video is advertised, but the camera did not accept interleaved RTP over TCP.", url, evidence, descriptor)
        status, _headers, _body = request("PLAY", base, {"Range": "npt=0.000-"})
        evidence.append(f"RTSP PLAY responded with status {status}.")
        if status == 401:
            return _result("authentication_required", "rtsp", "Video playback requires accepted camera credentials.", url, evidence, descriptor)
        if not 200 <= status < 300:
            return _result("video_advertised", "rtsp", "Video is advertised, but playback was not accepted.", url, evidence, descriptor)
        packets, byte_count = _video_packets(connection, video["payloads"], int(channels[1]), timeout, cancel_event)
        descriptor.update(packets=packets, bytes=byte_count)
        if packets:
            evidence.append(f"Video RTP packets received: {packets}; payload bytes: {byte_count:,}; codec advertised: {video['codec']}.")
            evidence.append("This confirms video RTP data arrived. Frames were not decoded and no media was saved.")
            return _result("video_confirmed", "rtsp", "Video RTP data received from the negotiated video track.", url, evidence, descriptor)
        evidence.append("No valid video RTP packet arrived during the observation window.")
        return _result("video_advertised", "rtsp", "A video track is advertised, but incoming video data was not confirmed.", url, evidence, descriptor)
    except ProbeCancelled:
        raise
    except (OSError, TimeoutError, ValueError, ProbeError):
        if video is not None:
            evidence.append("The check could not finish receiving video data; no other endpoint was contacted.")
            return _result("video_advertised", "rtsp", "Video is advertised, but incoming video data could not be confirmed.", url, evidence,
                           {"codec": video["codec"], "packets": 0, "bytes": 0})
        if evidence:
            return _result("rtsp_service", "rtsp", "RTSP responded, but this stream could not be verified.", url, evidence)
        return _result("unconfirmed", "rtsp", "No readable RTSP response was received on this port.", url)
    finally:
        if connection:
            if session:
                # Best effort, without waiting for an additional server response.
                try:
                    connection.deadline = Deadline(0.2, None)
                    cseq += 1
                    lines = [f"TEARDOWN {base} RTSP/1.0", f"CSeq: {cseq}", "Session: " + session]
                    authorization = auth.header("TEARDOWN", base)
                    if authorization:
                        lines.append("Authorization: " + authorization)
                    connection.send(("\r\n".join(lines) + "\r\n\r\n").encode("utf-8"))
                except (OSError, TimeoutError, ProbeError):
                    pass
            connection.close()


def verify_service(host: str, port: int, mode: str = "auto", path: str = "/",
                   username: str = "", password: str = "", timeout_ms: int = 2500,
                   allow_self_signed: bool = False, cancel_event=None) -> dict:
    """Inspect one user-selected endpoint and path, without recording media."""
    started = time.monotonic()
    protocols = [mode]
    attempts = []
    try:
        ipaddress.ip_address(host)
        if mode not in {"auto", "http", "https", "rtsp"} or not 1 <= port <= 65535:
            raise ValueError("Invalid protocol or port")
        if not isinstance(path, str) or not path.startswith("/") or path.startswith("//") or len(path) > 2048 or any(ord(c) <= 32 or ord(c) == 127 for c in path):
            raise ValueError("Use a path beginning with / and without spaces or control characters")
        if any("\r" in value or "\n" in value for value in (username, password)):
            raise ValueError("Credentials cannot contain line breaks")
        if not isinstance(timeout_ms, int) or isinstance(timeout_ms, bool) or not 100 <= timeout_ms <= 5000:
            raise ValueError("Timeout must be between 100 and 5000 milliseconds")
        if cancel_event is not None and cancel_event.is_set():
            raise ProbeCancelled
        if mode == "auto":
            protocols = ["ssh", "http", "rtsp", "https"] if port in SSH_PORTS else ["rtsp", "http", "https"] if port in {554, 8554} else ["https", "http", "rtsp"] if port in {443, 8443} else ["http", "rtsp", "https"]
        best = _result("unconfirmed", "unknown", "No HTTP, HTTPS, or RTSP service could be confirmed. This may be a vendor-specific camera port; use the camera's app and documented stream path.")
        for protocol in protocols:
            if cancel_event is not None and cancel_event.is_set():
                raise ProbeCancelled
            if protocol == "ssh":
                result = _probe_ssh(host, port, timeout_ms / 1000, cancel_event)
            elif protocol == "rtsp":
                result = _probe_rtsp(host, port, path, username, password, timeout_ms / 1000, cancel_event)
            else:
                result = _probe_http(host, port, protocol, path, username, password, timeout_ms / 1000, allow_self_signed, cancel_event)
            attempts.append({key: result[key] for key in ("protocol", "state", "summary")})
            if result["state"] != "unconfirmed":
                best = result
                break
            if mode != "auto":
                best = result
        best["attempts"] = attempts
        result = best
    except ProbeCancelled:
        result = _result("cancelled", "unknown", "Service check cancelled. No media was saved.")
        result["attempts"] = attempts
    except (ValueError, TypeError):
        result = _result("error", "unknown", "The service-check input is invalid. Use a single IP, valid port, and a /stream/path.")
    except Exception:
        result = _result("error", "unknown", "The service check could not finish. Check the device address, protocol, and stream path.")
    result["checked_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    result["latency_ms"] = round((time.monotonic() - started) * 1000, 1)
    # Banners and paths are untrusted; remove any submitted credentials if echoed.
    def redacted(value, field=None):
        if isinstance(value, str):
            if field in {"state", "protocol", "checked_at", "url"}:
                return value
            for secret in (password, username):
                if secret:
                    value = re.sub(r"(?<![A-Za-z0-9])" + re.escape(secret) + r"(?![A-Za-z0-9])", "[redacted]", value)
            return value
        if isinstance(value, dict):
            return {key: redacted(item, key) for key, item in value.items()}
        if isinstance(value, list):
            return [redacted(item) for item in value]
        return value
    return redacted(result)
