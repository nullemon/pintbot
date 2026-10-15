from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.utils.urls import host_normalize

RuleType = Literal[
    "allow_domain",
    "allow_wildcard",
    "deny_domain",
    "deny_path",
    "allow_port",
    "allow_private_network",
]
FindingStatus = Literal[
    "new", "needs_verification", "verified", "false_positive", "duplicate", "reported", "resolved"
]


class RuleInput(BaseModel):
    rule_type: RuleType
    value: str = Field(min_length=1, max_length=1000)
    enabled: bool = True

    @model_validator(mode="after")
    def validate_rule(self):
        if self.rule_type in ("allow_domain", "allow_wildcard", "deny_domain"):
            value = self.value.removeprefix("*.")
            value = host_normalize(value)
            if any(c in value for c in "/@?# ") or not value or "*" in value:
                raise ValueError("Invalid hostname")
            self.value = ("*." if self.rule_type == "allow_wildcard" else "") + value
        elif self.rule_type == "allow_port":
            if not self.value.isdigit() or not 1 <= int(self.value) <= 65535:
                raise ValueError("Invalid port")
        elif self.rule_type == "deny_path" and not self.value.startswith("/"):
            raise ValueError("Excluded paths must start with /")
        elif self.rule_type == "allow_private_network" and self.value not in ("true", "false"):
            raise ValueError("Expected true or false")
        return self


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    organization: str = Field(default="", max_length=200)
    program_name: str = Field(default="", max_length=200)
    program_url: str = Field(default="", max_length=2000)
    rules_text: str = Field(default="", max_length=30000)
    authorization_type: str = Field(default="owned", max_length=80)
    authorization_confirmed: bool = False
    root_domains: list[str] = Field(default_factory=list, max_length=100)
    notes: str = Field(default="", max_length=30000)
    max_rps: float = Field(default=2, ge=0.1, le=10)
    max_concurrency: int = Field(default=3, ge=1, le=3)
    max_depth: int = Field(default=4, ge=0, le=10)
    url_cap: int = Field(default=5000, ge=1, le=5000)
    request_budget: int = Field(default=10000, ge=1, le=10000)
    scope: list[RuleInput] = Field(default_factory=list, max_length=500)


class ProjectPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    program_name: str | None = Field(default=None, max_length=200)
    program_url: str | None = Field(default=None, max_length=2000)
    rules_text: str | None = Field(default=None, max_length=30000)
    notes: str | None = Field(default=None, max_length=30000)
    authorization_confirmed: bool | None = None
    max_rps: float | None = Field(default=None, ge=0.1, le=10)
    max_concurrency: int | None = Field(default=None, ge=1, le=3)
    max_depth: int | None = Field(default=None, ge=0, le=10)
    url_cap: int | None = Field(default=None, ge=1, le=5000)
    request_budget: int | None = Field(default=None, ge=1, le=10000)


class ScanInput(BaseModel):
    project_id: str
    target: str = Field(min_length=1, max_length=3000)
    scan_profile: Literal["passive", "standard", "extended"] = "standard"
    extended_confirmed: bool = False


class FindingPatch(BaseModel):
    status: FindingStatus | None = None
    researcher_notes: str | None = Field(default=None, max_length=30000)


class ReportInput(BaseModel):
    finding_id: str
    format: Literal["markdown", "html"] = "markdown"
