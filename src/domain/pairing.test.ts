import { describe, expect, it } from 'vitest'
import { buildIngredientContextFlags, buildPairingInsights, smartContextFromCuratedRecord } from './pairing'
import type {
  AnalysisResult,
  CuratedFoodRecord,
  EvidenceValue,
  GlycemicEvidence,
  NutrientKey,
  SmartContextFlag,
  SugarVariant,
} from './types'

const NUTRIENT_KEYS: NutrientKey[] = [
  'totalCarbohydrate',
  'fiber',
  'totalSugars',
  'addedSugars',
  'sugarAlcohols',
  'protein',
  'fat',
]

function numericValue(value: number | null): EvidenceValue<number> {
  return {
    value,
    unit: 'g',
    servingBasis: 'per labeled serving',
    sourceKind: value == null ? 'unavailable' : 'label',
    status: value == null ? 'Unavailable' : 'Read from label',
    evidence: null,
    confidence: value == null ? null : 0.9,
    conflict: false,
    confirmed: false,
  }
}

function textValue(value: string | null): EvidenceValue<string> {
  return {
    value,
    unit: null,
    servingBasis: null,
    sourceKind: value == null ? 'unavailable' : 'label',
    status: value == null ? 'Unavailable' : 'Read from label',
    evidence: null,
    confidence: value == null ? null : 0.9,
    conflict: false,
    confirmed: false,
  }
}

function nutrients(overrides: Partial<Record<NutrientKey, number | null>> = {}): AnalysisResult['nutrients'] {
  const defaults: Record<NutrientKey, number | null> = {
    totalCarbohydrate: 22,
    fiber: 3,
    totalSugars: 7,
    addedSugars: null,
    sugarAlcohols: null,
    protein: 4,
    fat: 2,
  }
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, numericValue(key in overrides ? overrides[key] ?? null : defaults[key])]),
  ) as AnalysisResult['nutrients']
}

function glycemic(overrides: Partial<GlycemicEvidence> = {}): GlycemicEvidence {
  return {
    status: 'heuristic_demo',
    testedFoodMatchDescription: null,
    matchLevel: 'alias_heuristic',
    gi: 65,
    availableCarbohydrateGrams: 19,
    gl: 12.4,
    glBand: 'yellow',
    citation: null,
    licensing: null,
    reason: 'Heuristic demo only.',
    ...overrides,
  }
}

function variant(overrides: Partial<SugarVariant> = {}): SugarVariant {
  return {
    rawSpan: 'sugar',
    canonicalName: 'Sucrose',
    category: 'added sugar',
    ingredientRank: 2,
    evidence: null,
    ...overrides,
  }
}

function result({
  nutrientOverrides,
  glycemicOverrides,
  sugarVariants = [],
  rawIngredients = 'Oats, salt',
}: {
  nutrientOverrides?: Partial<Record<NutrientKey, number | null>>
  glycemicOverrides?: Partial<GlycemicEvidence>
  sugarVariants?: SugarVariant[]
  rawIngredients?: string
} = {}): AnalysisResult {
  return {
    analysisId: 'analysis-1',
    status: 'confirmed',
    market: 'PH',
    product: {
      name: textValue('Test cereal'),
      brand: textValue(null),
      barcode: textValue(null),
    },
    serving: {
      size: numericValue(30),
      unit: 'g',
      householdMeasure: null,
      servingsPerContainer: numericValue(null),
    },
    nutrients: nutrients(nutrientOverrides),
    rawIngredients: textValue(rawIngredients),
    sugarVariants,
    glycemic: glycemic(glycemicOverrides),
    qualityChecks: [],
    validationChecks: [],
    limitations: [],
    diagnostics: null,
    retakeRecommended: false,
    retakeReasons: [],
    provenance: {
      pipelineVersion: 'test',
      completedAt: '2026-08-11T00:00:00.000Z',
      externalProcessors: [],
    },
  }
}

describe('pairing insights', () => {
  it('adds food-order and movement ideas for yellow or red GL records', () => {
    const insights = buildPairingInsights({
      result: result(),
      consumedServings: 2,
      meal: 'Breakfast',
    })

    const ids = insights.map((insight) => insight.id)
    expect(ids).toContain('food-order-higher-gl')
    expect(ids).toContain('movement-yellow-red-gl')
    expect(insights.find((insight) => insight.id === 'movement-yellow-red-gl')?.body).not.toMatch(/prevent|fix/i)
    expect(insights.find((insight) => insight.id === 'food-order-higher-gl')?.actionChips).toContain('Vegetables first')
  })

  it('suggests fiber additions for high-carb low-fiber context', () => {
    const insights = buildPairingInsights({
      result: result({
        nutrientOverrides: {
          totalCarbohydrate: 31,
          fiber: 1,
          protein: 9,
          fat: 7,
          totalSugars: 3,
        },
        glycemicOverrides: { gl: null, glBand: null, status: 'unavailable' },
      }),
    })

    expect(insights.map((insight) => insight.id)).toContain('fiber-anchor')
    expect(insights.find((insight) => insight.id === 'fiber-anchor')?.body).toMatch(/chia|ground flax|vegetables/i)
  })

  it('flags high sugar without treating missing added sugar as zero', () => {
    const insights = buildPairingInsights({
      result: result({
        nutrientOverrides: {
          totalCarbohydrate: 24,
          fiber: 4,
          totalSugars: 13,
          addedSugars: null,
          protein: 8,
          fat: 6,
        },
      }),
    })

    const sugarInsight = insights.find((insight) => insight.id === 'sugar-context')
    expect(sugarInsight).toBeDefined()
    expect(sugarInsight?.evidenceLabels).toContain('Added sugars unknown')
  })

  it('flags notable sugar variants and processing markers from ingredients', () => {
    const insights = buildPairingInsights({
      result: result({
        sugarVariants: [
          variant(),
          variant({ rawSpan: 'maltodextrin', canonicalName: 'Maltodextrin', category: 'carbohydrate ingredient', ingredientRank: 3 }),
        ],
        rawIngredients: 'Oats, sugar, maltodextrin, modified corn starch, artificial flavor',
      }),
    })

    expect(insights.map((insight) => insight.id)).toContain('ingredient-sugar-variants')
    expect(insights.map((insight) => insight.id)).toContain('ingredient-processing-markers')
  })

  it('builds first-class ingredient context flags without rating language', () => {
    const flags = buildIngredientContextFlags(result({
      sugarVariants: [
        variant({ rawSpan: 'high fructose corn syrup', canonicalName: 'High-fructose corn syrup', category: 'added sugar', ingredientRank: 2 }),
        variant({ rawSpan: 'maltodextrin', canonicalName: 'Maltodextrin', category: 'carbohydrate ingredient', ingredientRank: 3 }),
      ],
      rawIngredients: 'Corn, high fructose corn syrup, maltodextrin, modified corn starch, xylitol, sucralose, artificial flavor',
    }))

    expect(flags.map((flag) => flag.category)).toEqual(expect.arrayContaining([
      'hfcs',
      'maltodextrin',
      'starch',
      'polyol',
      'high_intensity_sweetener',
      'processing_marker',
    ]))
    expect(flags.map((flag) => `${flag.label} ${flag.detail}`).join(' ')).not.toMatch(/safe|unsafe|diabetic-friendly/i)
  })

  it('returns data-quality guidance when carbohydrate data is incomplete', () => {
    const insights = buildPairingInsights({
      result: result({
        nutrientOverrides: {
          totalCarbohydrate: null,
          fiber: null,
          totalSugars: null,
          protein: null,
          fat: null,
        },
        glycemicOverrides: { gl: null, glBand: null, status: 'unavailable' },
      }),
    })

    expect(insights[0].id).toBe('data-carbs-missing')
    expect(insights.map((insight) => insight.id)).not.toContain('fiber-anchor')
  })

  it('recomputes deterministically for saved record inputs', () => {
    const savedContext = {
      result: result({ sugarVariants: [variant()] }),
      consumedServings: 1.5,
      meal: 'Snack' as const,
    }

    expect(buildPairingInsights(savedContext)).toEqual(buildPairingInsights({ ...savedContext }))
  })

  it('creates qualitative Smart Context for curated unlabeled demo records without numeric GI or GL', () => {
    const record: CuratedFoodRecord = {
      kind: 'curated_unlabeled_demo',
      status: 'confirmed',
      recordId: 'record-1',
      foodId: 'ph_pandesal',
      market: 'PH',
      displayName: 'Pandesal',
      selectedPortionLabel: '1 piece',
      notes: null,
      qualitativeTags: ['bread', 'portion-sensitive'],
      contextFlags: [
        {
          id: 'tag-bread',
          label: 'bread',
          category: 'curated_demo',
          detail: 'Curated catalog descriptor only.',
          evidenceLabels: ['Curated demo catalog'],
        },
      ] satisfies SmartContextFlag[],
      glycemic: {
        status: 'unavailable',
        testedFoodMatchDescription: null,
        matchLevel: null,
        gi: null,
        availableCarbohydrateGrams: null,
        gl: null,
        glBand: null,
        citation: null,
        licensing: null,
        reason: 'Curated demo only.',
      },
      limitations: ['No authoritative calories, macros, GI, or GL.'],
      provenance: {
        pipelineVersion: 'test',
        completedAt: '2026-08-11T00:00:00.000Z',
        externalProcessors: [],
      },
    }

    const input = smartContextFromCuratedRecord(record, 'Snack')
    const insights = buildPairingInsights(input)

    expect(input.kind).toBe('curated_unlabeled_demo')
    expect(input.nutrients.totalCarbohydrate).toBeNull()
    expect(input.glycemic.gl).toBeNull()
    expect(insights[0].id).toBe('curated-demo-boundary')
    expect(insights[0].actionChips).toContain('Confirm portion')
    expect(insights.map((insight) => insight.body).join(' ')).not.toMatch(/diabetic-friendly|guaranteed|prevent spikes/i)
  })
})
