"""Port Scout's bounded, asynchronous TCP connect scanner (standard library only)."""
from __future__ import annotations

import asyncio
import datetime as dt
import errno
import ipaddress
import re
import socket
import threading
import time
import uuid
from dataclasses import dataclass

VERSION = "1.1.0"
MAX_HOSTS = 4096
MAX_CHECKS = 20_000_000
PRESETS = {
    "all": "1-65535",
    "camera": "80,81,443,554,8000,8001,8080,8081,8443,8554,8899,9000,34567,37777",
    "common": "21,22,23,25,53,80,81,110,135,139,143,443,445,465,554,587,631,993,995,1433,1883,3306,3389,5000,5432,5900,8000,8080,8443,8554,8883,9000,34567,37777",
}
SERVICE_HINTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 81: "HTTP alternate", 110: "POP3", 135: "MS RPC",
    139: "NetBIOS", 143: "IMAP", 443: "HTTPS", 445: "SMB",
    465: "SMTP TLS", 554: "RTSP", 587: "SMTP submission", 631: "IPP",
    993: "IMAP TLS", 995: "POP3 TLS", 1433: "MS SQL", 1883: "MQTT",
    3306: "MySQL", 3389: "RDP", 5000: "Alternate web / device",
    5432: "PostgreSQL", 5900: "VNC", 8000: "Alternate web / camera",
    8001: "Alternate web / device", 8080: "HTTP alternate",
    8081: "HTTP alternate", 8443: "HTTPS alternate", 8554: "RTSP alternate",
    8883: "MQTT TLS", 8899: "Camera / device", 9000: "Alternate web / device",
    34567: "Camera device protocol", 37777: "Camera device protocol",
}


def _tokens(value: str) -> list[str]:
    # A hash starts a comment in an imported target list.
    value = "\n".join(line.split("#", 1)[0] for line in value.splitlines())
    value = re.sub(r"[ \t]*-[ \t]*", "-", value)
    return [t for t in re.split(r"[\s,;]+", value.strip()) if t]


def parse_targets(value: str) -> tuple[list[str], list[str]]:
    if not isinstance(value, str) or len(value) > 100_000:
        raise ValueError("Targets must be text, at most 100,000 characters.")
    found: dict[str, None] = {}
    warnings: list[str] = []
    for token in _tokens(value):
        try:
            try:
                individual = ipaddress.ip_address(token)
            except ValueError:
                individual = None
            if individual is not None:
                addresses = [individual]
            elif "/" in token:
                if "%" in token:
                    raise ValueError("Use a scope identifier only on a single IPv6 address.")
                network = ipaddress.ip_network(token, strict=False)
                count = network.num_addresses
                if network.version == 4 and network.prefixlen < 31:
                    count -= 2
                elif network.version == 6 and network.prefixlen < 127:
                    count -= 1
                if count > MAX_HOSTS:
                    raise ValueError(f"{token} contains {count:,} hosts; maximum {MAX_HOSTS:,} per scan.")
                if str(network) != token:
                    warnings.append(f"{token} is interpreted as {network}.")
                addresses = network.hosts()
            elif "-" in token:
                if "%" in token:
                    raise ValueError("Use a scope identifier only on a single IPv6 address.")
                start_text, end_text = token.split("-", 1)
                start = ipaddress.ip_address(start_text)
                if start.version == 4 and re.fullmatch(r"[0-9]{1,3}", end_text):
                    end_text = start_text.rsplit(".", 1)[0] + "." + end_text
                end = ipaddress.ip_address(end_text)
                if start.version != end.version or int(end) < int(start):
                    raise ValueError("Range endpoints must use the same IP version and be in ascending order.")
                count = int(end) - int(start) + 1
                if count > MAX_HOSTS:
                    raise ValueError(f"{token} contains {count:,} hosts; maximum {MAX_HOSTS:,} per scan.")
                cls = type(start)
                addresses = (cls(n) for n in range(int(start), int(end) + 1))
            else:
                addresses = [ipaddress.ip_address(token)]
            for address in addresses:
                if address.is_multicast or address.is_unspecified:
                    raise ValueError("Multicast and unspecified addresses are not individual scan targets.")
                found[str(address)] = None
                if len(found) > MAX_HOSTS:
                    raise ValueError(f"Maximum {MAX_HOSTS:,} unique hosts per scan. Split your targets into batches.")
        except ValueError as exc:
            raise ValueError(f"Invalid target '{token[:120]}': {exc}") from None
    if not found:
        raise ValueError("Add at least one IP address, CIDR subnet, or IP range.")
    return list(found), list(dict.fromkeys(warnings))


def parse_ports(value: str) -> list[int]:
    if not isinstance(value, str) or len(value) > 20_000:
        raise ValueError("Ports must be text, at most 20,000 characters.")
    found: set[int] = set()
    for token in _tokens(value):
        match = re.fullmatch(r"([0-9]{1,5})(?:-([0-9]{1,5}))?", token)
        if not match:
            raise ValueError(f"Invalid port '{token[:80]}'. Use 80,443,554 or 1-65535.")
        start = int(match[1])
        end = int(match[2] or match[1])
        if not 1 <= start <= end <= 65535:
            raise ValueError("Port numbers must be between 1 and 65535; ranges must ascend.")
        found.update(range(start, end + 1))
    if not found:
        raise ValueError("Choose a port preset or enter at least one port.")
    return sorted(found)


def _integer(data: dict, name: str, default: int, low: int, high: int) -> int:
    value = data.get(name, default)
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ValueError(f"{name} must be a whole number between {low} and {high}.")
    return value


@dataclass(frozen=True)
class ScanPlan:
    hosts: list[str]
    ports: list[int]
    port_spec: str
    timeout_ms: int
    concurrency: int
    retries: int
    warnings: list[str]

    @property
    def total(self) -> int:
        return len(self.hosts) * len(self.ports)

    @property
    def settings(self) -> dict:
        return {"timeout_ms": self.timeout_ms, "concurrency": self.concurrency, "retries": self.retries}

    def preview(self) -> dict:
        return {"host_count": len(self.hosts), "port_count": len(self.ports),
                "total": self.total, "hosts": self.hosts, "settings": self.settings,
                "warnings": self.warnings}


def make_plan(data: dict) -> ScanPlan:
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object.")
    hosts, warnings = parse_targets(data.get("targets", ""))
    ports = parse_ports(data.get("ports", PRESETS["all"]))
    if len(hosts) * len(ports) > MAX_CHECKS:
        raise ValueError(f"This scan exceeds {MAX_CHECKS:,} host/port checks. Split targets into smaller batches or use fewer ports.")
    return ScanPlan(hosts, ports, data.get("ports", PRESETS["all"]),
                    _integer(data, "timeout_ms", 800, 100, 5000),
                    _integer(data, "concurrency", 128, 1, 256),
                    _integer(data, "retries", 1, 0, 2), warnings)


class ScanJob:
    """At most concurrency sockets/tasks exist, regardless of the job size."""
    def __init__(self, plan: ScanPlan):
        self.plan = plan
        self.id = uuid.uuid4().hex
        self.created_at = dt.datetime.now(dt.timezone.utc).isoformat()
        self.started = time.monotonic()
        self.ended: float | None = None
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.status = "running"
        self.error: str | None = None
        self.results: list[dict] = []
        self.counts = dict.fromkeys(("open", "closed", "timeout", "error"), 0)
        self.host_stats = {host: {"host": host, "completed": 0, "total": len(plan.ports),
                                 "open": 0, "closed": 0, "timeout": 0, "error": 0}
                           for host in plan.hosts}
        self._loop: asyncio.AbstractEventLoop | None = None
        self._tasks: list[asyncio.Task] = []
        self.thread = threading.Thread(target=self._run, name="port-scout-scan", daemon=True)

    def start(self) -> None:
        self.thread.start()

    def cancel(self) -> None:
        with self.lock:
            if self.status not in ("running", "cancelling"):
                return
            self.status = "cancelling"
            self.stop_event.set()
            loop = self._loop
        if loop is not None:
            try:
                loop.call_soon_threadsafe(self._cancel_tasks)
            except RuntimeError:
                pass  # The loop finished between releasing the lock and scheduling.

    def _cancel_tasks(self) -> None:
        for task in self._tasks:
            task.cancel()

    def snapshot(self) -> dict:
        with self.lock:
            elapsed = max(0.001, (self.ended or time.monotonic()) - self.started)
            completed = sum(self.counts.values())
            rate = completed / elapsed
            terminal = self.status in ("completed", "cancelled", "failed")
            return {
                "id": self.id, "status": self.status, "created_at": self.created_at,
                "elapsed": round(elapsed, 2), "completed": completed, "total": self.plan.total,
                "percent": round(completed / self.plan.total * 100, 2), "rate": round(rate, 1),
                "eta": round((self.plan.total - completed) / rate, 1) if rate and not terminal else None,
                "open_count": self.counts["open"],
                "hosts_with_open": sum(h["open"] > 0 for h in self.host_stats.values()),
                "results": [r.copy() for r in self.results],
                "hosts": [h.copy() for h in self.host_stats.values()],
                "counts": self.counts.copy(), "settings": self.plan.settings,
                "port_spec": self.plan.port_spec, "host_count": len(self.plan.hosts),
                "port_count": len(self.plan.ports), "error": self.error,
            }

    async def _probe(self, host: str, port: int) -> tuple[str, float]:
        loop = asyncio.get_running_loop()
        for attempt in range(self.plan.retries + 1):
            if self.stop_event.is_set():
                raise asyncio.CancelledError
            sock = socket.socket(socket.AF_INET6 if ":" in host else socket.AF_INET, socket.SOCK_STREAM)
            sock.setblocking(False)
            start = time.monotonic()
            try:
                await asyncio.wait_for(loop.sock_connect(sock, (host, port)), self.plan.timeout_ms / 1000)
                return "open", round((time.monotonic() - start) * 1000, 2)
            except (asyncio.TimeoutError, TimeoutError):
                state = "timeout"
            except ConnectionRefusedError:
                return "closed", 0
            except OSError as exc:
                if exc.errno in (errno.ECONNREFUSED, 10061):
                    return "closed", 0
                if exc.errno in (errno.ETIMEDOUT, 10060):
                    state = "timeout"
                else:
                    state = "error"
            finally:
                sock.close()
            if attempt < self.plan.retries:
                await asyncio.sleep(0.04)
        return state, 0

    async def _scan(self) -> None:
        # Port-first iteration interleaves hosts so a large range sees progress fairly.
        work = ((host, port) for port in self.plan.ports for host in self.plan.hosts)

        async def worker() -> None:
            while not self.stop_event.is_set():
                try:
                    host, port = next(work)
                except StopIteration:
                    return
                state, latency = await self._probe(host, port)
                with self.lock:
                    self.counts[state] += 1
                    self.host_stats[host][state] += 1
                    self.host_stats[host]["completed"] += 1
                    if state == "open":
                        self.results.append({"host": host, "port": port, "protocol": "tcp",
                                             "service": SERVICE_HINTS.get(port, "Unknown"),
                                             "latency_ms": latency})

        with self.lock:
            self._loop = asyncio.get_running_loop()
            self._tasks = [asyncio.create_task(worker()) for _ in range(min(self.plan.concurrency, self.plan.total))]
            should_cancel = self.stop_event.is_set()
        if should_cancel:
            self._cancel_tasks()
        outcomes = await asyncio.gather(*self._tasks, return_exceptions=True)
        for outcome in outcomes:
            if isinstance(outcome, BaseException) and not isinstance(outcome, asyncio.CancelledError):
                raise outcome

    def _run(self) -> None:
        try:
            asyncio.run(self._scan())
            with self.lock:
                self.status = "cancelled" if self.stop_event.is_set() else "completed"
        except Exception as exc:
            with self.lock:
                self.status = "failed"
                self.error = f"Scan failed: {type(exc).__name__}: {exc}. Try lowering parallel connections."
        finally:
            with self.lock:
                self.ended = time.monotonic()
                self._loop = None
