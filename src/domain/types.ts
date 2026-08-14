export type Market = 'PH' | 'US'

export type SmartContextRecordKind = 'packaged_label' | 'curated_unlabeled_demo'

export type SourceKind =
  | 'label'
  | 'database'
  | 'user'
  | 'calculated'
  | 'unavailable'

export type FieldStatus =
  | 'Read from label'
  | 'Database match'
  | 'User confirmed'
  | 'Conflict'
  | 'Unavailable'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  page?: number
}

export interface EvidenceReference {
  imageKind?: 'nutrition' | 'ingredients' | 'front'
  boundingBox?: BoundingBox
  url?: string
  note?: string
}

export interface EvidenceValue<T> {
  value: T | null
  unit: string | null
  servingBasis: string | null
  sourceKind: SourceKind
  status: FieldStatus
  evidence: EvidenceReference | null
  confidence: number | null
  conflict: boolean
  confirmed: boolean
}

export type NutrientKey =
  | 'totalCarbohydrate'
  | 'fiber'
  | 'totalSugars'
  | 'addedSugars'
  | 'sugarAlcohols'
  | 'protein'
  | 'fat'

export type NutrientFields = Record<NutrientKey, EvidenceValue<number>>

export interface SugarVariant {
  rawSpan: string
  canonicalName: string
  category: string
  ingredientRank: number
  evidence: EvidenceReference | null
}

export type SmartContextFlagCategory =
  | 'sugar_alias'
  | 'hfcs'
  | 'maltodextrin'
  | 'starch'
  | 'polyol'
  | 'high_intensity_sweetener'
  | 'processing_marker'
  | 'curated_demo'

export interface SmartContextFlag {
  id: string
  label: string
  category: SmartContextFlagCategory
  detail: string
  evidenceLabels: string[]
}

export interface GlycemicEvidence {
  status: 'sourced' | 'heuristic_demo' | 'unavailable'
  testedFoodMatchDescription: string | null
  matchLevel: 'exact_product' | 'same_food_form' | 'alias_heuristic' | null
  gi: number | null
  availableCarbohydrateGrams: number | null
  gl: number | null
  glBand: 'green' | 'yellow' | 'red' | null
  citation: { title: string; url: string } | null
  licensing: string | null
  reason: string
}

export interface QualityCheck {
  code: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface ValidationCheck {
  code: string
  status: 'pass' | 'review' | 'fail'
  message: string
}

export interface PanelDiagnostic {
  status: 'complete' | 'skipped' | 'failed'
  warnings: string[]
}

export interface AnalysisDiagnostics {
  visionModel: string | null
  extractionStatus: 'complete' | 'partial' | 'skipped' | 'failed'
  fallbackReason: string | null
  panels: {
    nutrition?: PanelDiagnostic | null
    ingredients?: PanelDiagnostic | null
    front?: PanelDiagnostic | null
  }
  vlm?: MethodDiagnostic | null
}

export interface MethodDiagnostic {
  status: 'complete' | 'partial' | 'skipped' | 'failed'
  model: string | null
  latencyMs: number | null
  failureReason: string | null
  attempts: number
  tokenCounts: Record<string, number>
  validationFailures: string[]
  imagePanels: string[]
}

export interface AnalysisResult {
  analysisId: string
  status: 'partial' | 'ready' | 'confirmed'
  market: Market
  product: {
    name: EvidenceValue<string>
    brand: EvidenceValue<string>
    barcode: EvidenceValue<string>
  }
  serving: {
    size: EvidenceValue<number>
    unit: string | null
    householdMeasure: string | null
    servingsPerContainer: EvidenceValue<number>
  }
  nutrients: NutrientFields
  rawIngredients: EvidenceValue<string>
  sugarVariants: SugarVariant[]
  glycemic: GlycemicEvidence
  qualityChecks: QualityCheck[]
  validationChecks: ValidationCheck[]
  limitations: string[]
  diagnostics?: AnalysisDiagnostics | null
  retakeRecommended: boolean
  retakeReasons: string[]
  provenance: {
    pipelineVersion: string
    completedAt: string
    externalProcessors: string[]
  }
}

export interface OffProductNutrientPreview {
  totalCarbohydrate: number | null
  fiber: number | null
  totalSugars: number | null
  addedSugars: number | null
  sugarAlcohols: number | null
  protein: number | null
  fat: number | null
}

export interface OffProductPreview {
  barcode: string
  productName: string | null
  brand: string | null
  servingSize: number | null
  servingUnit: string | null
  servingBasis: string
  nutrients: OffProductNutrientPreview
}

export interface OffProductQualitativeMarkers {
  novaGroup: string | null
  novaGroupsTags: string | null
  nutriscoreGrade: string | null
  nutriscoreScore: number | null
  allergens: string | null
  allergensTags: string | null
  traces: string | null
  tracesTags: string | null
  categories: string | null
  labels: string | null
}

export interface OffProductLookupResponse {
  barcode: string
  market: Market
  status: 'found' | 'not_found' | 'disabled' | 'db_missing' | 'unsupported_market'
  complete: boolean
  missingFields: string[]
  product: OffProductPreview | null
  ingredients: string | null
  qualitativeMarkers: OffProductQualitativeMarkers | null
  sourceUrl: string | null
  sourceKind: 'local_open_food_facts'
  message: string
}

export interface AnalysisStageEvent {
  type: 'stage' | 'result' | 'error'
  stage?: string
  label?: string
  status?: 'running' | 'complete' | 'skipped' | 'failed'
  result?: AnalysisResult
  message?: string
}

export interface FinalizeCorrections {
  productName: string
  servingSize: number | null
  servingUnit: string
  nutrients: Record<NutrientKey, number | null>
  rawIngredients: string
  consumedServings: number
}

export interface LabelRecordValidation {
  status: 'confirmed'
  productName: EvidenceValue<string>
  servingSize: EvidenceValue<number>
  servingUnit: string | null
  nutrients: NutrientFields
  rawIngredients: EvidenceValue<string>
  sugarVariants: SugarVariant[]
  glycemic: GlycemicEvidence
  validationChecks: ValidationCheck[]
  limitations: string[]
  provenance: AnalysisResult['provenance']
}

export interface CuratedFoodCandidate {
  foodId: string
  displayName: string
  market: Extract<Market, 'PH'>
  aliases: string[]
  portionLabels: string[]
  qualitativeTags: string[]
  limitations: string[]
  matchReason: string | null
  confidence: number | null
}

export interface UnlabeledFoodCatalogResponse {
  market: Extract<Market, 'PH'>
  foods: CuratedFoodCandidate[]
  limitations: string[]
}

export interface UnlabeledFoodIdentifyResponse {
  market: Extract<Market, 'PH'>
  candidates: CuratedFoodCandidate[]
  method: 'filename_alias_demo' | 'manual_catalog_fallback'
  message: string
  limitations: string[]
}

export interface UnlabeledFoodRecordRequest {
  market: Extract<Market, 'PH'>
  foodId: string
  portionLabel: string
  notes?: string
}

export interface CuratedFoodRecord {
  kind: 'curated_unlabeled_demo'
  status: 'confirmed'
  recordId: string
  foodId: string
  market: Extract<Market, 'PH'>
  displayName: string
  selectedPortionLabel: string
  notes: string | null
  qualitativeTags: string[]
  contextFlags: SmartContextFlag[]
  glycemic: GlycemicEvidence
  limitations: string[]
  provenance: AnalysisResult['provenance']
}

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Other'

interface LogEntryBase {
  id: string
  kind?: SmartContextRecordKind
  analysisId: string
  loggedAt: string
  updatedAt?: string
  meal: MealSlot
  consumedServings: number
  productName: string
  totals: {
    totalCarbohydrate: number | null
    totalSugars: number | null
    addedSugars: number | null
  }
}

export interface PackagedLabelLogEntry extends LogEntryBase {
  kind?: 'packaged_label'
  result: AnalysisResult
  retainedImages?: Array<{
    kind: 'nutrition' | 'ingredients' | 'front'
    blob: Blob
    name: string
  }>
}

export interface CuratedUnlabeledLogEntry extends LogEntryBase {
  kind: 'curated_unlabeled_demo'
  curatedRecord: CuratedFoodRecord
  retainedImages?: undefined
}

export type LogEntry = PackagedLabelLogEntry | CuratedUnlabeledLogEntry

export interface ImageQualityReport {
  width: number
  height: number
  checks: QualityCheck[]
  canSubmit: boolean
}

export type ChatSourceType = 'product' | 'curated' | 'web'

export interface ChatSource {
  id: string
  index: number
  type: ChatSourceType
  relationship: 'direct' | 'supporting' | 'background'
  strength: 'strong' | 'moderate' | 'weak'
  title: string
  publisher: string
  domain: string
  url: string | null
  excerpt: string
}

export interface ChatProductContext {
  localLogId: string
  productName: string
  brand: string | null
  market: Market
  servingLabel: string | null
  barcode: string | null
  nutrients: Record<NutrientKey, number | null>
  ingredients: string | null
  sugarVariants: string[]
  glycemicStatus: GlycemicEvidence['status'] | null
  glycemicReason: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  sources: ChatSource[]
  warnings: string[]
  state: 'complete' | 'streaming' | 'error' | 'cancelled'
  error?: { code: string; message: string; retryable: boolean }
}

export interface ChatThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  context: ChatProductContext | null
  messages: ChatMessage[]
}

export type ChatStreamEvent =
  | { type: 'stage'; stage: string; label: string }
  | { type: 'sources'; sources: ChatSource[]; warnings: string[] }
  | { type: 'delta'; text: string }
  | { type: 'done'; finishReason: string }
  | { type: 'error'; code: string; message: string; retryable: boolean }
