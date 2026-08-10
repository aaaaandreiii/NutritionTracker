from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


T = TypeVar("T")
SourceKind = Literal["label", "database", "user", "calculated", "unavailable"]
ExtractionMode = Literal["both", "ocr_llm", "vlm"]
ExtractionSource = Literal["ocr_llm", "vlm"]
AgreementStatus = Literal["agree", "conflict", "ocr_only", "vlm_only", "unavailable"]
FieldStatus = Literal[
    "Read from label",
    "Database match",
    "User confirmed",
    "Conflict",
    "Unavailable",
]


class BoundingBox(ApiModel):
    x: float
    y: float
    width: float
    height: float
    page: int | None = None


class EvidenceReference(ApiModel):
    image_kind: Literal["nutrition", "ingredients", "front"] | None = None
    bounding_box: BoundingBox | None = None
    url: str | None = None
    note: str | None = None


class EvidenceValue(ApiModel, Generic[T]):
    value: T | None = None
    unit: str | None = None
    serving_basis: str | None = None
    source_kind: SourceKind = "unavailable"
    status: FieldStatus = "Unavailable"
    evidence: EvidenceReference | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    conflict: bool = False
    confirmed: bool = False


class ProductIdentity(ApiModel):
    name: EvidenceValue[str]
    brand: EvidenceValue[str]
    barcode: EvidenceValue[str]


class ServingInformation(ApiModel):
    size: EvidenceValue[float]
    unit: str | None = None
    household_measure: str | None = None
    servings_per_container: EvidenceValue[float]


class NutrientFields(ApiModel):
    total_carbohydrate: EvidenceValue[float]
    fiber: EvidenceValue[float]
    total_sugars: EvidenceValue[float]
    added_sugars: EvidenceValue[float]
    sugar_alcohols: EvidenceValue[float]
    protein: EvidenceValue[float]
    fat: EvidenceValue[float]


class SugarVariant(ApiModel):
    raw_span: str
    canonical_name: str
    category: str
    ingredient_rank: int = Field(ge=1)
    evidence: EvidenceReference | None = None


class Citation(ApiModel):
    title: str
    url: str


class GlycemicEvidence(ApiModel):
    status: Literal["sourced", "heuristic_demo", "unavailable"]
    tested_food_match_description: str | None = None
    match_level: Literal["exact_product", "same_food_form", "alias_heuristic"] | None = None
    gi: float | None = Field(default=None, ge=0)
    available_carbohydrate_grams: float | None = Field(default=None, ge=0)
    gl: float | None = Field(default=None, ge=0)
    gl_band: Literal["green", "yellow", "red"] | None = None
    citation: Citation | None = None
    licensing: str | None = None
    reason: str


class QualityCheck(ApiModel):
    code: str
    label: str
    status: Literal["pass", "warn", "fail"]
    detail: str


class ValidationCheck(ApiModel):
    code: str
    status: Literal["pass", "review", "fail"]
    message: str


class PanelDiagnostic(ApiModel):
    status: Literal["complete", "skipped", "failed"]
    readable_characters: int = Field(default=0, ge=0)
    warnings: list[str] = Field(default_factory=list)
    snippet: str | None = None


class PanelDiagnostics(ApiModel):
    nutrition: PanelDiagnostic | None = None
    ingredients: PanelDiagnostic | None = None
    front: PanelDiagnostic | None = None


class MethodDiagnostic(ApiModel):
    status: Literal["complete", "partial", "skipped", "failed"]
    model: str | None = None
    latency_ms: int | None = Field(default=None, ge=0)
    failure_reason: str | None = None
    attempts: int = Field(default=0, ge=0)
    token_counts: dict[str, int] = Field(default_factory=dict)
    validation_failures: list[str] = Field(default_factory=list)
    image_panels: list[str] = Field(default_factory=list)


class AnalysisDiagnostics(ApiModel):
    ocr_provider: Literal["tesseract", "paddle"] | None = None
    ocr_status: Literal["complete", "skipped", "failed"]
    llm_model: str | None = None
    extraction_status: Literal["complete", "partial", "skipped", "failed"]
    fallback_reason: str | None = None
    panels: PanelDiagnostics = Field(default_factory=PanelDiagnostics)
    ocr_llm: MethodDiagnostic | None = None
    vlm: MethodDiagnostic | None = None


class ExtractionCandidate(ApiModel):
    field: str
    source: ExtractionSource
    value: Any | None = None
    unit: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    snippet: str | None = None
    warning_reason: str | None = None
    validation_passed: bool = True


class FieldComparison(ApiModel):
    field: str
    agreement_status: AgreementStatus
    ocr_candidate: ExtractionCandidate | None = None
    vlm_candidate: ExtractionCandidate | None = None
    prefilled: bool = False
    warning_reason: str | None = None


class Provenance(ApiModel):
    pipeline_version: str
    completed_at: datetime
    external_processors: list[str]


class AnalysisResult(ApiModel):
    analysis_id: str
    status: Literal["partial", "ready", "confirmed"]
    market: Literal["PH", "US"]
    extraction_mode: ExtractionMode = "both"
    product: ProductIdentity
    serving: ServingInformation
    nutrients: NutrientFields
    raw_ingredients: EvidenceValue[str]
    sugar_variants: list[SugarVariant]
    glycemic: GlycemicEvidence
    quality_checks: list[QualityCheck]
    validation_checks: list[ValidationCheck]
    limitations: list[str]
    diagnostics: AnalysisDiagnostics | None = None
    extraction_candidates: dict[str, list[ExtractionCandidate]] = Field(default_factory=dict)
    field_comparisons: dict[str, FieldComparison] = Field(default_factory=dict)
    retake_recommended: bool = False
    retake_reasons: list[str] = Field(default_factory=list)
    provenance: Provenance


class NutrientCorrections(ApiModel):
    total_carbohydrate: float | None = Field(default=None, ge=0)
    fiber: float | None = Field(default=None, ge=0)
    total_sugars: float | None = Field(default=None, ge=0)
    added_sugars: float | None = Field(default=None, ge=0)
    sugar_alcohols: float | None = Field(default=None, ge=0)
    protein: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)


class FinalizeRequest(ApiModel):
    product_name: str = Field(min_length=1, max_length=250)
    serving_size: float | None = Field(default=None, ge=0)
    serving_unit: str = Field(default="g", max_length=30)
    nutrients: NutrientCorrections
    raw_ingredients: str = Field(default="", max_length=10_000)
    consumed_servings: float = Field(gt=0, le=100)


class CreateAnalysisResponse(ApiModel):
    analysis_id: str
    expires_in_seconds: int = 900
