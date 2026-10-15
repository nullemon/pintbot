"""Bounded, side-effect-free discovery of URL hints in fetched documents.

These helpers never fetch URLs or submit forms.  The caller must apply its scope
guard before requesting any returned URL.
"""

import re
from urllib.parse import urlsplit, urlunsplit
from xml.etree import ElementTree

from bs4 import BeautifulSoup, ParserRejectedMarkup

from app.utils.urls import canonicalize, safe_path

MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
MAX_HINTS = 1000
MAX_URL_LENGTH = 4096
MAX_XML_NODES = 10_000
MAX_PARENT_DEPTH = 32

_JS_STRING = re.compile(r"""(["'`])((?:\\.|(?!\1)[^\\\r\n]){1,4096}?)\1""")
_SOURCE_MAP = re.compile(r"(?:#|@)\s*sourceMappingURL\s*=\s*([^\s*]+)", re.I)
_JS_SLASH = re.compile(r"\\(?:/|u002[fF]|x2[fF])")
_RELATIVE_ASSET = re.compile(r"^[^\s?#]+\.(?:m?js|json|map)(?:[?#]|$)", re.I)
_API_PATH = re.compile(r"^(?:api(?:/|$)|v\d+/|graphql(?:[/?#]|$))", re.I)


def _text(value: object) -> str:
    if isinstance(value, bytes):
        return value[:MAX_DOCUMENT_BYTES].decode("utf-8", errors="replace")
    if isinstance(value, str):
        return value[:MAX_DOCUMENT_BYTES]
    return ""


def _url(value: object, base: str) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or len(value) > MAX_URL_LENGTH or value.startswith("#"):
        return None
    # urljoin/urlsplit silently discard tabs and newlines. Reject these before
    # resolution so malformed references cannot acquire a different hostname.
    if any(ord(char) < 33 or char == "\\" for char in value):
        return None
    try:
        result = canonicalize(value, base)
        return result if safe_path(result) else None
    except (ValueError, UnicodeError, TypeError):
        return None


def _append(
    hints: list[tuple[str, str]], seen: set[tuple[str, str]], value: object, base: str, source: str
) -> None:
    if len(hints) >= MAX_HINTS:
        return
    result = _url(value, base)
    if result is not None and (result, source) not in seen:
        seen.add((result, source))
        hints.append((result, source))


def discover_javascript(text: str | bytes, base: str) -> list[tuple[str, str]]:
    """Extract literal HTTP URLs, API paths, asset refs, and source-map comments."""
    document = _text(text)
    hints: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for match in _JS_STRING.finditer(document):
        value = _JS_SLASH.sub("/", match.group(2))
        # Interpolated templates and regex expressions are not concrete URLs.
        if "${" in value or any(char in value for char in "\\\r\n{}|^$"):
            continue
        if not (
            value.startswith(("/", "./", "../", "http://", "https://"))
            or _API_PATH.match(value)
            or _RELATIVE_ASSET.match(value)
        ):
            continue
        if value.startswith(("/*", "/^")):
            continue
        if any(char in value.partition("?")[0] for char in "[]()*"):
            continue
        _append(hints, seen, value, base, "javascript")
        if len(hints) >= MAX_HINTS:
            break
    for match in _SOURCE_MAP.finditer(document):
        _append(hints, seen, match.group(1).strip("\"'"), base, "javascript:sourcemap")
    return hints


def discover_html(page: object) -> list[tuple[str, str]]:
    """Discover resource links and GET form actions without collecting values."""
    base = getattr(page, "url", "")
    if not isinstance(base, str):
        base = str(base)
    if _url(base, base) is None:
        return []
    try:
        document = BeautifulSoup(_text(getattr(page, "body", b"")), "html.parser")
    except (ParserRejectedMarkup, ValueError, AssertionError):
        return []
    base_element = document.find("base", href=True)
    if base_element is not None:
        base = _url(base_element.get("href"), base) or base
    hints: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    attributes = {
        "a": "href",
        "area": "href",
        "link": "href",
        "script": "src",
        "img": "src",
        "iframe": "src",
        "source": "src",
        "video": "src",
        "audio": "src",
        "object": "data",
    }
    for element in document.find_all(list(attributes) + ["form"]):
        tag = element.name
        if tag == "form":
            method = str(element.get("method", "get")).strip().lower()
            if method == "get":
                # Browser GET defaults to the page URL; no field values or
                # synthetic payloads are ever placed into the discovered URL.
                action = element.get("action") or getattr(page, "url", base)
                _append(hints, seen, action, base, "html:form")
        else:
            _append(hints, seen, element.get(attributes[tag]), base, f"html:{tag}")
            if tag == "script" and not element.get("src"):
                for url, source in discover_javascript(element.get_text(), base):
                    _append(hints, seen, url, base, source)
        if len(hints) >= MAX_HINTS:
            break
    return hints


def parse_robots(text: str | bytes, base: str) -> list[tuple[str, str]]:
    """Return crawl hints from robots directives in all user-agent groups.

    Allow/Disallow entries are hints, not authorization to request a path. Wildcard
    patterns cannot identify a concrete endpoint and are skipped.
    """
    hints: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for line in _text(text).splitlines():
        directive, separator, value = line.partition("#")[0].partition(":")
        if not separator:
            continue
        directive, value = directive.strip().lower(), value.strip()
        if directive not in {"allow", "disallow", "sitemap"} or not value:
            continue
        if directive != "sitemap" and (not value.startswith("/") or "*" in value or "$" in value):
            continue
        _append(hints, seen, value, base, f"robots:{directive}")
        if len(hints) >= MAX_HINTS:
            break
    return hints


def parse_sitemap(body: str | bytes, base: str) -> list[tuple[str, str]]:
    """Read bounded sitemap/urlset XML with DTDs and entities disabled."""
    document = _text(body)
    # ElementTree never fetches external references; reject declarations as an
    # additional guard against internal entity expansion and oversized trees.
    if re.search(r"<!\s*(?:DOCTYPE|ENTITY)\b", document, re.I):
        return []
    hints: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    parser = ElementTree.XMLPullParser(events=("start", "end"))
    nodes = 0
    try:
        for offset in range(0, len(document), 8192):
            parser.feed(document[offset : offset + 8192])
            for event, element in parser.read_events():
                if event == "start":
                    nodes += 1
                    if nodes > MAX_XML_NODES:
                        return []
                elif element.tag.rsplit("}", 1)[-1].lower() == "loc":
                    _append(hints, seen, element.text, base, "sitemap")
                    element.clear()
                else:
                    element.clear()
        parser.close()
    except (ElementTree.ParseError, ValueError, TypeError):
        return []
    return hints


def parent_directories(url: str) -> list[str]:
    """Return up to 32 nearest parent directory URLs, including the origin root."""
    try:
        normalized = canonicalize(url)
        parts = urlsplit(normalized)
        components = parts.path.rstrip("/").split("/")
        # A directory URL is itself a resource; start one directory above it.
        components.pop()
        parents: list[str] = []
        while components and len(parents) < MAX_PARENT_DEPTH:
            path = "/".join(components).rstrip("/") + "/"
            candidate = urlunsplit((parts.scheme, parts.netloc, path, "", ""))
            if candidate != normalized and safe_path(candidate):
                parents.append(candidate)
            components.pop()
        return parents
    except (ValueError, UnicodeError, TypeError):
        return []
