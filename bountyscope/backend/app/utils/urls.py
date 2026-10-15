import re
from urllib.parse import parse_qsl, quote, unquote, urlencode, urljoin, urlsplit, urlunsplit

DANGEROUS = re.compile(
    r"(?:^|[/_?&=.-])(logout|delete|remove|destroy|unsubscribe|terminate|purchase|checkout)(?:$|[/_?&=.-])",
    re.I,
)


def host_normalize(host: str) -> str:
    return host.rstrip(".").lower().encode("idna").decode("ascii")


def canonicalize(url: str, base: str | None = None) -> str:
    url = urljoin(base, url) if base else url
    p = urlsplit(url)
    if (
        p.scheme not in ("http", "https")
        or not p.hostname
        or p.username is not None
        or p.password is not None
    ):
        raise ValueError("Only HTTP(S) URLs without userinfo are allowed")
    if any(ord(c) < 33 or c == "\\" for c in url):
        raise ValueError("Unsafe URL characters")
    host = host_normalize(p.hostname)
    port = p.port or (443 if p.scheme == "https" else 80)
    authority = f"[{host}]" if ":" in host else host
    if port != (443 if p.scheme == "https" else 80):
        authority += f":{port}"
    path = quote(unquote(p.path or "/"), safe="/:%@!$&'()*+,;=-._~")
    return urlunsplit(
        (
            p.scheme,
            authority,
            path,
            urlencode(sorted(parse_qsl(p.query, keep_blank_values=True))),
            "",
        )
    )


def safe_path(url: str) -> bool:
    return not DANGEROUS.search(unquote(urlsplit(url).path + "?" + urlsplit(url).query))


METADATA_EXTENSIONS = {
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
    ".mp4",
    ".m4v",
    ".webm",
    ".mov",
    ".avi",
    ".mkv",
    ".mpeg",
    ".mpg",
    ".ts",
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".flac",
    ".aac",
    ".opus",
    ".zip",
    ".gz",
    ".tar",
    ".tgz",
    ".7z",
    ".rar",
    ".bz2",
    ".sql",
    ".sqlite",
    ".sqlite3",
    ".db",
    ".dump",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".pem",
    ".key",
    ".map",
    ".woff",
    ".woff2",
}


def decoded_path(url: str) -> str:
    path = urlsplit(url).path
    for _ in range(10):
        decoded = unquote(path)
        if decoded == path:
            break
        path = decoded
    return path.lower().replace("\\", "/").split(";", 1)[0]


def metadata_only(url: str, source: str = "") -> bool:
    path = decoded_path(url)
    return (
        source
        in {
            "javascript:sourcemap",
            "html:img",
            "html:video",
            "html:audio",
            "html:source",
            "html:object",
        }
        or any(path.endswith(ext) for ext in METADATA_EXTENSIONS)
        or ("/.git/" in path and not path.endswith("/.git/head"))
    )
