"""Narrow, validated outputs accepted from advisory AI providers."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StructuredOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class FindingAnalysis(StructuredOutput):
    explanation: str = Field(max_length=3000)
    business_impact: str = Field(max_length=2000)
    false_positive_likelihood: Literal["low", "medium", "high", "unknown"] = "unknown"
    false_positive_reasoning: str = Field(default="", max_length=2000)
    recommended_verification: list[str] = Field(default_factory=list, max_length=8)
    confidence_adjustment: int = Field(default=0, ge=-5, le=5)


class PrioritizedFinding(StructuredOutput):
    finding_id: str = Field(max_length=100)
    score: int = Field(ge=0, le=100)
    reason: str = Field(max_length=1500)


class Prioritization(StructuredOutput):
    findings: list[PrioritizedFinding] = Field(default_factory=list, max_length=100)


class SafeTool(StrEnum):
    INSPECT_ENDPOINT = "inspect_endpoint"
    INSPECT_HEADERS = "inspect_headers"
    CHECK_DIRECTORY = "check_directory"
    CHECK_CORS = "check_cors"
    CHECK_COOKIE = "check_cookie"
    CAPTURE_SCREENSHOT = "capture_screenshot"


class SafeCheck(StructuredOutput):
    # JSON strings must parse as the enum, while every other field stays strict.
    tool: SafeTool = Field(strict=False)
    url: str = Field(min_length=1, max_length=2048)
    reason: str = Field(default="", max_length=1000)


class FollowupPlan(StructuredOutput):
    checks: list[SafeCheck] = Field(default_factory=list, max_length=20)


class ReportAdvice(StructuredOutput):
    """Advisory wording only; factual exports use the deterministic report renderer."""

    summary: str = Field(max_length=3000)
    impact_caveats: str = Field(max_length=2000)
    remediation: str = Field(max_length=3000)


class FindingExplanation(StructuredOutput):
    explanation: str = Field(max_length=3000)
    limitations: str = Field(max_length=2000)
