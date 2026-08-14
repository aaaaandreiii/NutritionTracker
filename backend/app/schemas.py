from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
EvidenceType = Literal[
    "observed",
    "retrieved",
    "estimated",
    "derived",
    "contextual",
    "unavailable",
]
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


class NumericRange(ApiModel):
    minimum: float = Field(ge=0, allow_inf_nan=False)
    maximum: float = Field(ge=0, allow_inf_nan=False)
    unit: str = "g"

    @model_validator(mode="after")
    def validate_order(self) -> "NumericRange":
        if self.minimum > self.maximum:
            raise ValueError("Range minimum must not exceed maximum.")
        return self


class EvidenceTrailItem(ApiModel):
    timestamp: datetime
    evidence_type: EvidenceType
    source_kind: SourceKind
    source_id: str | None = None
    note: str
    value: Any | None = None


class SourceMetadata(ApiModel):
    source_id: str
    name: str
    url: str | None = None
    dataset_version: str | None = None
    retrieved_at: datetime | None = None


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
    evidence_type: EvidenceType = "unavailable"
    range: NumericRange | None = None
    confidence_band: Literal["high", "medium", "low", "unknown"] | None = None
    evidence_trail: list[EvidenceTrailItem] = Field(default_factory=list)
    source: SourceMetadata | None = None

    @model_validator(mode="before")
    @classmethod
    def infer_legacy_evidence_type(cls, data: Any) -> Any:
        if not isinstance(data, dict) or "evidence_type" in data or "evidenceType" in data:
            return data
        source_kind = data.get("source_kind", data.get("sourceKind", "unavailable"))
        inferred = {
            "label": "observed",
            "database": "retrieved",
            "user": "observed",
            "calculated": "derived",
            "unavailable": "unavailable",
        }.get(source_kind, "unavailable")
        return {**data, "evidence_type": inferred}


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


class UsdaNutrientProfile(ApiModel):
    total_carbohydrate: float | None = Field(default=None, ge=0)
    fiber: float | None = Field(default=None, ge=0)
    total_sugars: float | None = Field(default=None, ge=0)
    added_sugars: float | None = Field(default=None, ge=0)
    sugar_alcohols: float | None = Field(default=None, ge=0)
    protein: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)


class FoodDataCandidate(ApiModel):
    fdc_id: int = Field(gt=0)
    description: str
    data_type: str | None = None
    brand_owner: str | None = None
    ingredients: str | None = None
    nutrients_per_100g: UsdaNutrientProfile
    source: SourceMetadata


class FoodDataSearchResponse(ApiModel):
    query: str
    candidates: list[FoodDataCandidate] = Field(default_factory=list, max_length=5)
    available: bool
    source_id: str = "usda-fdc"
    warning: str | None = None


class EstimatedMealComponentDraft(ApiModel):
    component_id: str
    identified_name: str = Field(min_length=1, max_length=250)
    preparation_clues: list[str] = Field(default_factory=list, max_length=12)
    household_portion: str = Field(min_length=1, max_length=160)
    gram_range: NumericRange
    confidence: float = Field(ge=0, le=1)
    confidence_band: Literal["high", "medium", "low", "unknown"] = "unknown"
    candidates: list[FoodDataCandidate] = Field(default_factory=list, max_length=5)
    selected_fdc_id: int | None = Field(default=None, gt=0)
    context_only: bool = False
    qualitative_tags: list[str] = Field(default_factory=list, max_length=20)
    source_path: Literal["vlm", "manual", "curated"]


class EstimatedMealDraft(ApiModel):
    kind: Literal["estimated_unlabeled_meal"] = "estimated_unlabeled_meal"
    analysis_id: str
    status: Literal["draft", "ready"] = "ready"
    market: Literal["PH"] = "PH"
    components: list[EstimatedMealComponentDraft] = Field(default_factory=list, max_length=12)
    warnings: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    provenance: Provenance


class CreateEstimatedMealAnalysisResponse(ApiModel):
    analysis_id: str
    expires_in_seconds: int = 900


class EstimatedMealStageEvent(ApiModel):
    type: Literal["stage", "result", "error"]
    stage: str | None = None
    label: str | None = None
    status: Literal["running", "complete", "skipped", "failed"] | None = None
    result: EstimatedMealDraft | None = None
    message: str | None = None


class ConfirmedMealComponentRequest(ApiModel):
    component_id: str = Field(min_length=1, max_length=160)
    confirmed_name: str = Field(min_length=1, max_length=250)
    fdc_id: int | None = Field(default=None, gt=0)
    household_portion: str = Field(min_length=1, max_length=160)
    gram_range: NumericRange
    context_only: bool = False
    qualitative_tags: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_confirmed_portion(self) -> "ConfirmedMealComponentRequest":
        if self.gram_range.minimum < 1 or self.gram_range.maximum > 5000:
            raise ValueError("Confirmed gram ranges must stay within 1–5000 g.")
        if self.gram_range.unit.casefold() != "g":
            raise ValueError("Confirmed portion ranges must use grams.")
        if not self.context_only and self.fdc_id is None:
            raise ValueError("Choose a USDA match or mark the component context-only.")
        return self


class FinalizeEstimatedMealRequest(ApiModel):
    meal_name: str = Field(default="Estimated meal", min_length=1, max_length=250)
    meal: Literal["Breakfast", "Lunch", "Dinner", "Snack", "Other"] = "Other"
    components: list[ConfirmedMealComponentRequest] = Field(min_length=1, max_length=12)


class EstimatedNutrientRanges(ApiModel):
    total_carbohydrate: NumericRange | None = None
    fiber: NumericRange | None = None
    total_sugars: NumericRange | None = None
    added_sugars: NumericRange | None = None
    sugar_alcohols: NumericRange | None = None
    protein: NumericRange | None = None
    fat: NumericRange | None = None


class EstimatedMealComponentRecord(ApiModel):
    component_id: str
    confirmed_name: str
    household_portion: str
    gram_range: NumericRange
    context_only: bool
    confidence: float | None = Field(default=None, ge=0, le=1)
    confidence_band: Literal["high", "medium", "low", "unknown"] = "unknown"
    usda_match: FoodDataCandidate | None = None
    nutrient_ranges: EstimatedNutrientRanges
    qualitative_tags: list[str] = Field(default_factory=list)
    evidence_trail: list[EvidenceTrailItem] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class EstimatedMealRecord(ApiModel):
    kind: Literal["estimated_unlabeled_meal"] = "estimated_unlabeled_meal"
    status: Literal["confirmed"] = "confirmed"
    record_id: str
    analysis_id: str
    market: Literal["PH"] = "PH"
    meal_name: str
    meal: Literal["Breakfast", "Lunch", "Dinner", "Snack", "Other"]
    components: list[EstimatedMealComponentRecord]
    aggregate_nutrient_ranges: EstimatedNutrientRanges
    matched_component_count: int = Field(ge=0)
    excluded_component_count: int = Field(ge=0)
    unknown_nutrient_counts: dict[str, int] = Field(default_factory=dict)
    partial: bool
    limitations: list[str]
    provenance: Provenance


class SmartContextNutrient(ApiModel):
    value: float | None = Field(default=None, ge=0)
    range: NumericRange | None = None
    evidence_type: EvidenceType = "unavailable"
    source_id: str | None = None


class SmartContextNutrients(ApiModel):
    total_carbohydrate: SmartContextNutrient = Field(default_factory=SmartContextNutrient)
    fiber: SmartContextNutrient = Field(default_factory=SmartContextNutrient)
    total_sugars: SmartContextNutrient = Field(default_factory=SmartContextNutrient)
    added_sugars: SmartContextNutrient = Field(default_factory=SmartContextNutrient)
    sugar_alcohols: SmartContextNutrient = Field(default_factory=SmartContextNutrient)
    protein: SmartContextNutrient = Field(default_factory=SmartContextNutrient)
    fat: SmartContextNutrient = Field(default_factory=SmartContextNutrient)


class SmartContextResolveRequest(ApiModel):
    kind: Literal["packaged_label", "curated_unlabeled_demo", "estimated_unlabeled_meal"]
    display_name: str = Field(min_length=1, max_length=250)
    market: Literal["PH", "US"] = "PH"
    meal: Literal["Breakfast", "Lunch", "Dinner", "Snack", "Other"] | None = None
    portion_label: str | None = Field(default=None, max_length=160)
    category: str | None = Field(default=None, max_length=80)
    nutrients: SmartContextNutrients = Field(default_factory=SmartContextNutrients)
    context_flags: list[SmartContextFlag] = Field(default_factory=list, max_length=80)
    qualitative_tags: list[str] = Field(default_factory=list, max_length=80)
    limitations: list[str] = Field(default_factory=list, max_length=80)
    excluded_component_count: int = Field(default=0, ge=0, le=12)


class SmartContextSource(ApiModel):
    source_id: str
    title: str
    publisher: str
    url: str
    summary: str


class SmartContextCard(ApiModel):
    id: str
    rule_id: str
    title: str
    body: str
    evidence_labels: list[str]
    actions: list[str] = Field(default_factory=list)
    source_ids: list[str] = Field(default_factory=list)


class SmartContextWriterProvenance(ApiModel):
    rule_version: str
    evidence_version: str
    pairing_version: str
    writer_version: str
    model: str | None = None
    cache_hit: bool = False
    fallback_reason: str | None = None


class SmartContextResponse(ApiModel):
    triggered_rule_ids: list[str]
    cards: list[SmartContextCard]
    sources: list[SmartContextSource]
    evidence_source_ids: list[str]
    generation_mode: Literal["deterministic", "generated"]
    warnings: list[str] = Field(default_factory=list)
    provenance: SmartContextWriterProvenance


class CreateAnalysisResponse(ApiModel):
    analysis_id: str
    expires_in_seconds: int = 900


class ChatTurn(ApiModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12_000)


class ChatProductNutrients(ApiModel):
    total_carbohydrate: float | None = Field(default=None, ge=0)
    fiber: float | None = Field(default=None, ge=0)
    total_sugars: float | None = Field(default=None, ge=0)
    added_sugars: float | None = Field(default=None, ge=0)
    sugar_alcohols: float | None = Field(default=None, ge=0)
    protein: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)


class ChatProductContext(ApiModel):
    local_log_id: str = Field(min_length=1, max_length=160)
    product_name: str = Field(min_length=1, max_length=250)
    brand: str | None = Field(default=None, max_length=250)
    market: Literal["PH", "US"]
    serving_label: str | None = Field(default=None, max_length=120)
    barcode: str | None = Field(default=None, max_length=32, pattern=r"^[0-9]*$")
    nutrients: ChatProductNutrients
    ingredients: str | None = Field(default=None, max_length=10_000)
    sugar_variants: list[str] = Field(default_factory=list, max_length=80)
    glycemic_status: Literal["sourced", "heuristic_demo", "unavailable"] | None = None
    glycemic_reason: str | None = Field(default=None, max_length=2_000)


class ChatRequest(ApiModel):
    question: str = Field(min_length=1, max_length=2_000)
    turns: list[ChatTurn] = Field(default_factory=list, max_length=10)
    product: ChatProductContext | None = None


class ChatSource(ApiModel):
    id: str
    index: int = Field(ge=1, le=6)
    type: Literal["product", "curated", "web"]
    relationship: Literal["direct", "supporting", "background"]
    strength: Literal["strong", "moderate", "weak"]
    title: str
    publisher: str
    domain: str
    url: str | None = None
    excerpt: str


class OffProductNutrientPreview(ApiModel):
    total_carbohydrate: float | None = None
    fiber: float | None = None
    total_sugars: float | None = None
    added_sugars: float | None = None
    sugar_alcohols: float | None = None
    protein: float | None = None
    fat: float | None = None


class OffProductPreview(ApiModel):
    barcode: str
    product_name: str | None = None
    brand: str | None = None
    serving_size: float | None = None
    serving_unit: str | None = None
    serving_basis: str
    nutrients: OffProductNutrientPreview


class OffProductQualitativeMarkers(ApiModel):
    nova_group: str | None = None
    nova_groups_tags: str | None = None
    nutriscore_grade: str | None = None
    nutriscore_score: float | None = None
    allergens: str | None = None
    allergens_tags: str | None = None
    traces: str | None = None
    traces_tags: str | None = None
    categories: str | None = None
    labels: str | None = None


class OffProductLookupResponse(ApiModel):
    barcode: str
    market: Literal["PH", "US"]
    status: Literal["found", "not_found", "disabled", "db_missing", "unsupported_market"]
    complete: bool
    missing_fields: list[str] = Field(default_factory=list)
    product: OffProductPreview | None = None
    ingredients: str | None = None
    qualitative_markers: OffProductQualitativeMarkers | None = None
    source_url: str | None = None
    source_kind: Literal["local_open_food_facts"] = "local_open_food_facts"
    message: str


class BarcodeAnalysisRequest(ApiModel):
    barcode: str = Field(min_length=6, max_length=32, pattern=r"^[0-9]+$")
    market: Literal["PH", "US"] = "PH"


class CreateBarcodeAnalysisResponse(CreateAnalysisResponse):
    result: AnalysisResult
