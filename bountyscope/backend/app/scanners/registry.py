"""Ordered scanner registry with per-module failures and intact stop signals."""

from app.scanners.active import (
    CORSScanner,
    DiscoveryScanner,
    ExposedFilesScanner,
    JavaScriptScanner,
)
from app.scanners.directory import DirectoryListingScanner
from app.scanners.disclosure import CacheScanner, InformationDisclosureScanner, RedirectScanner
from app.scanners.headers import CookieScanner, SecurityHeadersScanner, TLSScanner

SCANNERS = (
    DiscoveryScanner(),
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
        ctx.http.scanner = scanner.name
        try:
            findings.extend(await scanner.scan(ctx, page))
        except (BudgetExceeded, ScanCancelled):
            raise
        except Exception as exc:
            handler = getattr(ctx, "error", None)
            if handler:
                handler(scanner.name, exc)
            # BudgetExceeded, ScanCancelled and asyncio cancellation deliberately
            # bypass this handler so the orchestrator can stop the scan promptly.
    return findings
