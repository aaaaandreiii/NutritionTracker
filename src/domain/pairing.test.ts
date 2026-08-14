import { describe, expect, it } from 'vitest'
import {
  buildIngredientContextFlags,
  buildMealPairingSuggestions,
  buildPairingInsights,
  createPairingMealComponent,
  smartContextFromCuratedRecord,
} from './pairing'
import type {
  AnalysisResult,
  CuratedFoodCandidate,
  CuratedFoodRecord,
  EvidenceValue,
  GlycemicEvidence,
  MealPairingComponent,
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
  productName = 'Test cereal',
}: {
  nutrientOverrides?: Partial<Record<NutrientKey, number | null>>
  glycemicOverrides?: Partial<GlycemicEvidence>
  sugarVariants?: SugarVariant[]
  rawIngredients?: string
  productName?: string
} = {}): AnalysisResult {
  return {
    analysisId: 'analysis-1',
    status: 'confirmed',
    market: 'PH',
    product: {
      name: textValue(productName),
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

function catalogFood(
  foodId: string,
  displayName: string,
  aliases: string[],
  qualitativeTags: string[] = ['companion food'],
  confidence: number | null = null,
): CuratedFoodCandidate {
  return {
    foodId,
    displayName,
    market: 'PH',
    aliases,
    portionLabels: ['user-described portion'],
    qualitativeTags,
    limitations: ['Qualitative curated record only.'],
    matchReason: null,
    confidence,
  }
}

function companionCatalog(overrides: CuratedFoodCandidate[] = []): CuratedFoodCandidate[] {
  return [
    catalogFood('ph_gulay_side', 'Vegetable side / gulay', ['gulay', 'vegetable side', 'vegetables']),
    catalogFood('ph_ginisang_monggo', 'Ginisang monggo', ['monggo', 'mung beans', 'beans']),
    catalogFood('ph_boiled_egg', 'Boiled egg', ['boiled egg', 'egg', 'itlog']),
    catalogFood('ph_tokwa', 'Tokwa / tofu', ['tokwa', 'tofu']),
    catalogFood('ph_grilled_fish', 'Grilled fish', ['grilled fish', 'isda', 'fish']),
    catalogFood('ph_plain_yogurt', 'Plain unsweetened yogurt', ['plain yogurt', 'unsweetened yogurt']),
    catalogFood('ph_unsweetened_peanut_butter', 'Unsweetened peanut butter', ['peanut butter']),
    catalogFood('ph_chia_ground_flax', 'Chia or ground flax', ['chia', 'ground flax']),
    ...overrides,
  ]
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

  it('recommends catalog-resolved companion foods for packaged crackers without changing product nutrients', () => {
    const scanned = result({
      productName: 'SkyFlakes Crackers',
      nutrientOverrides: {
        totalCarbohydrate: 17,
        fiber: 1,
        protein: 3,
        totalSugars: 2,
        addedSugars: null,
      },
      rawIngredients: 'Wheat flour, vegetable oil, sugar, salt',
    })
    const before = structuredClone(scanned.nutrients)
    const suggestions = buildMealPairingSuggestions({ result: scanned, consumedServings: 1, meal: 'Snack' }, companionCatalog())

    expect(suggestions.map((suggestion) => suggestion.foodId)).toEqual(expect.arrayContaining([
      'ph_boiled_egg',
      'ph_gulay_side',
      'ph_ginisang_monggo',
    ]))
    expect(suggestions).toHaveLength(3)
    expect(scanned.nutrients).toEqual(before)
    expect(suggestions.every((suggestion) => companionCatalog().some((food) => food.foodId === suggestion.foodId))).toBe(true)
  })

  it('suggests bread complements rather than another bread catalog item', () => {
    const suggestions = buildMealPairingSuggestions({
      result: result({
        productName: 'Gardenia White Bread',
        nutrientOverrides: {
          totalCarbohydrate: 24,
          fiber: 1,
          protein: 4,
          totalSugars: 3,
        },
      }),
    }, companionCatalog([
      catalogFood('ph_pandesal', 'Pandesal', ['pandesal', 'bread roll'], ['bread']),
    ]))

    expect(suggestions.map((suggestion) => suggestion.foodId)).not.toContain('ph_pandesal')
    expect(suggestions.some((suggestion) => suggestion.reasonCodes.includes('ADD_PROTEIN_SOURCE'))).toBe(true)
  })

  it('does not recommend another beverage for a sweet beverage context', () => {
    const suggestions = buildMealPairingSuggestions({
      result: result({
        productName: 'Sweetened iced tea drink',
        nutrientOverrides: {
          totalCarbohydrate: 26,
          fiber: 0,
          protein: 0,
          totalSugars: 24,
          addedSugars: null,
        },
      }),
    }, companionCatalog([
      catalogFood('ph_sweet_drink', 'Another sweet drink', ['drink', 'juice'], ['beverage']),
    ]))

    expect(suggestions.map((suggestion) => suggestion.foodId)).not.toContain('ph_sweet_drink')
    expect(suggestions.map((suggestion) => suggestion.displayName).join(' ')).not.toMatch(/drink|juice|soda/i)
  })

  it('does not add protein recommendations for an already high-protein packaged food', () => {
    const suggestions = buildMealPairingSuggestions({
      result: result({
        productName: 'Tuna protein pack',
        nutrientOverrides: {
          totalCarbohydrate: 5,
          fiber: null,
          protein: 20,
          totalSugars: 1,
          addedSugars: null,
        },
      }),
    }, companionCatalog())

    expect(suggestions.some((suggestion) => suggestion.reasonCodes.includes('ADD_PROTEIN_SOURCE'))).toBe(false)
  })

  it('keeps fiber unknown distinct from confirmed zero in recommendation evidence and copy', () => {
    const unknownFiber = buildMealPairingSuggestions({
      result: result({
        productName: 'Plain crackers',
        nutrientOverrides: {
          totalCarbohydrate: 18,
          fiber: null,
          protein: 3,
        },
      }),
    }, companionCatalog())
    const zeroFiber = buildMealPairingSuggestions({
      result: result({
        productName: 'Plain crackers',
        nutrientOverrides: {
          totalCarbohydrate: 18,
          fiber: 0,
          protein: 3,
        },
      }),
    }, companionCatalog())

    expect(unknownFiber.map((suggestion) => `${suggestion.reason} ${suggestion.evidenceLabels.join(' ')}`).join(' ')).toMatch(/Fiber not reported|fiber was not reported/i)
    expect(unknownFiber.map((suggestion) => suggestion.evidenceLabels.join(' ')).join(' ')).not.toMatch(/Fiber 0 g/)
    expect(zeroFiber.map((suggestion) => suggestion.evidenceLabels.join(' ')).join(' ')).toMatch(/Fiber 0 g/)
  })

  it('does not treat unknown added sugars as high or zero', () => {
    const suggestions = buildMealPairingSuggestions({
      result: result({
        productName: 'Neutral snack',
        nutrientOverrides: {
          totalCarbohydrate: 8,
          fiber: 2,
          protein: 8,
          totalSugars: 2,
          addedSugars: null,
        },
      }),
    }, companionCatalog())

    expect(suggestions).toEqual([])
  })

  it('returns no fabricated suggestions for sparse product data', () => {
    const suggestions = buildMealPairingSuggestions({
      result: result({
        productName: 'Sparse database product',
        nutrientOverrides: {
          totalCarbohydrate: null,
          fiber: null,
          protein: null,
          totalSugars: null,
          addedSugars: null,
        },
      }),
    }, companionCatalog())

    expect(suggestions).toEqual([])
  })

  it('suppresses untrusted, low-confidence, and same-family candidates', () => {
    const suggestions = buildMealPairingSuggestions({
      result: result({
        productName: 'Egg crackers',
        nutrientOverrides: {
          totalCarbohydrate: 18,
          fiber: 1,
          protein: 2,
        },
      }),
    }, [
      catalogFood('ph_boiled_egg', 'Boiled egg', ['boiled egg', 'egg'], ['protein context']),
      catalogFood('ph_gulay_side', 'Vegetable side / gulay', ['vegetables'], ['fiber source'], 0.4),
      catalogFood('invented_food', 'Invented food', ['invented'], ['protein context']),
    ])

    expect(suggestions).toEqual([])
  })

  it('creates a separate context-only meal component for a selected pairing', () => {
    const scanned = result({
      productName: 'SkyFlakes Crackers',
      nutrientOverrides: {
        totalCarbohydrate: 17,
        fiber: 1,
        protein: 3,
      },
    })
    const productProtein = scanned.nutrients.protein.value
    const [suggestion] = buildMealPairingSuggestions({ result: scanned }, companionCatalog())
    const component: MealPairingComponent = createPairingMealComponent(suggestion, 'component-1')

    expect(component).toMatchObject({
      componentId: 'component-1',
      type: 'curated_generic_food',
      foodId: suggestion.foodId,
      contextOnly: true,
      nutrientBasis: null,
    })
    expect(scanned.nutrients.protein.value).toBe(productProtein)
  })

  it('does not generate unsupported glucose-response claims', () => {
    const suggestions = buildMealPairingSuggestions({
      result: result({
        productName: 'Sweet snack bar',
        nutrientOverrides: {
          totalCarbohydrate: 28,
          fiber: 1,
          protein: 2,
          totalSugars: 16,
          addedSugars: null,
        },
      }),
    }, companionCatalog())
    const copy = suggestions.map((suggestion) => `${suggestion.label} ${suggestion.reason} ${suggestion.evidenceLabels.join(' ')}`).join(' ')

    expect(copy).not.toMatch(/prevents?|blood sugar|glucose|spike|lower|stabil/i)
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
