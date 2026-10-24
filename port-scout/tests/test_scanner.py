"""Behavioral checks for parsing, real TCP connections, and bounded jobs."""
import asyncio
import errno
import socket
import threading
import unittest
from unittest.mock import AsyncMock, patch

from scanner import MAX_HOSTS, ScanJob, make_plan, parse_ports, parse_targets


class TargetParsingTests(unittest.TestCase):
    def test_bulk_ranges_cidr_and_deduplication(self):
        targets, warnings = parse_targets(
            "192.168.1.10-12,192.168.1.11;192.168.1.13-192.168.1.14\n"
            "192.168.1.16/30 # two usable hosts\n2001:0db8::1"
        )
        self.assertEqual(targets, ["192.168.1.10", "192.168.1.11", "192.168.1.12",
                                   "192.168.1.13", "192.168.1.14", "192.168.1.17",
                                   "192.168.1.18", "2001:db8::1"])
        self.assertEqual(warnings, [])

    def test_small_subnets_keep_usable_endpoints(self):
        for text, expected in [
            ("192.168.0.0/31", ["192.168.0.0", "192.168.0.1"]),
            ("192.168.0.1/32", ["192.168.0.1"]),
            ("2001:db8::/127", ["2001:db8::", "2001:db8::1"]),
            ("2001:db8::1/128", ["2001:db8::1"]),
            ("2001:db8::/126", ["2001:db8::1", "2001:db8::2", "2001:db8::3"]),
        ]:
            with self.subTest(text=text):
                self.assertEqual(parse_targets(text)[0], expected)

    def test_ipv6_range(self):
        self.assertEqual(parse_targets("2001:db8::a-2001:db8::c")[0],
                         ["2001:db8::a", "2001:db8::b", "2001:db8::c"])

    def test_single_scoped_ipv6_keeps_hyphenated_interface_name(self):
        self.assertEqual(parse_targets("fe80::1%eth-0")[0], ["fe80::1%eth-0"])

    def test_scoped_ipv6_range_is_rejected_without_losing_scope(self):
        with self.assertRaisesRegex(ValueError, "scope"):
            parse_targets("fe80::1%eth0-fe80::2%eth0")

    def test_cidr_host_bits_generate_a_warning(self):
        targets, warnings = parse_targets("192.168.1.50/30")
        self.assertEqual(targets, ["192.168.1.49", "192.168.1.50"])
        self.assertIn("192.168.1.48/30", warnings[0])

    def test_rejects_bad_targets_before_scanning(self):
        for value in ["", "not-an-ip", "999.1.1.1", "192.168.1.10-2",
                      "192.168.1.1-::1", "0.0.0.0", "224.0.0.1",
                      "::", "ff02::1", "http://192.168.1.1", "192.168.1.1:80",
                      "10.0.0.0/8", "2001:db8::/64", "10.0.0.1-10.255.255.255",
                      None, 123, "1" * 100_001]:
            with self.subTest(value=str(value)[:50]):
                with self.assertRaises(ValueError):
                    parse_targets(value)

    def test_host_limit_applies_after_deduplication(self):
        hosts, _ = parse_targets("10.0.0.0-10.0.15.255,10.0.0.1")
        self.assertEqual(len(hosts), MAX_HOSTS)
        with self.assertRaisesRegex(ValueError, "Maximum"):
            parse_targets("10.0.0.0-10.0.15.255,10.0.16.0")


class PortAndPlanTests(unittest.TestCase):
    def test_all_tcp_ports_inclusive(self):
        ports = parse_ports("1-65535")
        self.assertEqual((len(ports), ports[0], ports[-1]), (65535, 1, 65535))

    def test_ports_deduplicate_sort_and_accept_ranges(self):
        self.assertEqual(parse_ports("554,80;80-82\n443"), [80, 81, 82, 443, 554])

    def test_port_validation(self):
        for ports in ["", "0", "65536", "90-80", "-1", "80.0", "http", "1-", None, [80]]:
            with self.subTest(ports=ports):
                with self.assertRaises(ValueError):
                    parse_ports(ports)

    def test_defaults_match_complete_tcp_scan(self):
        plan = make_plan({"targets": "127.0.0.1"})
        self.assertEqual(plan.total, 65535)
        self.assertEqual(plan.settings, {"timeout_ms": 800, "concurrency": 128, "retries": 1})

    def test_numeric_settings_are_strict(self):
        for name, invalid in [("timeout_ms", [99, 5001, True, "800", 800.5]),
                              ("concurrency", [0, 257, False, None]),
                              ("retries", [-1, 3, "1"])]:
            for value in invalid:
                with self.subTest(name=name, value=value):
                    with self.assertRaises(ValueError):
                        make_plan({"targets": "127.0.0.1", name: value})

    def test_combined_work_limit(self):
        with self.assertRaisesRegex(ValueError, "host/port checks"):
            make_plan({"targets": "10.0.0.0/23", "ports": "1-65535"})

    def test_preview_counts_without_network_activity(self):
        with patch("socket.socket", side_effect=AssertionError("Preview must not connect")):
            preview = make_plan({"targets": "192.168.1.1-3", "ports": "80,443"}).preview()
        self.assertEqual((preview["host_count"], preview["port_count"], preview["total"]), (3, 2, 6))


class ScanJobTests(unittest.TestCase):
    def finish(self, job):
        job.thread.join(5)
        if job.thread.is_alive():
            job.cancel()
            job.thread.join(2)
            self.fail("Scan did not finish")
        return job.snapshot()

    def test_real_loopback_open_and_closed_ports(self):
        with socket.socket() as listener, socket.socket() as closed:
            listener.bind(("127.0.0.1", 0))
            listener.listen(4)
            closed.bind(("127.0.0.1", 0))  # Reserved but not listening; connection must be refused.
            open_port = listener.getsockname()[1]
            closed_port = closed.getsockname()[1]
            job = ScanJob(make_plan({"targets": "127.0.0.1", "ports": f"{open_port},{closed_port}",
                                     "timeout_ms": 200, "retries": 0}))
            job.start()
            report = self.finish(job)
        self.assertEqual(report["status"], "completed")
        self.assertEqual(report["counts"], {"open": 1, "closed": 1, "timeout": 0, "error": 0})
        self.assertEqual(report["results"][0]["port"], open_port)
        self.assertEqual(report["results"][0]["host"], "127.0.0.1")
        self.assertEqual(report["results"][0]["protocol"], "tcp")
        self.assertEqual((report["completed"], report["total"], report["percent"]), (2, 2, 100))
        self.assertEqual(report["hosts"][0]["completed"], 2)

    def test_results_cover_each_device_and_port_once(self):
        job = ScanJob(make_plan({"targets": "127.0.0.1-2", "ports": "80-81", "concurrency": 2}))
        attempted = []

        async def probe(host, port):
            attempted.append((host, port))
            return ("open", 1.0) if ((host.endswith(".1") and port == 80) or
                                         (host.endswith(".2") and port == 81)) else ("closed", 0)

        with patch.object(job, "_probe", probe):
            job.start()
            report = self.finish(job)
        self.assertCountEqual(attempted, [("127.0.0.1", 80), ("127.0.0.1", 81),
                                          ("127.0.0.2", 80), ("127.0.0.2", 81)])
        self.assertEqual((report["completed"], report["hosts_with_open"]), (4, 2))
        self.assertCountEqual([(r["host"], r["port"]) for r in report["results"]],
                              [("127.0.0.1", 80), ("127.0.0.2", 81)])
        for host in report["hosts"]:
            self.assertEqual((host["completed"], host["open"], host["closed"]), (2, 1, 1))

    def test_timeout_and_error_retries_are_not_reported_closed(self):
        for failure, expected in [(asyncio.TimeoutError(), "timeout"),
                                  (OSError(errno.ENETUNREACH, "unreachable"), "error")]:
            with self.subTest(expected=expected):
                job = ScanJob(make_plan({"targets": "127.0.0.1", "ports": "80", "retries": 2}))

                async def scenario():
                    loop = asyncio.get_running_loop()
                    with patch.object(loop, "sock_connect", AsyncMock(side_effect=failure)) as connect:
                        state, _ = await job._probe("127.0.0.1", 80)
                        self.assertEqual(state, expected)
                        self.assertEqual(connect.await_count, 3)

                asyncio.run(scenario())

    def test_refused_connection_does_not_retry(self):
        job = ScanJob(make_plan({"targets": "127.0.0.1", "ports": "80", "retries": 2}))

        async def scenario():
            with patch.object(asyncio.get_running_loop(), "sock_connect",
                              AsyncMock(side_effect=ConnectionRefusedError())) as connect:
                self.assertEqual((await job._probe("127.0.0.1", 80))[0], "closed")
                self.assertEqual(connect.await_count, 1)

        asyncio.run(scenario())

    def test_cancel_before_start(self):
        job = ScanJob(make_plan({"targets": "127.0.0.1", "ports": "1-65535"}))
        job.cancel()
        job.start()
        report = self.finish(job)
        self.assertEqual(report["status"], "cancelled")
        self.assertEqual(report["completed"], 0)

    def test_cancellation_closes_bounded_workers_promptly(self):
        job = ScanJob(make_plan({"targets": "127.0.0.1", "ports": "1-65535", "concurrency": 7}))
        ready = threading.Event()
        active = 0

        async def blocked_probe(host, port):
            nonlocal active
            active += 1
            if active == 7:
                ready.set()
            await asyncio.sleep(60)
            return "closed", 0

        with patch.object(job, "_probe", blocked_probe):
            job.start()
            try:
                self.assertTrue(ready.wait(2), "Workers did not begin")
                self.assertEqual(len(job._tasks), 7)
                self.assertEqual(active, 7)
            finally:
                job.cancel()
            report = self.finish(job)
        self.assertEqual(report["status"], "cancelled")
        self.assertEqual(report["completed"], 0)

    def test_cancelling_preserves_partial_open_results(self):
        job = ScanJob(make_plan({"targets": "127.0.0.1", "ports": "80-90", "concurrency": 1}))
        blocked = threading.Event()

        async def probe(host, port):
            if port == 80:
                return "open", 1.5
            blocked.set()
            await asyncio.sleep(60)
            return "closed", 0

        with patch.object(job, "_probe", probe):
            job.start()
            self.assertTrue(blocked.wait(2))
            job.cancel()
            report = self.finish(job)
        self.assertEqual(report["status"], "cancelled")
        self.assertEqual((report["completed"], report["open_count"]), (1, 1))
        self.assertEqual(report["results"][0]["port"], 80)
        self.assertIsNone(report["eta"])


if __name__ == "__main__":
    unittest.main()
