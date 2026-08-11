from __future__ import annotations

from datetime import datetime
from typing import Generic, Literal, TypeVar

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


SmartContextFlagCategory = Literal[
    "sugar_alias",
    "hfcs",
    "maltodextrin",
    "starch",
    "polyol",
    "high_intensity_sweetener",
    "processing_marker",
    "curated_demo",
]


class SmartContextFlag(ApiModel):
    id: str
    label: str
    category: SmartContextFlagCategory
    detail: str
    evidence_labels: list[str] = Field(default_factory=list)


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
    warnings: list[str] = Field(default_factory=list)


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
    vision_model: str | None = None
    extraction_status: Literal["complete", "partial", "skipped", "failed"]
    fallback_reason: str | None = None
    panels: PanelDiagnostics = Field(default_factory=PanelDiagnostics)
    vlm: MethodDiagnostic | None = None


class Provenance(ApiModel):
    pipeline_version: str
    completed_at: datetime
    external_processors: list[str]


class AnalysisResult(ApiModel):
    analysis_id: str
    status: Literal["partial", "ready", "confirmed"]
    market: Literal["PH", "US"]
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


class LabelRecordValidationResponse(ApiModel):
    status: Literal["confirmed"] = "confirmed"
    product_name: EvidenceValue[str]
    serving_size: EvidenceValue[float]
    serving_unit: str | None = None
    nutrients: NutrientFields
    raw_ingredients: EvidenceValue[str]
    sugar_variants: list[SugarVariant]
    glycemic: GlycemicEvidence
    validation_checks: list[ValidationCheck]
    limitations: list[str]
    provenance: Provenance


class CuratedFoodCandidate(ApiModel):
    food_id: str
    display_name: str
    market: Literal["PH"] = "PH"
    aliases: list[str]
    portion_labels: list[str]
    qualitative_tags: list[str]
    limitations: list[str]
    match_reason: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)


class UnlabeledFoodCatalogResponse(ApiModel):
    market: Literal["PH"]
    foods: list[CuratedFoodCandidate]
    limitations: list[str]


class UnlabeledFoodIdentifyResponse(ApiModel):
    market: Literal["PH"]
    candidates: list[CuratedFoodCandidate]
    method: Literal["filename_alias_demo", "manual_catalog_fallback"]
    message: str
    limitations: list[str]


class UnlabeledFoodRecordRequest(ApiModel):
    market: Literal["PH"] = "PH"
    food_id: str = Field(min_length=1, max_length=80)
    portion_label: str = Field(min_length=1, max_length=120)
    notes: str = Field(default="", max_length=1000)


class CuratedFoodRecord(ApiModel):
    kind: Literal["curated_unlabeled_demo"] = "curated_unlabeled_demo"
    status: Literal["confirmed"] = "confirmed"
    record_id: str
    food_id: str
    market: Literal["PH"] = "PH"
    display_name: str
    selected_portion_label: str
    notes: str | None = None
    qualitative_tags: list[str]
    context_flags: list[SmartContextFlag]
    glycemic: GlycemicEvidence
    limitations: list[str]
    provenance: Provenance


class CreateAnalysisResponse(ApiModel):
    analysis_id: str
    expires_in_seconds: int = 900
