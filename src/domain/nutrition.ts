import type {
  AnalysisResult,
  EvidenceValue,
  FinalizeCorrections,
  GlycemicEvidence,
  NutrientKey,
} from './types'

export const NUTRIENT_META: Record<NutrientKey, { label: string; helper: string }> = {
  totalCarbohydrate: {
    label: 'Total carbohydrate',
    helper: 'Use the printed total—not “net carbs”.',
  },
  fiber: { label: 'Dietary fiber', helper: 'As printed for the same serving.' },
  totalSugars: { label: 'Total sugars', helper: 'Includes naturally occurring and added sugars.' },
  addedSugars: { label: 'Added sugars', helper: 'Leave unknown when the label does not declare it.' },
  sugarAlcohols: { label: 'Sugar alcohols', helper: 'Only enter when explicitly declared.' },
  protein: { label: 'Protein', helper: 'As printed for the same serving.' },
  fat: { label: 'Total fat', helper: 'As printed for the same serving.' },
}

export const NUTRIENT_KEYS = Object.keys(NUTRIENT_META) as NutrientKey[]

export function valueStatus(value: EvidenceValue<unknown>): string {
  return value.conflict ? 'Conflict' : value.status
}

export function scaleKnown(value: number | null, multiplier: number): number | null {
  return value == null ? null : Math.round(value * multiplier * 10) / 10
}

export function makeLogTotals(result: AnalysisResult, multiplier: number) {
  return {
    totalCarbohydrate: scaleKnown(result.nutrients.totalCarbohydrate.value, multiplier),
    totalSugars: scaleKnown(result.nutrients.totalSugars.value, multiplier),
    addedSugars: scaleKnown(result.nutrients.addedSugars.value, multiplier),
  }
}

export function sumKnown(values: Array<number | null>): { total: number; unknown: number } {
  return values.reduce(
    (summary, value) => {
      if (value == null) summary.unknown += 1
      else summary.total += value
      return summary
    },
    { total: 0, unknown: 0 },
  )
}

export function calculateGl(gi: number | null, availableCarbs: number | null): number | null {
  if (gi == null || availableCarbs == null || gi < 0 || availableCarbs < 0) return null
  return Math.round((gi * availableCarbs) / 10) / 10
}

export function unavailableGlycemic(reason: string): GlycemicEvidence {
  return {
    status: 'unavailable',
    testedFoodMatchDescription: null,
    matchLevel: null,
    gi: null,
    availableCarbohydrateGrams: null,
    gl: null,
    citation: null,
    licensing: null,
    reason,
  }
}

export function correctionsFromResult(result: AnalysisResult): FinalizeCorrections {
  return {
    productName: result.product.name.value ?? '',
    servingSize: result.serving.size.value,
    servingUnit: result.serving.unit ?? 'g',
    nutrients: Object.fromEntries(
      NUTRIENT_KEYS.map((key) => [key, result.nutrients[key].value]),
    ) as Record<NutrientKey, number | null>,
    rawIngredients: result.rawIngredients.value ?? '',
    consumedServings: 1,
  }
}
