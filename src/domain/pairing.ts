import type { AnalysisResult, MealSlot, NutrientKey, SugarVariant } from './types'

export type PairingInsightCategory =
  | 'fiber'
  | 'protein_fat'
  | 'food_order'
  | 'ingredients'
  | 'movement'
  | 'data_quality'

export type PairingSourceId =
  | 'sydney-gi-overview'
  | 'food-order-diabetes-care-2015'
  | 'post-meal-exercise-review-2023'

export interface PairingSource {
  id: PairingSourceId
  title: string
  url: string
  summary: string
}

export interface PairingInsight {
  id: string
  priority: number
  category: PairingInsightCategory
  title: string
  body: string
  evidenceLabels: string[]
  sourceIds?: PairingSourceId[]
}

export interface PairingContext {
  result: AnalysisResult
  consumedServings?: number | null
  meal?: MealSlot | null
  productName?: string | null
}

interface PortionNutrients {
  totalCarbohydrate: number | null
  fiber: number | null
  totalSugars: number | null
  addedSugars: number | null
  sugarAlcohols: number | null
  protein: number | null
  fat: number | null
}

interface IngredientMarker {
  label: string
  pattern: RegExp
}

const GL_GREEN_MAX = 10
const GL_RED_MIN = 20
const CARB_PAIRING_MIN_G = 15
const HIGH_CARB_G = 30
const LOW_FIBER_G = 3
const LOW_PROTEIN_G = 7
const LOW_FAT_G = 5
const HIGH_TOTAL_SUGAR_G = 10
const HIGH_ADDED_SUGAR_G = 5

const PROCESSING_MARKERS: IngredientMarker[] = [
  { label: 'maltodextrin', pattern: /\bmaltodextrin\b/i },
  { label: 'modified starch', pattern: /\bmodified\s+(?:corn|food|potato|tapioca|wheat)?\s*starch\b/i },
  { label: 'hydrogenated oil', pattern: /\b(?:partially\s+)?hydrogenated\b/i },
  { label: 'artificial flavor', pattern: /\bartificial\s+flavou?rs?\b/i },
  { label: 'artificial color', pattern: /\bartificial\s+colou?rs?\b|\bfd&c\b|\b(?:color|colour)\s+\d+\b/i },
  { label: 'emulsifier or gum', pattern: /\b(?:mono\s*(?:-|and)?\s*diglycerides?|datem|polysorbate|soy lecithin|lecithin|carrageenan|xanthan gum|guar gum)\b/i },
]

export const PAIRING_SOURCES: Record<PairingSourceId, PairingSource> = {
  'sydney-gi-overview': {
    id: 'sydney-gi-overview',
    title: 'University of Sydney GI overview',
    url: 'https://glycemicindex.com/about-gi/',
    summary: 'GI is carbohydrate response context after eating, not an individual glucose prediction.',
  },
  'food-order-diabetes-care-2015': {
    id: 'food-order-diabetes-care-2015',
    title: 'Diabetes Care food-order study',
    url: 'https://diabetesjournals.org/care/article/38/7/e98/30914/Food-Order-Has-a-Significant-Impact-on',
    summary: 'A small crossover study found protein and vegetables before carbohydrate changed post-meal glucose and insulin levels.',
  },
  'post-meal-exercise-review-2023': {
    id: 'post-meal-exercise-review-2023',
    title: 'Post-meal exercise review',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10036272/',
    summary: 'Review evidence supports post-meal activity as acute postprandial glucose education, not personal exercise advice.',
  },
}

export function buildPairingInsights(context: PairingContext): PairingInsight[] {
  const result = context.result
  const consumedServings = normalizedServings(context.consumedServings)
  const nutrients = portionNutrients(result, consumedServings)
  const portionGl = portionGlycemicLoad(result, consumedServings)
  const glBand = portionGl.band
  const hasYellowOrRedGl = glBand === 'yellow' || glBand === 'red'
  const highSugar = isAtLeast(nutrients.totalSugars, HIGH_TOTAL_SUGAR_G) || isAtLeast(nutrients.addedSugars, HIGH_ADDED_SUGAR_G)
  const carbContext = isAtLeast(nutrients.totalCarbohydrate, CARB_PAIRING_MIN_G)
  const higherImpactContext = hasYellowOrRedGl || highSugar || isAtLeast(nutrients.totalCarbohydrate, HIGH_CARB_G)
  const insights: PairingInsight[] = []

  if (nutrients.totalCarbohydrate == null) {
    insights.push({
      id: 'data-carbs-missing',
      priority: 10,
      category: 'data_quality',
      title: 'Pairing context is limited',
      body: 'Total carbohydrate is unknown, so Sugar pAI cannot judge whether this label needs higher-carb pairing context. Confirm carbohydrate, fiber, protein, and fat from the package when readable.',
      evidenceLabels: ['Total carbohydrate unknown'],
      sourceIds: ['sydney-gi-overview'],
    })
  }

  if ((higherImpactContext || carbContext) && (nutrients.fiber == null || nutrients.fiber < LOW_FIBER_G)) {
    const carbohydratePhrase = nutrients.totalCarbohydrate == null
      ? 'unknown carbohydrate'
      : `${formatGrams(nutrients.totalCarbohydrate)} carbohydrate`
    const body = nutrients.fiber == null
      ? 'Fiber is missing for this consumed portion. If this item becomes part of a meal, consider adding a clear fiber anchor such as vegetables, berries, beans, chia, or ground flax.'
      : `This consumed portion has ${formatGrams(nutrients.fiber)} fiber with ${carbohydratePhrase}. Consider adding vegetables, berries, beans, chia, or ground flax as the fiber anchor.`
    insights.push({
      id: 'fiber-anchor',
      priority: 20,
      category: 'fiber',
      title: 'Add a fiber anchor',
      body,
      evidenceLabels: compactLabels([
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
        gramsLabel('Fiber', nutrients.fiber),
        glLabel(portionGl.value, glBand),
      ]),
      sourceIds: ['sydney-gi-overview'],
    })
  }

  if (
    (higherImpactContext || isAtLeast(nutrients.totalCarbohydrate, 20))
    && isLowOrMissing(nutrients.protein, LOW_PROTEIN_G)
    && isLowOrMissing(nutrients.fat, LOW_FAT_G)
  ) {
    insights.push({
      id: 'protein-fat-context',
      priority: 30,
      category: 'protein_fat',
      title: 'Build the rest of the meal',
      body: 'This label looks mostly carbohydrate-led from the available data. Pair it with a protein or fat source such as beans, tofu, eggs, plain yogurt, fish, chicken, nuts, seeds, nut butter, or avocado.',
      evidenceLabels: compactLabels([
        gramsLabel('Protein', nutrients.protein),
        gramsLabel('Fat', nutrients.fat),
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
      ]),
    })
  }

  if (highSugar) {
    insights.push({
      id: 'sugar-context',
      priority: 35,
      category: 'ingredients',
      title: 'Treat it as the sweet part',
      body: 'The sugar count is a cue to avoid stacking this item with another sweet drink or dessert. A plainer protein, fat, or fiber pairing keeps the meal context simpler to interpret.',
      evidenceLabels: compactLabels([
        gramsLabel('Total sugars', nutrients.totalSugars),
        gramsLabel('Added sugars', nutrients.addedSugars),
      ]),
    })
  }

  if (higherImpactContext) {
    insights.push({
      id: 'food-order-higher-gl',
      priority: 40,
      category: 'food_order',
      title: 'Order the meal deliberately',
      body: 'When this is eaten with a meal, try vegetables, beans, or protein foods before the higher-carb item. Food-order evidence is useful for education, but it does not guarantee your glucose response.',
      evidenceLabels: compactLabels([
        mealLabel(context.meal),
        glLabel(portionGl.value, glBand),
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
      ]),
      sourceIds: ['food-order-diabetes-care-2015'],
    })
  }

  if (result.sugarVariants.length > 0) {
    insights.push({
      id: 'ingredient-sugar-variants',
      priority: 50,
      category: 'ingredients',
      title: 'Sugar names are present',
      body: `Ingredient order flags ${formatVariants(result.sugarVariants)}. Use the rank as presence context only; the label does not disclose grams of each sweetener.`,
      evidenceLabels: result.sugarVariants.slice(0, 4).map((variant) => `#${variant.ingredientRank} ${variant.canonicalName}`),
    })
  }

  const processingMarkers = findProcessingMarkers(result.rawIngredients.value ?? '')
  if (processingMarkers.length > 0) {
    insights.push({
      id: 'ingredient-processing-markers',
      priority: 55,
      category: 'ingredients',
      title: 'Processing markers to notice',
      body: `The ingredient list includes ${joinHuman(processingMarkers)}. These markers do not determine the food by themselves, but they are useful context when choosing a simpler pairing.`,
      evidenceLabels: processingMarkers.slice(0, 4),
    })
  }

  if (hasYellowOrRedGl) {
    insights.push({
      id: 'movement-yellow-red-gl',
      priority: 60,
      category: 'movement',
      title: 'Optional post-meal movement',
      body: 'For a yellow or red GL context, light movement soon after the meal can be an educational experiment if that is already appropriate for you. This app cannot tell you whether to exercise or predict your glucose.',
      evidenceLabels: compactLabels([
        glLabel(portionGl.value, glBand),
        servingsLabel(consumedServings),
      ]),
      sourceIds: ['post-meal-exercise-review-2023'],
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'steady-label-context',
      priority: 90,
      category: 'data_quality',
      title: 'No extra pairing flag',
      body: 'The known carbohydrate, sugar, fiber, protein, fat, and GL fields did not trigger a higher-impact pairing rule. Keep using meal context; this does not predict glucose response.',
      evidenceLabels: compactLabels([
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
        glLabel(portionGl.value, glBand),
      ]),
    })
  }

  return insights.sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
}

function portionNutrients(result: AnalysisResult, servings: number): PortionNutrients {
  return {
    totalCarbohydrate: scaleNutrient(result, 'totalCarbohydrate', servings),
    fiber: scaleNutrient(result, 'fiber', servings),
    totalSugars: scaleNutrient(result, 'totalSugars', servings),
    addedSugars: scaleNutrient(result, 'addedSugars', servings),
    sugarAlcohols: scaleNutrient(result, 'sugarAlcohols', servings),
    protein: scaleNutrient(result, 'protein', servings),
    fat: scaleNutrient(result, 'fat', servings),
  }
}

function scaleNutrient(result: AnalysisResult, key: NutrientKey, servings: number): number | null {
  const value = result.nutrients[key].value
  if (value == null || !Number.isFinite(value)) return null
  return roundOne(value * servings)
}

function portionGlycemicLoad(result: AnalysisResult, servings: number): { value: number | null; band: AnalysisResult['glycemic']['glBand'] } {
  const gl = result.glycemic.gl
  if (gl == null || !Number.isFinite(gl)) return { value: null, band: result.glycemic.glBand }
  const portionValue = roundOne(gl * servings)
  return { value: portionValue, band: classifyGl(portionValue) }
}

function classifyGl(gl: number): AnalysisResult['glycemic']['glBand'] {
  if (gl <= GL_GREEN_MAX) return 'green'
  if (gl < GL_RED_MIN) return 'yellow'
  return 'red'
}

function normalizedServings(servings: number | null | undefined): number {
  return typeof servings === 'number' && Number.isFinite(servings) && servings > 0 ? servings : 1
}

function isAtLeast(value: number | null, threshold: number): boolean {
  return value != null && value >= threshold
}

function isLowOrMissing(value: number | null, threshold: number): boolean {
  return value == null || value < threshold
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

function formatGrams(value: number | null): string {
  return value == null ? 'unknown g' : `${formatNumber(value)} g`
}

function gramsLabel(label: string, value: number | null): string {
  return value == null ? `${label} unknown` : `${label} ${formatNumber(value)} g`
}

function glLabel(value: number | null, band: AnalysisResult['glycemic']['glBand']): string | null {
  if (value == null && band == null) return null
  const bandLabel = band ? ` (${band})` : ''
  return value == null ? `GL ${band ?? 'unknown'}` : `GL ${formatNumber(value)}${bandLabel}`
}

function servingsLabel(servings: number): string {
  return `${formatNumber(servings)} serving${servings === 1 ? '' : 's'}`
}

function mealLabel(meal: MealSlot | null | undefined): string | null {
  return meal ? `Meal: ${meal}` : null
}

function compactLabels(labels: Array<string | null>): string[] {
  return labels.filter((label): label is string => Boolean(label))
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatVariants(variants: SugarVariant[]): string {
  const named = variants
    .slice(0, 3)
    .map((variant) => `${variant.canonicalName} at #${variant.ingredientRank}`)
  return variants.length > named.length ? `${joinHuman(named)}, plus ${variants.length - named.length} more` : joinHuman(named)
}

function findProcessingMarkers(rawIngredients: string): string[] {
  const seen = new Set<string>()
  for (const marker of PROCESSING_MARKERS) {
    if (marker.pattern.test(rawIngredients)) seen.add(marker.label)
  }
  return Array.from(seen)
}

function joinHuman(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
