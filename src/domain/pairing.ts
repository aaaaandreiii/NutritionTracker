import type {
  AnalysisResult,
  CuratedFoodCandidate,
  CuratedFoodRecord,
  GlycemicEvidence,
  MealPairingComponent,
  MealSlot,
  NutrientKey,
  SmartContextFlag,
  SmartContextFlagCategory,
  SmartContextRecordKind,
  SmartContextResolveRequest,
  SmartContextResponse,
  SugarVariant,
} from './types'
import { NUTRIENT_KEYS } from './nutrition'

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
  actionChips?: string[]
  sourceIds?: PairingSourceId[]
}

export type PairingReasonCode =
  | 'ADD_FIBER_SOURCE'
  | 'ADD_PROTEIN_SOURCE'
  | 'ADD_MINIMALLY_PROCESSED_COMPONENT'
  | 'ADD_NON_STARCHY_VEGETABLE'
  | 'MEAL_CONTEXT_COMPLEMENT'

export type CompanionFoodCategory =
  | 'vegetable'
  | 'legume'
  | 'egg'
  | 'soy'
  | 'fish'
  | 'yogurt'
  | 'nut_seed'

export interface CompanionFoodSource {
  sourceId: 'sugar-pai-curated-ph-food-catalog'
  name: 'Sugar pAI curated PH food catalog'
  url: null
  datasetVersion: 'curated-unlabeled-demo-v1'
}

export interface PairingSuggestion {
  foodId: string
  displayName: string
  category: CompanionFoodCategory
  label: string
  reasonCodes: PairingReasonCode[]
  reason: string
  evidenceLabels: string[]
  source: CompanionFoodSource
  evidenceStrength: 'high' | 'moderate'
}

export interface PairingContext {
  result: AnalysisResult
  consumedServings?: number | null
  meal?: MealSlot | null
  productName?: string | null
}

export interface PortionNutrients {
  totalCarbohydrate: number | null
  fiber: number | null
  totalSugars: number | null
  addedSugars: number | null
  sugarAlcohols: number | null
  protein: number | null
  fat: number | null
}

export interface SmartContextInput {
  kind: SmartContextRecordKind
  displayName: string
  meal?: MealSlot | null
  portionLabel?: string | null
  nutrients: PortionNutrients
  glycemic: Pick<GlycemicEvidence, 'status' | 'gl' | 'glBand' | 'reason'>
  sugarVariants: SugarVariant[]
  rawIngredients: string
  contextFlags: SmartContextFlag[]
  qualitativeTags: string[]
  limitations: string[]
}

interface IngredientMarker {
  id: string
  label: string
  category: SmartContextFlagCategory
  pattern: RegExp
  detail: string
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

const COMPANION_SOURCE: CompanionFoodSource = {
  sourceId: 'sugar-pai-curated-ph-food-catalog',
  name: 'Sugar pAI curated PH food catalog',
  url: null,
  datasetVersion: 'curated-unlabeled-demo-v1',
}

interface CompanionFoodMeta {
  category: CompanionFoodCategory
  diversityKey: string
  baseScore: number
  supportedReasons: PairingReasonCode[]
}

const TRUSTED_COMPANION_FOODS: Record<string, CompanionFoodMeta> = {
  ph_gulay_side: {
    category: 'vegetable',
    diversityKey: 'vegetable',
    baseScore: 72,
    supportedReasons: ['ADD_FIBER_SOURCE', 'ADD_NON_STARCHY_VEGETABLE', 'ADD_MINIMALLY_PROCESSED_COMPONENT'],
  },
  ph_ginisang_monggo: {
    category: 'legume',
    diversityKey: 'legume',
    baseScore: 70,
    supportedReasons: ['ADD_FIBER_SOURCE', 'ADD_PROTEIN_SOURCE', 'ADD_MINIMALLY_PROCESSED_COMPONENT'],
  },
  ph_boiled_egg: {
    category: 'egg',
    diversityKey: 'egg',
    baseScore: 68,
    supportedReasons: ['ADD_PROTEIN_SOURCE', 'ADD_MINIMALLY_PROCESSED_COMPONENT'],
  },
  ph_tokwa: {
    category: 'soy',
    diversityKey: 'soy',
    baseScore: 62,
    supportedReasons: ['ADD_PROTEIN_SOURCE', 'ADD_MINIMALLY_PROCESSED_COMPONENT'],
  },
  ph_grilled_fish: {
    category: 'fish',
    diversityKey: 'fish',
    baseScore: 60,
    supportedReasons: ['ADD_PROTEIN_SOURCE', 'ADD_MINIMALLY_PROCESSED_COMPONENT'],
  },
  ph_plain_yogurt: {
    category: 'yogurt',
    diversityKey: 'yogurt',
    baseScore: 56,
    supportedReasons: ['ADD_PROTEIN_SOURCE', 'MEAL_CONTEXT_COMPLEMENT'],
  },
  ph_unsweetened_peanut_butter: {
    category: 'nut_seed',
    diversityKey: 'nut-seed',
    baseScore: 52,
    supportedReasons: ['ADD_PROTEIN_SOURCE', 'MEAL_CONTEXT_COMPLEMENT'],
  },
  ph_chia_ground_flax: {
    category: 'nut_seed',
    diversityKey: 'nut-seed',
    baseScore: 50,
    supportedReasons: ['ADD_FIBER_SOURCE', 'MEAL_CONTEXT_COMPLEMENT'],
  },
}

type PairingProductKind = 'crackers' | 'bread' | 'sweet_snack' | 'sweet_beverage' | 'protein_food' | 'other'

interface PairingNeed {
  reasonCode: PairingReasonCode
  evidenceLabels: string[]
  strength: 'high' | 'moderate'
  score: number
  state: 'known' | 'unknown' | 'context'
}

const INGREDIENT_MARKERS: IngredientMarker[] = [
  {
    id: 'hfcs',
    label: 'High-fructose corn syrup',
    category: 'hfcs',
    pattern: /\b(?:high[-\s]?fructose\s+corn\s+syrup|hfcs|glucose[-\s]?fructose\s+syrup|fructose[-\s]?glucose\s+syrup)\b/i,
    detail: 'Sweetener identity context from the ingredient list; it does not reveal grams or product GI.',
  },
  {
    id: 'maltodextrin',
    label: 'Maltodextrin',
    category: 'maltodextrin',
    pattern: /\bmaltodextrin\b/i,
    detail: 'Carbohydrate ingredient context from the ingredient list; grams are not disclosed by rank.',
  },
  {
    id: 'starch',
    label: 'Starch ingredient',
    category: 'starch',
    pattern: /\b(?:modified\s+(?:corn|food|potato|tapioca|wheat)?\s*starch|corn\s+starch|tapioca\s+starch|potato\s+starch|wheat\s+starch|rice\s+starch|starch)\b/i,
    detail: 'Starch context from the ingredient list; use alongside confirmed carbohydrate and portion.',
  },
  {
    id: 'polyol',
    label: 'Polyol / sugar alcohol',
    category: 'polyol',
    pattern: /\b(?:sorbitol|xylitol|erythritol|maltitol|mannitol|isomalt|lactitol|polyols?)\b/i,
    detail: 'Sugar-alcohol context from the ingredient list; only subtract grams when the label declares them.',
  },
  {
    id: 'high-intensity-sweetener',
    label: 'High-intensity sweetener',
    category: 'high_intensity_sweetener',
    pattern: /\b(?:aspartame|sucralose|acesulfame\s*(?:potassium|k|-\s*k)?|ace[-\s]?k|stevia|steviol\s+glycosides?|monk\s+fruit|saccharin|neotame|advantame)\b/i,
    detail: 'Sweetener type context only; presence does not determine total carbohydrate or glucose response.',
  },
  {
    id: 'hydrogenated-oil',
    label: 'Hydrogenated oil',
    category: 'processing_marker',
    pattern: /\b(?:partially\s+)?hydrogenated\b/i,
    detail: 'Processing marker from the ingredient list; it is descriptive context, not a food rating.',
  },
  {
    id: 'artificial-flavor',
    label: 'Artificial flavor',
    category: 'processing_marker',
    pattern: /\bartificial\s+flavou?rs?\b/i,
    detail: 'Processing marker from the ingredient list; it is descriptive context, not a food rating.',
  },
  {
    id: 'artificial-color',
    label: 'Artificial color',
    category: 'processing_marker',
    pattern: /\bartificial\s+colou?rs?\b|\bfd&c\b|\b(?:color|colour)\s+\d+\b/i,
    detail: 'Processing marker from the ingredient list; it is descriptive context, not a food rating.',
  },
  {
    id: 'emulsifier-gum',
    label: 'Emulsifier or gum',
    category: 'processing_marker',
    pattern: /\b(?:mono\s*(?:-|and)?\s*diglycerides?|datem|polysorbate|soy lecithin|lecithin|carrageenan|xanthan gum|guar gum)\b/i,
    detail: 'Texture or processing marker from the ingredient list; it is descriptive context, not a food rating.',
  },
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

export function smartContextFromAnalysis(context: PairingContext): SmartContextInput {
  const result = context.result
  const consumedServings = normalizedServings(context.consumedServings)
  const glycemic = portionGlycemicLoad(result, consumedServings)
  return {
    kind: 'packaged_label',
    displayName: context.productName?.trim() || result.product.name.value || 'Packaged food',
    meal: context.meal,
    portionLabel: servingsLabel(consumedServings),
    nutrients: portionNutrients(result, consumedServings),
    glycemic: {
      status: result.glycemic.status,
      gl: glycemic.value,
      glBand: glycemic.band,
      reason: result.glycemic.reason,
    },
    sugarVariants: result.sugarVariants,
    rawIngredients: result.rawIngredients.value ?? '',
    contextFlags: buildIngredientContextFlags(result),
    qualitativeTags: [],
    limitations: result.limitations,
  }
}

export function smartContextFromCuratedRecord(record: CuratedFoodRecord, meal?: MealSlot | null): SmartContextInput {
  return {
    kind: 'curated_unlabeled_demo',
    displayName: record.displayName,
    meal,
    portionLabel: record.selectedPortionLabel,
    nutrients: emptyNutrients(),
    glycemic: {
      status: record.glycemic.status,
      gl: record.glycemic.gl,
      glBand: record.glycemic.glBand,
      reason: record.glycemic.reason,
    },
    sugarVariants: [],
    rawIngredients: '',
    contextFlags: record.contextFlags,
    qualitativeTags: record.qualitativeTags,
    limitations: record.limitations,
  }
}

export function smartContextRequestFromAnalysis(context: PairingContext): SmartContextResolveRequest {
  const input = smartContextFromAnalysis(context)
  return {
    kind: input.kind,
    displayName: input.displayName,
    market: context.result.market,
    meal: input.meal,
    portionLabel: input.portionLabel,
    nutrients: Object.fromEntries(NUTRIENT_KEYS.map((key) => {
      const field = context.result.nutrients[key]
      return [key, {
        value: input.nutrients[key],
        range: null,
        evidenceType: field.evidenceType ?? evidenceTypeFromSource(field.sourceKind),
        sourceId: field.source?.sourceId ?? null,
      }]
    })) as SmartContextResolveRequest['nutrients'],
    contextFlags: input.contextFlags,
    qualitativeTags: [],
    limitations: input.limitations,
    excludedComponentCount: 0,
  }
}

export function smartContextResponseToInsights(response: SmartContextResponse): PairingInsight[] {
  return response.cards.map((card, index) => ({
    id: card.id,
    priority: index,
    category: categoryForRule(card.ruleId),
    title: card.title,
    body: card.body,
    evidenceLabels: card.evidenceLabels,
    actionChips: card.actions,
    sourceIds: card.sourceIds.filter((sourceId): sourceId is PairingSourceId => sourceId in PAIRING_SOURCES),
  }))
}

export function deterministicSmartContextSnapshot(insights: PairingInsight[]): SmartContextResponse {
  const sourceIds = Array.from(new Set(insights.flatMap((insight) => insight.sourceIds ?? [])))
  return {
    triggeredRuleIds: insights.map((insight) => insight.id),
    cards: insights.map((insight) => ({
      id: insight.id,
      ruleId: insight.id,
      title: insight.title,
      body: insight.body,
      evidenceLabels: insight.evidenceLabels,
      actions: insight.actionChips ?? [],
      sourceIds: insight.sourceIds ?? [],
    })),
    sources: sourceIds.map((sourceId) => ({
      sourceId,
      title: PAIRING_SOURCES[sourceId].title,
      publisher: new URL(PAIRING_SOURCES[sourceId].url).hostname,
      url: PAIRING_SOURCES[sourceId].url,
      summary: PAIRING_SOURCES[sourceId].summary,
    })),
    evidenceSourceIds: sourceIds,
    generationMode: 'deterministic',
    warnings: ['Backend Smart Context was still loading or unavailable; the validated deterministic snapshot was saved.'],
    provenance: {
      ruleVersion: 'frontend-deterministic-v1',
      evidenceVersion: 'pairing-sources-v1',
      pairingVersion: 'frontend-ph-v1',
      writerVersion: 'none',
      model: null,
      cacheHit: false,
      fallbackReason: 'Backend Smart Context was not available before local save.',
    },
  }
}

export function buildIngredientContextFlags(result: AnalysisResult): SmartContextFlag[] {
  const flags: SmartContextFlag[] = []
  const seen = new Set<string>()

  for (const variant of result.sugarVariants) {
    const category = categoryForVariant(variant)
    const label = category === 'sugar_alias' ? variant.canonicalName : categoryLabel(category)
    addFlag(flags, seen, {
      id: `variant-${slug(`${category}-${variant.canonicalName}-${variant.ingredientRank}`)}`,
      label,
      category,
      detail: `${variant.canonicalName} appears in the printed ingredient order. This is presence context only; the label does not disclose grams of that ingredient.`,
      evidenceLabels: [`#${variant.ingredientRank} ${variant.rawSpan}`],
    })
  }

  const rawIngredients = result.rawIngredients.value ?? ''
  for (const marker of INGREDIENT_MARKERS) {
    if (!marker.pattern.test(rawIngredients)) continue
    addFlag(flags, seen, {
      id: `marker-${marker.id}`,
      label: marker.label,
      category: marker.category,
      detail: marker.detail,
      evidenceLabels: ['Ingredient list'],
    })
  }

  return flags
}

export function buildPairingInsights(context: SmartContextInput | PairingContext): PairingInsight[] {
  const input = isPairingContext(context) ? smartContextFromAnalysis(context) : context
  return input.kind === 'curated_unlabeled_demo'
    ? buildCuratedDemoInsights(input)
    : buildPackagedLabelInsights(input)
}

export function buildMealPairingSuggestions(
  context: SmartContextInput | PairingContext,
  catalog: CuratedFoodCandidate[],
  limit = 3,
): PairingSuggestion[] {
  const input = isPairingContext(context) ? smartContextFromAnalysis(context) : context
  if (
    input.kind !== 'packaged_label'
    || (input.nutrients.totalCarbohydrate == null && input.nutrients.totalSugars == null && input.nutrients.addedSugars == null)
  ) {
    return []
  }

  const productKind = classifyPairingProductKind(input)
  const needs = pairingNeeds(input, productKind)
  if (needs.length === 0) return []

  const productText = normalizeForPairing(`${input.displayName} ${input.rawIngredients}`)
  const ranked = catalog
    .map((food) => candidateSuggestion(food, productText, productKind, needs))
    .filter((suggestion): suggestion is PairingSuggestion & { score: number; diversityKey: string } => suggestion != null)
    .sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))

  const selected: PairingSuggestion[] = []
  const seenDiversity = new Set<string>()
  const seenFoodIds = new Set<string>()
  for (const suggestion of ranked) {
    if (seenFoodIds.has(suggestion.foodId) || seenDiversity.has(suggestion.diversityKey)) continue
    selected.push(stripInternalSuggestionFields(suggestion))
    seenFoodIds.add(suggestion.foodId)
    seenDiversity.add(suggestion.diversityKey)
    if (selected.length >= limit) break
  }
  return selected
}

export function createPairingMealComponent(
  suggestion: PairingSuggestion,
  componentId = randomComponentId(),
): MealPairingComponent {
  return {
    componentId,
    type: 'curated_generic_food',
    foodId: suggestion.foodId,
    displayName: suggestion.displayName,
    sourceId: suggestion.source.sourceId,
    sourceName: suggestion.source.name,
    reasonCodes: suggestion.reasonCodes,
    contextOnly: true,
    nutrientBasis: null,
  }
}

function buildCuratedDemoInsights(input: SmartContextInput): PairingInsight[] {
  const tags = input.qualitativeTags.map((tag) => tag.toLowerCase())
  const tagText = tags.join(' ')
  const insights: PairingInsight[] = [
    {
      id: 'curated-demo-boundary',
      priority: 5,
      category: 'data_quality',
      title: 'Curated demo boundary',
      body: 'This record is qualitative only: no calories, macros, sourced GI, GL, or FNRI values are provided. Smart Context starts after the food and portion are confirmed.',
      evidenceLabels: compactLabels([
        'Curated demo only',
        input.portionLabel ? `Portion: ${input.portionLabel}` : null,
      ]),
      actionChips: ['Confirm portion', 'Note preparation', 'Keep numbers blank'],
    },
  ]

  if (/(starchy|rice|bread|noodle|sweetened|dessert|kakanin)/i.test(tagText)) {
    insights.push({
      id: 'curated-meal-context',
      priority: 25,
      category: 'protein_fat',
      title: 'Build context around the portion',
      body: 'For this starchy or sweetened food type, use the record as a prompt to compare meal context: protein foods, fat-containing foods, or fiber-rich sides can be logged as separate context.',
      evidenceLabels: input.qualitativeTags.slice(0, 4),
      actionChips: ['Add protein context', 'Add fiber side', 'Avoid stacking sweets'],
    })
  }

  if (/(fried|oil|sauce|mixed|condiment|varies)/i.test(tagText)) {
    insights.push({
      id: 'curated-preparation-varies',
      priority: 35,
      category: 'ingredients',
      title: 'Preparation can change the record',
      body: 'The catalog entry does not know the recipe, oil, sauce, or topping. Use notes when preparation details matter for your own review.',
      evidenceLabels: input.qualitativeTags.filter((tag) => /(fried|oil|sauce|mixed|condiment|varies)/i.test(tag)).slice(0, 4),
      actionChips: ['Add note', 'Check toppings', 'Compare recipes'],
    })
  }

  if (input.contextFlags.length > 0) {
    insights.push({
      id: 'curated-context-tags',
      priority: 45,
      category: 'ingredients',
      title: 'Catalog tags are descriptors',
      body: `The selected catalog record flags ${joinHuman(input.contextFlags.slice(0, 3).map((flag) => flag.label))}. These are context descriptors, not food ratings.`,
      evidenceLabels: input.contextFlags.slice(0, 5).map((flag) => flag.label),
      actionChips: ['Review tags', 'Keep source limits visible'],
    })
  }

  return insights.sort(sortInsights)
}

function buildPackagedLabelInsights(input: SmartContextInput): PairingInsight[] {
  const nutrients = input.nutrients
  const portionGl = input.glycemic.gl
  const glBand = input.glycemic.glBand
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
      body: 'Total carbohydrate is unknown, so Sugar pAI cannot judge whether this label needs higher-carb Smart Context. Confirm carbohydrate, fiber, protein, and fat from the package when readable.',
      evidenceLabels: ['Total carbohydrate unknown'],
      actionChips: ['Confirm carbs', 'Check fiber row', 'Keep unknown blank'],
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
        glLabel(portionGl, glBand),
      ]),
      actionChips: ['Vegetables', 'Beans', 'Chia or flax', 'Berries'],
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
      body: 'This label looks mostly carbohydrate-led from the available data. Pair it with a separate protein or fat source such as beans, tofu, eggs, plain yogurt, fish, chicken, nuts, seeds, nut butter, or avocado.',
      evidenceLabels: compactLabels([
        gramsLabel('Protein', nutrients.protein),
        gramsLabel('Fat', nutrients.fat),
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
      ]),
      actionChips: ['Beans or tofu', 'Eggs or yogurt', 'Nuts or seeds', 'Avocado'],
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
      actionChips: ['Skip sweet drink', 'Plain protein', 'Fiber side'],
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
        mealLabel(input.meal),
        glLabel(portionGl, glBand),
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
      ]),
      actionChips: ['Vegetables first', 'Protein first', 'Carb later'],
      sourceIds: ['food-order-diabetes-care-2015'],
    })
  }

  if (input.sugarVariants.length > 0) {
    insights.push({
      id: 'ingredient-sugar-variants',
      priority: 50,
      category: 'ingredients',
      title: 'Sugar detected',
      body: `The ingredient list includes ${formatVariants(input.sugarVariants)}. Ingredient order confirms presence, not grams from each sweetener.`,
      evidenceLabels: input.sugarVariants.slice(0, 4).map((variant) => `#${variant.ingredientRank} ${variant.rawSpan}`),
      actionChips: ['Review rank', 'Check total sugars', 'Keep grams unknown'],
    })
  }

  const processingMarkers = input.contextFlags
    .filter((flag) => ['hfcs', 'maltodextrin', 'starch', 'polyol', 'high_intensity_sweetener'].includes(flag.category))
    .map((flag) => flag.label)
  if (processingMarkers.length > 0) {
    insights.push({
      id: 'ingredient-processing-markers',
      priority: 55,
      category: 'ingredients',
      title: "Ingredient amounts aren't available",
      body: `The label confirms ${joinHuman(processingMarkers.slice(0, 4))} in the ingredient list, but ingredient order does not tell us grams or product-specific glycemic impact.`,
      evidenceLabels: processingMarkers.slice(0, 4),
      actionChips: ['Review ingredient order', 'Check total carbohydrate', 'Keep grams unknown'],
    })
  }

  if (hasYellowOrRedGl) {
    insights.push({
      id: 'movement-yellow-red-gl',
      priority: 60,
      category: 'movement',
      title: 'Optional post-meal movement',
      body: 'For a yellow or red GL context, light movement after the meal can be an educational experiment if that is already appropriate for you. This app cannot tell you whether to exercise or predict your glucose.',
      evidenceLabels: compactLabels([
        glLabel(portionGl, glBand),
        input.portionLabel ?? null,
      ]),
      actionChips: ['Light walk', 'Household tasks', 'Track separately'],
      sourceIds: ['post-meal-exercise-review-2023'],
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'steady-label-context',
      priority: 90,
      category: 'data_quality',
      title: 'No extra context flag',
      body: 'The known carbohydrate, sugar, fiber, protein, fat, and GL fields did not trigger a higher-impact Smart Context rule. Keep using meal context; this does not predict glucose response.',
      evidenceLabels: compactLabels([
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
        glLabel(portionGl, glBand),
      ]),
      actionChips: ['Keep portion noted', 'Log locally'],
    })
  }

  return insights.sort(sortInsights)
}

function pairingNeeds(input: SmartContextInput, productKind: PairingProductKind): PairingNeed[] {
  const nutrients = input.nutrients
  const highSugar = isAtLeast(nutrients.totalSugars, HIGH_TOTAL_SUGAR_G) || isAtLeast(nutrients.addedSugars, HIGH_ADDED_SUGAR_G)
  const carbContext = isAtLeast(nutrients.totalCarbohydrate, CARB_PAIRING_MIN_G)
  const higherCarbContext = isAtLeast(nutrients.totalCarbohydrate, 20)
  const processingContext = hasProcessingContext(input)
  const evidenceBase = compactLabels([
    gramsLabel('Carbs', nutrients.totalCarbohydrate),
    gramsLabel('Fiber', nutrients.fiber),
    gramsLabel('Protein', nutrients.protein),
    gramsLabel('Total sugars', nutrients.totalSugars),
    gramsLabel('Added sugars', nutrients.addedSugars),
    productKind === 'other' ? null : `Product context: ${productKind.replace('_', ' ')}`,
  ])
  const needs: PairingNeed[] = []

  if (carbContext && nutrients.fiber == null) {
    needs.push({
      reasonCode: 'ADD_FIBER_SOURCE',
      evidenceLabels: compactLabels([
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
        'Fiber not reported',
        productKind === 'other' ? null : `Product context: ${productKind.replace('_', ' ')}`,
      ]),
      strength: 'moderate',
      score: 24,
      state: 'unknown',
    })
  } else if (carbContext && nutrients.fiber != null && nutrients.fiber < LOW_FIBER_G) {
    needs.push({
      reasonCode: 'ADD_FIBER_SOURCE',
      evidenceLabels: compactLabels([
        gramsLabel('Carbs', nutrients.totalCarbohydrate),
        gramsLabel('Fiber', nutrients.fiber),
        productKind === 'other' ? null : `Product context: ${productKind.replace('_', ' ')}`,
      ]),
      strength: 'high',
      score: 34,
      state: 'known',
    })
  }

  const proteinAlreadySubstantial = nutrients.protein != null && nutrients.protein >= 10
  const proteinContext = (higherCarbContext || highSugar || productKind === 'crackers' || productKind === 'bread' || productKind === 'sweet_snack' || productKind === 'sweet_beverage')
    && (nutrients.totalCarbohydrate != null || nutrients.totalSugars != null || nutrients.addedSugars != null)
  if (proteinContext && !proteinAlreadySubstantial && nutrients.protein == null) {
    needs.push({
      reasonCode: 'ADD_PROTEIN_SOURCE',
      evidenceLabels: compactLabels([
        higherCarbContext ? gramsLabel('Carbs', nutrients.totalCarbohydrate) : null,
        highSugar ? sugarEvidenceLabel(nutrients) : null,
        'Protein not reported',
        productKind === 'other' ? null : `Product context: ${productKind.replace('_', ' ')}`,
      ]),
      strength: 'moderate',
      score: 20,
      state: 'unknown',
    })
  } else if (proteinContext && nutrients.protein != null && nutrients.protein < LOW_PROTEIN_G) {
    needs.push({
      reasonCode: 'ADD_PROTEIN_SOURCE',
      evidenceLabels: compactLabels([
        higherCarbContext ? gramsLabel('Carbs', nutrients.totalCarbohydrate) : null,
        highSugar ? sugarEvidenceLabel(nutrients) : null,
        gramsLabel('Protein', nutrients.protein),
        productKind === 'other' ? null : `Product context: ${productKind.replace('_', ' ')}`,
      ]),
      strength: 'high',
      score: 30,
      state: 'known',
    })
  }

  if (processingContext && needs.length > 0) {
    needs.push({
      reasonCode: 'ADD_MINIMALLY_PROCESSED_COMPONENT',
      evidenceLabels: evidenceBase.slice(0, 5),
      strength: 'moderate',
      score: 8,
      state: 'context',
    })
  }

  if ((productKind === 'crackers' || productKind === 'bread' || productKind === 'sweet_snack') && needs.length > 0) {
    needs.push({
      reasonCode: 'MEAL_CONTEXT_COMPLEMENT',
      evidenceLabels: evidenceBase.slice(0, 5),
      strength: 'moderate',
      score: 6,
      state: 'context',
    })
  }

  return dedupeNeeds(needs)
}

function candidateSuggestion(
  food: CuratedFoodCandidate,
  productText: string,
  productKind: PairingProductKind,
  needs: PairingNeed[],
): (PairingSuggestion & { score: number; diversityKey: string }) | null {
  const meta = TRUSTED_COMPANION_FOODS[food.foodId]
  if (!meta || food.market !== 'PH') return null
  if (food.confidence != null && food.confidence < 0.6) return null
  if (isSameProductFamily(productText, food)) return null

  const reasonCodes = meta.supportedReasons.filter((reason) => needs.some((need) => need.reasonCode === reason))
  if (meta.category === 'vegetable' && reasonCodes.includes('ADD_FIBER_SOURCE') && !reasonCodes.includes('ADD_NON_STARCHY_VEGETABLE')) {
    reasonCodes.push('ADD_NON_STARCHY_VEGETABLE')
  }
  if (reasonCodes.length === 0) return null

  const matchedNeeds = needs.filter((need) => reasonCodes.includes(need.reasonCode))
  const score = meta.baseScore
    + matchedNeeds.reduce((total, need) => total + need.score, 0)
    + productKindBonus(productKind, meta.category)
  const evidenceStrength = matchedNeeds.some((need) => need.strength === 'high') ? 'high' : 'moderate'
  if (evidenceStrength !== 'high' && matchedNeeds.every((need) => need.state === 'context')) return null

  return {
    foodId: food.foodId,
    displayName: food.displayName,
    category: meta.category,
    label: suggestionLabel(reasonCodes),
    reasonCodes,
    reason: suggestionReason(meta.category, productKind, reasonCodes, matchedNeeds),
    evidenceLabels: Array.from(new Set(matchedNeeds.flatMap((need) => need.evidenceLabels))).slice(0, 5),
    source: COMPANION_SOURCE,
    evidenceStrength,
    score,
    diversityKey: meta.diversityKey,
  }
}

function stripInternalSuggestionFields(
  suggestion: PairingSuggestion & { score: number; diversityKey: string },
): PairingSuggestion {
  return {
    foodId: suggestion.foodId,
    displayName: suggestion.displayName,
    category: suggestion.category,
    label: suggestion.label,
    reasonCodes: suggestion.reasonCodes,
    reason: suggestion.reason,
    evidenceLabels: suggestion.evidenceLabels,
    source: suggestion.source,
    evidenceStrength: suggestion.evidenceStrength,
  }
}

function suggestionLabel(reasonCodes: PairingReasonCode[]): string {
  if (reasonCodes.includes('ADD_FIBER_SOURCE') && reasonCodes.includes('ADD_PROTEIN_SOURCE')) return 'Fiber + protein pairing'
  if (reasonCodes.includes('ADD_NON_STARCHY_VEGETABLE')) return 'Vegetable pairing'
  if (reasonCodes.includes('ADD_FIBER_SOURCE')) return 'Fiber pairing'
  if (reasonCodes.includes('ADD_PROTEIN_SOURCE')) return 'Protein pairing'
  return 'Meal pairing'
}

function suggestionReason(
  category: CompanionFoodCategory,
  productKind: PairingProductKind,
  reasonCodes: PairingReasonCode[],
  needs: PairingNeed[],
): string {
  const hasUnknownFiber = needs.some((need) => need.reasonCode === 'ADD_FIBER_SOURCE' && need.state === 'unknown')
  const hasUnknownProtein = needs.some((need) => need.reasonCode === 'ADD_PROTEIN_SOURCE' && need.state === 'unknown')
  if (category === 'legume' && reasonCodes.includes('ADD_FIBER_SOURCE') && reasonCodes.includes('ADD_PROTEIN_SOURCE')) {
    return hasUnknownFiber || hasUnknownProtein
      ? 'Adds legumes as a separate fiber- and protein-containing meal component while unknown product values stay unknown.'
      : 'Adds fiber and protein as another meal component.'
  }
  if (category === 'vegetable') {
    return hasUnknownFiber
      ? 'Adds a separate vegetable component when fiber was not reported for the packaged food.'
      : 'Adds a separate vegetable and fiber-containing component.'
  }
  if (reasonCodes.includes('ADD_PROTEIN_SOURCE')) {
    const context = productKind === 'crackers' || productKind === 'sweet_snack'
      ? 'alongside this snack'
      : productKind === 'bread'
        ? 'with the bread'
        : 'to the meal'
    return hasUnknownProtein
      ? `Adds a separate protein-containing food ${context}; protein from the product label remains unknown.`
      : `Adds a separate protein source ${context}.`
  }
  if (reasonCodes.includes('ADD_FIBER_SOURCE')) {
    return hasUnknownFiber
      ? 'Adds a separate fiber-containing food while the packaged product fiber value remains unknown.'
      : 'Adds a separate fiber-containing component.'
  }
  return 'Adds another meal component without changing the packaged food values.'
}

function productKindBonus(productKind: PairingProductKind, category: CompanionFoodCategory): number {
  const bonuses: Record<PairingProductKind, Partial<Record<CompanionFoodCategory, number>>> = {
    crackers: { egg: 20, vegetable: 16, legume: 15, fish: 10, soy: 8 },
    bread: { egg: 20, nut_seed: 15, vegetable: 12, fish: 10, soy: 8, yogurt: 6 },
    sweet_snack: { yogurt: 18, nut_seed: 14, egg: 10, legume: 8, vegetable: 5 },
    sweet_beverage: { egg: 14, soy: 12, legume: 10, vegetable: 8, yogurt: 8 },
    protein_food: { vegetable: 10, legume: 6 },
    other: { vegetable: 8, legume: 8, egg: 6 },
  }
  return bonuses[productKind][category] ?? 0
}

function classifyPairingProductKind(input: SmartContextInput): PairingProductKind {
  const text = normalizeForPairing(`${input.displayName} ${input.rawIngredients}`)
  if (/\b(?:cracker|crackers|saltine|skyflakes|biscuit|biscuits)\b/.test(text)) return 'crackers'
  if (/\b(?:bread|loaf|pandesal|pan de sal|bun|roll)\b/.test(text)) return 'bread'
  if (/\b(?:drink|juice|soda|soft drink|beverage|tea|coffee|chocolate drink|milk tea)\b/.test(text)) return 'sweet_beverage'
  if (/\b(?:cookie|cookies|cake|chocolate|candy|wafer|dessert|sweet snack|bar)\b/.test(text)) return 'sweet_snack'
  if (/\b(?:tuna|sardine|sardines|fish|chicken|egg|itlog|protein)\b/.test(text)) return 'protein_food'
  return 'other'
}

function hasProcessingContext(input: SmartContextInput): boolean {
  return input.contextFlags.some((flag) => flag.category === 'processing_marker')
    || input.limitations.some((item) => /\bNOVA\b.*\b(?:4|ultra[-\s]?processed)\b/i.test(item))
}

function sugarEvidenceLabel(nutrients: PortionNutrients): string | null {
  if (isAtLeast(nutrients.addedSugars, HIGH_ADDED_SUGAR_G)) return gramsLabel('Added sugars', nutrients.addedSugars)
  if (isAtLeast(nutrients.totalSugars, HIGH_TOTAL_SUGAR_G)) return gramsLabel('Total sugars', nutrients.totalSugars)
  return null
}

function dedupeNeeds(needs: PairingNeed[]): PairingNeed[] {
  const byCode = new Map<PairingReasonCode, PairingNeed>()
  for (const need of needs) {
    const current = byCode.get(need.reasonCode)
    if (!current || need.score > current.score || need.strength === 'high' && current.strength !== 'high') {
      byCode.set(need.reasonCode, need)
    }
  }
  return Array.from(byCode.values())
}

function isSameProductFamily(productText: string, food: CuratedFoodCandidate): boolean {
  const candidateTerms = [food.displayName, ...food.aliases]
    .map(normalizeForPairing)
    .filter((term) => term.length >= 3)
  return candidateTerms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`).test(productText))
}

function isPairingContext(context: SmartContextInput | PairingContext): context is PairingContext {
  return 'result' in context
}

function evidenceTypeFromSource(sourceKind: AnalysisResult['nutrients']['fiber']['sourceKind']) {
  if (sourceKind === 'label' || sourceKind === 'user') return 'observed' as const
  if (sourceKind === 'database') return 'retrieved' as const
  if (sourceKind === 'calculated') return 'derived' as const
  return 'unavailable' as const
}

function categoryForRule(ruleId: string): PairingInsightCategory {
  if (ruleId.includes('fiber')) return 'fiber'
  if (ruleId.includes('protein') || ruleId.includes('fat')) return 'protein_fat'
  if (ruleId.includes('food-order')) return 'food_order'
  if (ruleId.includes('sugar') || ruleId.includes('ingredient') || ruleId.includes('qualitative')) return 'ingredients'
  if (ruleId.includes('movement')) return 'movement'
  return 'data_quality'
}

function emptyNutrients(): PortionNutrients {
  return {
    totalCarbohydrate: null,
    fiber: null,
    totalSugars: null,
    addedSugars: null,
    sugarAlcohols: null,
    protein: null,
    fat: null,
  }
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

function categoryForVariant(variant: SugarVariant): SmartContextFlagCategory {
  const text = `${variant.rawSpan} ${variant.canonicalName} ${variant.category}`.toLowerCase()
  if (/\b(?:high[-\s]?fructose\s+corn\s+syrup|hfcs|glucose[-\s]?fructose\s+syrup)\b/.test(text)) return 'hfcs'
  if (/\bmaltodextrin\b/.test(text)) return 'maltodextrin'
  if (/\b(?:sorbitol|xylitol|erythritol|maltitol|mannitol|isomalt|lactitol|polyol|sugar alcohol)\b/.test(text)) return 'polyol'
  if (/\bstarch\b/.test(text)) return 'starch'
  return 'sugar_alias'
}

function categoryLabel(category: SmartContextFlagCategory): string {
  switch (category) {
    case 'hfcs': return 'High-fructose corn syrup'
    case 'maltodextrin': return 'Maltodextrin'
    case 'starch': return 'Starch ingredient'
    case 'polyol': return 'Polyol / sugar alcohol'
    case 'high_intensity_sweetener': return 'High-intensity sweetener'
    case 'processing_marker': return 'Processing marker'
    case 'curated_demo': return 'Curated demo tag'
    case 'sugar_alias': return 'Sugar alias'
  }
}

function addFlag(flags: SmartContextFlag[], seen: Set<string>, flag: SmartContextFlag) {
  const key = `${flag.category}:${flag.label.toLowerCase()}`
  if (seen.has(key)) return
  seen.add(key)
  flags.push(flag)
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
    .map((variant) => `${variant.rawSpan} at #${variant.ingredientRank}`)
  return variants.length > named.length ? `${joinHuman(named)}, plus ${variants.length - named.length} more` : joinHuman(named)
}

function joinHuman(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function normalizeForPairing(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function randomComponentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `pairing-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sortInsights(left: PairingInsight, right: PairingInsight): number {
  return left.priority - right.priority || left.id.localeCompare(right.id)
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
