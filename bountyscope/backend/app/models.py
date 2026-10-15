from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def now():
    return datetime.now(UTC)


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))


class Project(Identity, Base):
    __tablename__ = "projects"
    name: Mapped[str] = mapped_column(String(200))
    organization: Mapped[str] = mapped_column(String(200), default="")
    program_name: Mapped[str] = mapped_column(String(200), default="")
    program_url: Mapped[str] = mapped_column(Text, default="")
    rules_text: Mapped[str] = mapped_column(Text, default="")
    authorization_type: Mapped[str] = mapped_column(String(80), default="owned")
    authorization_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    root_domains: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    max_rps: Mapped[float] = mapped_column(default=2.0)
    max_concurrency: Mapped[int] = mapped_column(Integer, default=3)
    max_depth: Mapped[int] = mapped_column(Integer, default=4)
    url_cap: Mapped[int] = mapped_column(Integer, default=5000)
    request_budget: Mapped[int] = mapped_column(Integer, default=10000)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class ScopeRule(Identity, Base):
    __tablename__ = "scope_rules"
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    rule_type: Mapped[str] = mapped_column(String(40))
    value: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Scan(Identity, Base):
    __tablename__ = "scans"
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    target: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="queued")
    scan_profile: Mapped[str] = mapped_column(String(20), default="standard")
    scope_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    limits: Mapped[dict] = mapped_column(JSON, default=dict)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requests_sent: Mapped[int] = mapped_column(Integer, default=0)
    assets_found: Mapped[int] = mapped_column(Integer, default=0)
    endpoints_found: Mapped[int] = mapped_column(Integer, default=0)
    findings_found: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    ai_round: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Asset(Identity, Base):
    __tablename__ = "assets"
    __table_args__ = (UniqueConstraint("project_id", "hostname", "port", "scheme"),)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    hostname: Mapped[str] = mapped_column(String(253))
    ip: Mapped[str] = mapped_column(String(80), default="")
    port: Mapped[int] = mapped_column(Integer)
    scheme: Mapped[str] = mapped_column(String(10))
    status_code: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text, default="")
    technology: Mapped[list] = mapped_column(JSON, default=list)
    server: Mapped[str] = mapped_column(Text, default="")
    content_type: Mapped[str] = mapped_column(Text, default="")
    tls: Mapped[dict] = mapped_column(JSON, default=dict)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True)


class Endpoint(Identity, Base):
    __tablename__ = "endpoints"
    __table_args__ = (UniqueConstraint("asset_id", "url"),)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    url: Mapped[str] = mapped_column(Text)
    method: Mapped[str] = mapped_column(String(10), default="GET")
    status_code: Mapped[int | None] = mapped_column(Integer)
    content_type: Mapped[str] = mapped_column(Text, default="")
    content_length: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(30), default="crawl")
    parameters: Mapped[list] = mapped_column(JSON, default=list)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Finding(Identity, Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("project_id", "fingerprint"),)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id"), index=True)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"))
    endpoint_id: Mapped[str | None] = mapped_column(ForeignKey("endpoints.id"))
    scanner: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="needs_verification")
    cwe: Mapped[str] = mapped_column(String(40), default="")
    owasp_category: Mapped[str] = mapped_column(
        String(80), default="A05:2021 Security Misconfiguration"
    )
    affected_url: Mapped[str] = mapped_column(Text)
    affected_parameter: Mapped[str] = mapped_column(Text, default="")
    affected_locations: Mapped[list] = mapped_column(JSON, default=list)
    evidence_summary: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str] = mapped_column(Text)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    ai_analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    researcher_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Evidence(Identity, Base):
    __tablename__ = "evidence"
    finding_id: Mapped[str] = mapped_column(ForeignKey("findings.id"), index=True)
    type: Mapped[str] = mapped_column(String(40), default="http")
    request_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    response_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    redacted_excerpt: Mapped[str] = mapped_column(Text, default="")
    screenshot_path: Mapped[str | None] = mapped_column(Text)
    body_sha256: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ScanEvent(Identity, Base):
    __tablename__ = "scan_events"
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id"), index=True)
    kind: Mapped[str] = mapped_column(String(60))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


@event.listens_for(ScanEvent, "before_update")
@event.listens_for(ScanEvent, "before_delete")
def immutable_events(*args):
    raise ValueError("Scan events are append-only")


class Report(Identity, Base):
    __tablename__ = "reports"
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    finding_id: Mapped[str] = mapped_column(ForeignKey("findings.id"))
    format: Mapped[str] = mapped_column(String(10))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ScanFinding(Base):
    """A deduplicated issue can be observed in many scans without losing history."""

    __tablename__ = "scan_findings"
    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), primary_key=True
    )
    finding_id: Mapped[str] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True
    )
