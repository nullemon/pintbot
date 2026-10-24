"""Exercise local HTTP API boundaries and real loopback scan/export behavior."""
import asyncio
import csv
import http.client
import io
import json
import socket
import threading
import time
import unittest
from unittest.mock import patch

from app import ScoutServer
from scanner import ScanJob


class HttpApiTests(unittest.TestCase):
    def setUp(self):
        self.server = ScoutServer(("127.0.0.1", 0))
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever,
                                       kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()

    def tearDown(self):
        if self.server.job:
            self.server.job.cancel()
            self.server.job.thread.join(2)
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)

    def request(self, path, method="GET", body=None, headers=None, token=True):
        request_headers = {"X-Scout-Token": self.server.token} if token else {}
        if body is not None:
            if not isinstance(body, (str, bytes)):
                body = json.dumps(body)
            request_headers["Content-Type"] = "application/json"
        request_headers.update(headers or {})
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        try:
            connection.request(method, path, body=body, headers=request_headers)
            response = connection.getresponse()
            payload = response.read()
            content_type = response.getheader("Content-Type", "")
            content = json.loads(payload) if "application/json" in content_type else payload.decode()
            return response.status, dict(response.getheaders()), content
        finally:
            connection.close()

    def wait_complete(self):
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            _, _, body = self.request("/api/scan")
            if body["job"]["status"] not in ("running", "cancelling"):
                return body["job"]
            time.sleep(0.01)
        self.fail("Scan API did not become terminal")

    def test_config_and_preview_have_no_side_effects(self):
        status, headers, config = self.request("/api/config")
        self.assertEqual(status, 200)
        self.assertEqual(config["presets"]["all"], "1-65535")
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIsNone(config["active_job"])
        status, _, preview = self.request("/api/preview", "POST",
                                          {"targets": "192.168.1.1-3", "ports": "80,443"})
        self.assertEqual(status, 200)
        self.assertEqual(preview["total"], 6)
        self.assertIsNone(self.server.job)

    def test_session_host_and_origin_are_checked(self):
        for headers, token in [({}, False), ({"X-Scout-Token": "bad"}, True),
                               ({"X-Scout-Token": "caf\u00e9"}, True),
                               ({"Host": f"untrusted.test:{self.port}"}, True),
                               ({"Origin": "https://untrusted.test"}, True),
                               ({"Origin": "null"}, True)]:
            with self.subTest(headers=headers, token=token):
                self.assertEqual(self.request("/api/config", headers=headers, token=token)[0], 403)
        self.assertEqual(self.request("/api/config", headers={"Origin": f"http://127.0.0.1:{self.port}"})[0], 200)

    def test_invalid_requests_are_actionable_json_errors(self):
        cases = [
            ("/api/preview", "[]", {}, 400),
            ("/api/preview", "{bad json", {}, 400),
            ("/api/preview", {}, {}, 400),
            ("/api/preview", {"targets": "127.0.0.1", "ports": "0"}, {}, 400),
            ("/api/preview", {"targets": "127.0.0.1"}, {"Content-Type": "text/plain"}, 415),
            ("/api/unknown", {}, {}, 404),
        ]
        for path, body, headers, expected in cases:
            with self.subTest(path=path, body=body):
                status, _, response = self.request(path, "POST", body, headers)
                self.assertEqual(status, expected)
                self.assertIsInstance(response["error"], str)

    def test_actual_scan_then_csv_and_json_exports(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(4)
            port = listener.getsockname()[1]
            status, _, scan = self.request("/api/scan", "POST",
                                           {"targets": "127.0.0.1", "ports": str(port), "retries": 0})
            self.assertEqual(status, 201)
            report = self.wait_complete()
        self.assertEqual(report["status"], "completed")
        self.assertEqual(report["open_count"], 1)
        job_id = scan["id"]
        status, headers, exported = self.request(f"/api/export?format=json&id={job_id}")
        self.assertEqual(status, 200)
        self.assertIn("attachment", headers["Content-Disposition"])
        self.assertEqual(exported["results"][0]["port"], port)
        self.assertTrue(any("No UDP" in note for note in exported["notes"]))
        status, headers, exported = self.request(f"/api/export?format=csv&id={job_id}")
        self.assertEqual(status, 200)
        self.assertIn("text/csv", headers["Content-Type"])
        rows = list(csv.DictReader(io.StringIO(exported)))
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["host"], rows[0]["port"]), ("127.0.0.1", str(port)))
        self.assertEqual(self.request(f"/api/export?format=pdf&id={job_id}")[0], 400)
        self.assertEqual(self.request("/api/export?format=json&id=stale")[0], 404)
        self.assertEqual(self.request("/api/cancel", "POST", {"id": "stale"})[0], 404)

    def test_cancellation_and_preventing_overlapping_scans(self):
        ready = threading.Event()

        async def delayed_probe(job, host, port):
            ready.set()
            await asyncio.sleep(60)
            return "closed", 0

        with patch.object(ScanJob, "_probe", delayed_probe):
            status, _, job = self.request("/api/scan", "POST",
                                          {"targets": "127.0.0.1", "ports": "80-90"})
            self.assertEqual(status, 201)
            self.assertTrue(ready.wait(2))
            self.assertEqual(self.request("/api/scan", "POST",
                                           {"targets": "127.0.0.1", "ports": "80"})[0], 409)
            status, _, cancelled = self.request("/api/cancel", "POST", {"id": job["id"]})
            self.assertEqual(status, 200)
            self.assertIn(cancelled["status"], ("cancelling", "cancelled"))
            report = self.wait_complete()
            self.assertEqual(report["status"], "cancelled")
        self.assertEqual(self.request(f"/api/export?format=json&id={job['id']}")[0], 200)


if __name__ == "__main__":
    unittest.main()
