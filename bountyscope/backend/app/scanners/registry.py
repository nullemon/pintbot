"""Ordered scanner registry with per-module failures and intact stop signals."""

from app.scanners.active import (
    CORSScanner,
    DiscoveryScanner,
    ExposedFilesScanner,
    JavaScriptScanner,
)
from app.scanners.directory import DirectoryListingScanner
from app.scanners.disclosure import CacheScanner, InformationDisclosureScanner, RedirectScanner
from app.scanners.exposure_discovery import ExposureDirectoryDiscovery
from app.scanners.headers import CookieScanner, SecurityHeadersScanner, TLSScanner

EXPOSURE_SCANNERS = {
    "discovery",
    "directory_listing",
    "javascript",
    "exposed_files",
    "exposure_directory_discovery",
}

SCANNERS = (
    DiscoveryScanner(),
    ExposureDirectoryDiscovery(),
    SecurityHeadersScanner(),
    CookieScanner(),
    TLSScanner(),
    InformationDisclosureScanner(),
    DirectoryListingScanner(),
    JavaScriptScanner(),
    CORSScanner(),
    RedirectScanner(),
    CacheScanner(),
    ExposedFilesScanner(),
)


async def analyze_page(ctx, page):
    from app.core.http import BudgetExceeded, ScanCancelled

    findings = []
    for scanner in SCANNERS:
        if ctx.profile == "exposure" and scanner.name not in EXPOSURE_SCANNERS:
            continue
        ctx.http.scanner = scanner.name
        try:
            candidates = await scanner.scan(ctx, page)
            findings.extend(
                c
                for c in candidates
                if not (
                    ctx.profile == "exposure"
                    and c.scanner == "javascript"
                    and c.cwe == "CWE-540"
                    and "head_success" not in c.signals
                )
            )
        except (BudgetExceeded, ScanCancelled):
            raise
        except Exception as exc:
            handler = getattr(ctx, "error", None)
            if handler:
                handler(scanner.name, exc)
            # BudgetExceeded, ScanCancelled and asyncio cancellation deliberately
            # bypass this handler so the orchestrator can stop the scan promptly.
    return findings
