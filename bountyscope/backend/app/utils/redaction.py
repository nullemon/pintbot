import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

SENSITIVE = re.compile(
    r"authorization|cookie|password|passwd|secret|token|api.?key|access.?key|credential|session|signature|^key$|^code$|^sig$",
    re.I,
)
PATTERNS = [
    (
        r"(?:sk-(?:proj-|ant-api03-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,}|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{15,}|[sr]k_live_[A-Za-z0-9]{16,})",
        "[REDACTED]",
    ),
    (r"-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)", "[REDACTED]"),
    (r"(?i)(?:bearer|basic)\s+[a-z0-9._~+/=-]+", "[REDACTED]"),
    (r"eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*)?", "[REDACTED]"),
    (r"(?:AKIA|ASIA)[A-Z0-9]{16}", "[REDACTED]"),
    (
        r"(?i)((?:password|passwd|secret|token|api[_-]?key|access[_-]?key|session[_-]?id)[\w-]*[\s\"']*[:=][\s\"']*)[^\s,;\"'<>&]+",
        r"\1[REDACTED]",
    ),
    (r"(?i)(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s\"'<>]+", "[REDACTED]"),
    (r"(?im)((?:authorization|set-cookie|cookie):)[^\r\n]*", r"\1 [REDACTED]"),
]


def redact(value: str) -> str:
    value = re.sub(r"(?i)(https?://)[^/\s@]+@", r"\1[REDACTED]@", value)
    for pattern, replacement in PATTERNS:
        value = re.sub(pattern, replacement, value)
    return value


def clean_url(url: str) -> str:
    p = urlsplit(url)
    query = urlencode(
        [
            (k, "[REDACTED]" if SENSITIVE.search(k) else redact(v))
            for k, v in parse_qsl(p.query, keep_blank_values=True)
        ]
    )
    authority = p.netloc.rsplit("@", 1)[-1]
    return urlunsplit((p.scheme, authority, redact(p.path), query, ""))


def sanitize(value):
    if isinstance(value, dict):
        return {
            str(k): "[REDACTED]" if SENSITIVE.search(str(k)) else sanitize(v)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    if isinstance(value, str):
        try:
            return clean_url(value) if value.startswith(("https://", "http://")) else redact(value)
        except (ValueError, UnicodeError):
            return redact(value)
    return value


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
