import re
from collections import Counter
from pathlib import PurePosixPath
from urllib.parse import unquote, urljoin, urlsplit

from bs4 import BeautifulSoup, ParserRejectedMarkup

from app.scanners.base import FindingCandidate, document
from app.utils.redaction import clean_url, redact

MEDIA = {
    "image": {
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        ".bmp",
        ".tif",
        ".tiff",
        ".heic",
        ".avif",
    },
    "video": {".mp4", ".m4v", ".webm", ".mov", ".avi", ".mkv", ".mpeg", ".mpg", ".ts"},
    "audio": {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".opus"},
    "archive": {".zip", ".gz", ".tar", ".tgz", ".7z", ".rar", ".bz2"},
    "database": {".sql", ".sqlite", ".sqlite3", ".db", ".dump"},
    "document": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"},
    "configuration": {".env", ".ini", ".conf", ".config", ".pem", ".key"},
}


def file_kind(path: str) -> str:
    if path.endswith("/"):
        return "directory"
    filename = PurePosixPath(unquote(path)).name.lower()
    suffix = PurePosixPath(filename).suffix
    if filename == ".env":
        return "configuration"
    return next((kind for kind, extensions in MEDIA.items() if suffix in extensions), "other")


def _index_heading(headings: str, url: str) -> bool:
    if re.search(r"(?:Index of\s*(?:/|$)|Directory listing for\s*/)", headings, re.I):
        return True
    # IIS uses '<hostname> - /path/' rather than an "Index of" heading.
    host = urlsplit(url).hostname or ""
    return bool(
        host and re.search(r"(?:^|\s)" + re.escape(host) + r"(?::\d+)?\s+-\s*/", headings, re.I)
    )


def is_directory_listing(page) -> bool:
    """Conservative index gate used before any crawler schedules child links."""
    if page.status != 200 or not document(page):
        return False
    try:
        soup = BeautifulSoup(page.text[: 2 * 1024 * 1024], "html.parser")
    except (ParserRejectedMarkup, ValueError, AssertionError):
        return False
    headings = " ".join(
        tag.get_text(" ", strip=True) for tag in soup.find_all(["title", "h1", "h2"], limit=10)
    )
    heading = _index_heading(headings, page.url)
    parent = any(
        str(link.get("href", "")) in {"../", ".."}
        or "parent directory" in link.get_text(" ", strip=True).lower()
        for link in soup.find_all("a", href=True, limit=2000)
    )
    return heading and bool(parent or soup.find("pre") or soup.find("table"))


class DirectoryListingScanner:
    name = "directory_listing"
    category = "Directory listing"

    async def scan(self, ctx, page):
        if page.status != 200 or not document(page):
            return []
        try:
            soup = BeautifulSoup(page.text[: 2 * 1024 * 1024], "html.parser")
        except (ParserRejectedMarkup, ValueError, AssertionError):
            return []
        headings = " ".join(
            tag.get_text(" ", strip=True) for tag in soup.find_all(["title", "h1", "h2"], limit=10)
        )
        index_heading = _index_heading(headings, page.url)
        parent_link = any(
            str(link.get("href", "")) in {"../", ".."}
            or "parent directory" in link.get_text(" ", strip=True).lower()
            for link in soup.find_all("a", href=True, limit=2000)
        )
        structure = bool(soup.find("pre") or soup.find("table"))
        if not index_heading or not (parent_link or structure):
            return []
        entries = []
        seen = set()
        base = urlsplit(page.url)
        directory = base.path if base.path.endswith("/") else base.path + "/"
        for anchor in soup.find_all("a", href=True, limit=5000):
            href = str(anchor.get("href", ""))
            if not href or href.startswith(("?", "#")) or href in {"../", "..", "./", "."}:
                continue
            try:
                url = urljoin(page.url, href)
                target = urlsplit(url)
            except ValueError:
                continue
            if (
                target.scheme not in {"http", "https"}
                or target.netloc != base.netloc
                or target.query
                or not target.path.startswith(directory)
            ):
                continue
            relative = target.path[len(directory) :]
            if not relative or "/" in relative.rstrip("/") or url in seen:
                continue
            seen.add(url)
            entries.append(
                {
                    "name": redact(unquote(relative))[:150],
                    "url": clean_url(url),
                    "type": file_kind(target.path),
                    "extension": PurePosixPath(unquote(target.path)).suffix.lower() or None,
                    "content_type": None,
                    "content_length": None,
                }
            )
        if not entries:
            return []
        counts = dict(Counter(entry["type"] for entry in entries))
        media_count = sum(counts.get(kind, 0) for kind in ("image", "video", "audio"))
        return [
            FindingCandidate(
                self.name,
                "Public directory listing exposes media metadata"
                if media_count
                else "Public directory listing exposes file metadata",
                self.category,
                "The response resembles a server-generated directory index and exposes child names and links. Only listing metadata was inspected; listed media and files were not downloaded.",
                "low",
                95,
                f"Directory-index heading plus listing structure observed; {len(entries)} visible entries, including {media_count} media entries. Counts describe the sampled HTML only.",
                "Disable directory indexing where browsing is unnecessary, and enforce access controls on files requiring restricted access.",
                page.url,
                cwe="CWE-548",
                signals=["directory_index_heading", "directory_listing_structure"],
                metadata={
                    "visible_entry_count": len(entries),
                    "counts": counts,
                    "sample": entries[:10],
                    "sample_limit": 10,
                    "body_truncated": page.truncated,
                    "files_downloaded": False,
                },
            )
        ]
