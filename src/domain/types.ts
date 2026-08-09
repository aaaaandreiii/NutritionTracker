export type Market = 'PH' | 'US'

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
  provenance: {
    pipelineVersion: string
    completedAt: string
    externalProcessors: string[]
  }
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

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Other'

export interface LogEntry {
  id: string
  analysisId: string
  loggedAt: string
  meal: MealSlot
  consumedServings: number
  productName: string
  result: AnalysisResult
  totals: {
    totalCarbohydrate: number | null
    totalSugars: number | null
    addedSugars: number | null
  }
  retainedImages?: Array<{
    kind: 'nutrition' | 'ingredients' | 'front'
    blob: Blob
    name: string
  }>
}

export interface ImageQualityReport {
  width: number
  height: number
  checks: QualityCheck[]
  canSubmit: boolean
}
