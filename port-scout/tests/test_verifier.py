"""Protocol fixtures verify evidence comes from media bytes, not port numbers."""
import base64
import hashlib
import json
import re
import socket
import socketserver
import struct
import threading
import time
import unittest
from unittest.mock import patch

from verifier import verify_service


# A complete 2x2 JPEG; embedded so tests need no image library.
JPEG = base64.b64decode(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIs'
    'IxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy'
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAA'
    'AAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAk'
    'M2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKT'
    'lJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QA'
    'HwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdh'
    'cRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hp'
    'anN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk'
    '5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDm6KKKR8If/9k='
)


def read_request(stream):
    first = stream.readline(8193)
    if not first:
        return None
    fields = first.decode("latin-1").strip().split(" ", 2)
    if len(fields) != 3:
        raise ValueError("Malformed fixture request")
    headers = {}
    for _ in range(100):
        line = stream.readline(8193)
        if line in (b"\r\n", b"\n", b""):
            break
        key, value = line.decode("latin-1").split(":", 1)
        headers[key.lower()] = value.strip()
    return fields[0], fields[1], headers


class ProtocolFixture(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    block_on_close = False

    def __init__(self, callback, host="127.0.0.1"):
        super().__init__((host, 0), FixtureHandler)
        self.callback = callback
        self.requests = []
        self.received = threading.Event()
        self.release = threading.Event()
        self.errors = []
        self.thread = threading.Thread(target=self.serve_forever,
                                       kwargs={"poll_interval": 0.01}, daemon=True)

    @property
    def port(self):
        return self.server_address[1]

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.release.set()
        self.shutdown()
        self.server_close()
        self.thread.join(1)


class FixtureHandler(socketserver.StreamRequestHandler):
    def handle(self):
        self.request.settimeout(3)
        try:
            while True:
                parsed = read_request(self.rfile)
                if parsed is None:
                    return
                method, uri, headers = parsed
                self.server.requests.append((method, uri, headers))
                self.server.received.set()
                if not self.server.callback(self, method, uri, headers):
                    return
        except (OSError, ValueError):
            pass  # A bounded verifier may close before a fixture has finished writing.

    def response(self, protocol, code=200, headers=None, body=b""):
        phrases = {200: "OK", 302: "Found", 401: "Unauthorized", 461: "Unsupported Transport"}
        pairs = dict(headers or {})
        pairs.setdefault("Content-Length", str(len(body)))
        lines = [f"{protocol} {code} {phrases.get(code, 'Test')}\r\n"]
        lines += [f"{key}: {value}\r\n" for key, value in pairs.items()]
        self.wfile.write("".join(lines).encode("ascii") + b"\r\n" + body)
        self.wfile.flush()


def http_response(body, content_type="text/html", status=200, extra_headers=None):
    def callback(handler, method, uri, headers):
        handler.response("HTTP/1.1", status,
                         {"Content-Type": content_type, **(extra_headers or {})}, body)
        return False
    return callback


def rtsp_fixture(behavior="video", external_control=None):
    def callback(handler, method, uri, headers):
        response_headers = {"CSeq": headers.get("cseq", "1")}
        if behavior == "auth":
            handler.response("RTSP/1.0", 401, {**response_headers,
                             "WWW-Authenticate": 'Basic realm="local-camera"'})
            return True
        if method == "OPTIONS":
            handler.response("RTSP/1.0", headers={**response_headers,
                             "Public": "OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN"})
        elif method == "DESCRIBE":
            base = f"rtsp://127.0.0.1:{handler.server.port}/stream/"
            control = external_control or "trackID=1"
            sdp = ("v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=Local fixture\r\n"
                   "t=0 0\r\na=control:*\r\nm=video 0 RTP/AVP 96\r\n"
                   "a=rtpmap:96 H264/90000\r\na=control:" + control + "\r\n").encode()
            handler.response("RTSP/1.0", headers={**response_headers,
                             "Content-Type": "application/sdp", "Content-Base": base}, body=sdp)
        elif method == "SETUP":
            if behavior == "advertised":
                handler.response("RTSP/1.0", 461, response_headers)
            else:
                handler.response("RTSP/1.0", headers={**response_headers, "Session": "test-session",
                                 "Transport": "RTP/AVP/TCP;unicast;interleaved=0-1"})
        elif method == "PLAY":
            handler.response("RTSP/1.0", headers={**response_headers, "Session": "test-session"})
            if behavior == "rtcp":
                channel, packet = 1, struct.pack("!BBH", 0x80, 200, 6) + b"\x00" * 24
            else:
                payload_type = 97 if behavior == "wrong_pt" else 96
                channel = 0
                packet = struct.pack("!BBHII", 0x80, 0x80 | payload_type, 1, 90000, 1234)
                packet += b"\x65\x88\x84\x21" if behavior != "empty_payload" else b""
            handler.wfile.write(b"$" + bytes([channel]) + struct.pack("!H", len(packet)) + packet)
            handler.wfile.flush()
        elif method == "TEARDOWN":
            handler.response("RTSP/1.0", headers=response_headers)
            return False
        else:
            handler.response("RTSP/1.0", headers=response_headers)
        return True
    return callback


class HttpVerificationTests(unittest.TestCase):
    def verify(self, fixture, **kwargs):
        return verify_service("127.0.0.1", fixture.port, mode="http", timeout_ms=700, **kwargs)

    def test_html_is_web_service_without_video_claim(self):
        with ProtocolFixture(http_response(b"<html><title>Camera login</title></html>")) as fixture:
            result = self.verify(fixture)
        self.assertEqual(result["state"], "web_service")
        self.assertIsNone(result.get("video"))

    def test_actual_jpeg_is_snapshot_separate_from_video(self):
        with ProtocolFixture(http_response(JPEG, "image/jpeg")) as fixture:
            result = self.verify(fixture, path="/snapshot.jpg")
        self.assertEqual(result["state"], "snapshot_confirmed")

    def test_multipart_actual_frame_confirms_mjpeg(self):
        body = (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                + str(len(JPEG)).encode() + b"\r\n\r\n" + JPEG + b"\r\n--frame--\r\n")
        with ProtocolFixture(http_response(body, "multipart/x-mixed-replace; boundary=frame")) as fixture:
            result = self.verify(fixture, path="/live.mjpg")
        self.assertEqual(result["state"], "video_confirmed")

    def test_secret_matching_machine_state_does_not_corrupt_classification(self):
        body = (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + JPEG + b"\r\n--frame--\r\n")
        with ProtocolFixture(http_response(body, "multipart/x-mixed-replace; boundary=frame")) as fixture:
            result = self.verify(fixture, username="http", password="video")
        self.assertEqual(result["state"], "video_confirmed")
        self.assertEqual(result["protocol"], "http")
        self.assertTrue(result["url"].startswith("http://"))

    def test_content_type_alone_never_confirms_media(self):
        for content_type in ["image/jpeg", "multipart/x-mixed-replace; boundary=frame", "video/mp4"]:
            with self.subTest(content_type=content_type):
                with ProtocolFixture(http_response(b"not actual media", content_type)) as fixture:
                    result = self.verify(fixture)
                self.assertNotIn(result["state"], ("snapshot_confirmed", "video_confirmed"))

    def test_credentials_only_follow_challenge_and_never_enter_results(self):
        username, password = "probe-user-751", "never-output-751"
        expected = "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()

        def authenticated(handler, method, uri, headers):
            if headers.get("authorization") != expected:
                handler.response("HTTP/1.1", 401, {"WWW-Authenticate": 'Basic realm="fixture"'})
            else:
                handler.response("HTTP/1.1", headers={"Content-Type": "text/html"}, body=b"<html>OK</html>")
            return False

        with ProtocolFixture(authenticated) as fixture:
            result = self.verify(fixture, username=username, password=password, path="/custom?view=main")
        self.assertNotIn("authorization", fixture.requests[0][2])
        self.assertTrue(any(req[2].get("authorization") == expected for req in fixture.requests[1:]))
        self.assertTrue(all(req[1] == "/custom?view=main" for req in fixture.requests))
        serialized = json.dumps(result)
        self.assertNotIn(username, serialized)
        self.assertNotIn(password, serialized)
        self.assertNotIn(expected, serialized)

    def test_redirect_to_different_ip_is_not_followed(self):
        with ProtocolFixture(http_response(JPEG, "image/jpeg"), host="127.0.0.2") as other:
            redirect = f"http://127.0.0.2:{other.port}/snapshot.jpg"
            with ProtocolFixture(http_response(b"", status=302,
                                              extra_headers={"Location": redirect})) as fixture:
                result = self.verify(fixture)
        self.assertEqual(other.requests, [])
        self.assertNotIn(result["state"], ("snapshot_confirmed", "video_confirmed"))

    def test_digest_authentication_matches_challenge_and_request_uri(self):
        username, password = "digest-user-84", "digest-pass-84"
        realm, nonce = "PortScoutFixture", "known-fixture-nonce"
        valid = []

        def md5(value):
            return hashlib.md5(value.encode()).hexdigest()

        def digest_server(handler, method, uri, headers):
            authorization = headers.get("authorization", "")
            params = {key: quoted or unquoted for key, quoted, unquoted in
                      re.findall(r'(\w+)\s*=\s*(?:"([^"\\]*)"|([^,\s]+))', authorization)}
            if authorization.startswith("Digest "):
                expected = md5(":".join([md5(f"{username}:{realm}:{password}"), nonce,
                                          params.get("nc", ""), params.get("cnonce", ""),
                                          "auth", md5(f"{method}:{uri}")]))
                accepted = (params.get("username") == username and params.get("uri") == uri and
                            params.get("response") == expected and params.get("qop") == "auth")
                valid.append(accepted)
                if accepted:
                    handler.response("HTTP/1.1", headers={"Content-Type": "text/html"}, body=b"<html>OK</html>")
                    return False
            handler.response("HTTP/1.1", 401, {"WWW-Authenticate":
                             f'Digest realm="{realm}", nonce="{nonce}", algorithm=MD5, qop="auth"'})
            return False

        with ProtocolFixture(digest_server) as fixture:
            result = self.verify(fixture, username=username, password=password, path="/stream?view=main")
        self.assertEqual(result["state"], "web_service")
        self.assertEqual(valid, [True])
        self.assertNotIn(password, json.dumps(result))

    def test_large_response_is_bounded(self):
        def large_body(handler, method, uri, headers):
            handler.wfile.write(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n"
                                b"Content-Length: 8000000\r\n\r\n" + b"x" * 80_000)
            handler.wfile.flush()
            handler.server.release.wait(3)
            return False

        with ProtocolFixture(large_body) as fixture:
            started = time.monotonic()
            result = verify_service("127.0.0.1", fixture.port, mode="http", timeout_ms=2500)
            elapsed = time.monotonic() - started
        self.assertLess(elapsed, 1.5, "Verifier read beyond its bounded body prefix")
        self.assertNotEqual(result["state"], "video_confirmed")

    def test_inflight_cancellation_is_prompt(self):
        def silent_server(handler, method, uri, headers):
            handler.server.release.wait(3)
            return False

        cancel = threading.Event()
        results = []
        with ProtocolFixture(silent_server) as fixture:
            worker = threading.Thread(target=lambda: results.append(verify_service(
                "127.0.0.1", fixture.port, mode="http", timeout_ms=5000, cancel_event=cancel)), daemon=True)
            worker.start()
            self.assertTrue(fixture.received.wait(1))
            cancel.set()
            worker.join(1)
            self.assertFalse(worker.is_alive(), "Cancellation waited for full socket timeout")
        self.assertEqual(results[0]["state"], "cancelled")


class RtspVerificationTests(unittest.TestCase):
    def verify(self, behavior):
        with ProtocolFixture(rtsp_fixture(behavior)) as fixture:
            result = verify_service("127.0.0.1", fixture.port, mode="rtsp", path="/stream", timeout_ms=700)
        return result, fixture.requests

    def test_auth_challenge_does_not_claim_video(self):
        result, _ = self.verify("auth")
        self.assertEqual(result["state"], "authentication_required")
        self.assertTrue(result["authentication_required"])

    def test_sdp_only_is_advertised_without_video_confirmation(self):
        result, requests = self.verify("advertised")
        self.assertEqual(result["state"], "video_advertised")
        self.assertIn("SETUP", [request[0] for request in requests])

    def test_valid_video_rtp_on_negotiated_channel_confirms_video(self):
        result, requests = self.verify("video")
        self.assertEqual(result["state"], "video_confirmed")
        self.assertEqual(result["video"]["codec"].upper(), "H264")
        self.assertGreaterEqual(result["video"]["packets"], 1)
        self.assertTrue({"DESCRIBE", "SETUP", "PLAY"}.issubset({r[0] for r in requests}))

    def test_rtcp_wrong_payload_type_and_empty_payload_never_confirm(self):
        for behavior in ["rtcp", "wrong_pt", "empty_payload"]:
            with self.subTest(behavior=behavior):
                result, _ = self.verify(behavior)
                self.assertEqual(result["state"], "video_advertised")

    def test_external_sdp_track_is_never_contacted(self):
        with ProtocolFixture(rtsp_fixture("video"), host="127.0.0.2") as other:
            track = f"rtsp://127.0.0.2:{other.port}/external-track"
            with ProtocolFixture(rtsp_fixture("video", external_control=track)) as fixture:
                result = verify_service("127.0.0.1", fixture.port, mode="rtsp", timeout_ms=700)
        self.assertEqual(other.requests, [])
        self.assertEqual(result["state"], "video_advertised")
        self.assertNotIn("SETUP", [request[0] for request in fixture.requests])

    def test_protocol_name_matching_username_does_not_corrupt_result(self):
        with ProtocolFixture(rtsp_fixture("video")) as fixture:
            result = verify_service("127.0.0.1", fixture.port, mode="rtsp", timeout_ms=700,
                                    username="rtsp", password="video")
        self.assertEqual(result["state"], "video_confirmed")
        self.assertEqual(result["protocol"], "rtsp")
        self.assertTrue(result["url"].startswith("rtsp://"))


class SshVerificationTests(unittest.TestCase):
    def test_auto_recognizes_actual_ssh_banner_without_sending_commands(self):
        received = []
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            listener.settimeout(2)
            port = listener.getsockname()[1]

            def banner_server():
                connection, _ = listener.accept()
                with connection:
                    connection.settimeout(1)
                    connection.sendall(b"SSH-2.0-OpenSSH_fixture\r\n")
                    received.append(connection.recv(256))

            worker = threading.Thread(target=banner_server, daemon=True)
            worker.start()
            with patch("verifier.SSH_PORTS", {port}):
                result = verify_service("127.0.0.1", port, mode="auto", timeout_ms=700)
            worker.join(1)
        self.assertFalse(worker.is_alive())
        self.assertEqual(result["state"], "ssh_service")
        self.assertEqual(result["protocol"], "ssh")
        self.assertIsNone(result["url"])
        self.assertEqual(received, [b""])


if __name__ == "__main__":
    unittest.main()
