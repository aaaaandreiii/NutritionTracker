import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AnalysisResult, EvidenceValue, FieldStatus, SourceKind } from '../../domain/types'
import EvidenceReview from './EvidenceReview'

function evidenceValue<T>(
  value: T | null,
  {
    unit = null,
    sourceKind = 'user',
    status = 'User confirmed',
  }: {
    unit?: string | null
    sourceKind?: SourceKind
    status?: FieldStatus
  } = {},
): EvidenceValue<T> {
  return {
    value,
    unit,
    servingBasis: null,
    sourceKind,
    status,
    evidence: null,
    confidence: null,
    conflict: false,
    confirmed: status === 'User confirmed',
  }
}

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  const base: AnalysisResult = {
    analysisId: 'analysis-context-test',
    status: 'confirmed',
    market: 'PH',
    product: {
      name: evidenceValue('Context test crackers'),
      brand: evidenceValue('Test Brand'),
      barcode: evidenceValue('4800000000000', { sourceKind: 'database', status: 'Database match' }),
    },
    serving: {
      size: evidenceValue(25, { unit: 'g' }),
      unit: 'g',
      householdMeasure: null,
      servingsPerContainer: evidenceValue<number>(null),
    },
    nutrients: {
      totalCarbohydrate: evidenceValue(18, { unit: 'g' }),
      fiber: evidenceValue(1, { unit: 'g' }),
      totalSugars: evidenceValue(4, { unit: 'g' }),
      addedSugars: evidenceValue<number>(null, { unit: 'g', status: 'Unavailable', sourceKind: 'unavailable' }),
      sugarAlcohols: evidenceValue<number>(null, { unit: 'g', status: 'Unavailable', sourceKind: 'unavailable' }),
      protein: evidenceValue(2, { unit: 'g' }),
      fat: evidenceValue(3, { unit: 'g' }),
    },
    rawIngredients: evidenceValue('', { sourceKind: 'user' }),
    sugarVariants: [],
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
      reason: 'No tested product-specific glycemic-index data found.',
    },
    qualityChecks: [],
    validationChecks: [],
    limitations: [],
    diagnostics: null,
    retakeRecommended: false,
    retakeReasons: [],
    externalMetadata: null,
    provenance: {
      pipelineVersion: 'test',
      completedAt: '2026-08-14T00:00:00Z',
      externalProcessors: [],
    },
  }
  return { ...base, ...overrides }
}

function renderContext(result: AnalysisResult): string {
  return renderToStaticMarkup(
    <EvidenceReview
      result={result}
      images={{}}
      onBack={() => undefined}
      onLogged={() => undefined}
    />,
  )
}

describe('EvidenceReview Context metadata', () => {
  it('renders controlled snack pairing ideas in Context for cracker snacks', () => {
    const html = renderContext(result({
      product: {
        ...result().product,
        name: evidenceValue('SkyFlakes'),
      },
      serving: {
        ...result().serving,
        size: evidenceValue(25, { unit: 'g' }),
      },
      nutrients: {
        ...result().nutrients,
        totalCarbohydrate: evidenceValue(17, { unit: 'g' }),
        fiber: evidenceValue(1, { unit: 'g' }),
        totalSugars: evidenceValue(2, { unit: 'g' }),
        addedSugars: evidenceValue(0, { unit: 'g' }),
        protein: evidenceValue(3, { unit: 'g' }),
        fat: evidenceValue(5, { unit: 'g' }),
      },
      rawIngredients: evidenceValue('Wheat flour, vegetable oil, sugar, salt', { sourceKind: 'user' }),
    }))

    expect(html).toContain('Pair with this snack')
    expect(html).toContain('A few ideas to have alongside it')
    expect(html).toContain('Peanut butter')
    expect(html).toContain('Plain yogurt')
    expect(html).toContain('Cheese')
    expect(html).toContain('Whole fruit')
    expect(html).toContain('They do not change the nutrition values of SkyFlakes 25 g')
    expect(html).not.toMatch(/prevents?|blood sugar|glucose spikes|stabilizes glucose|diabetes-friendly|safe for diabetes/i)
  })

  it('omits snack pairing ideas when product category is unknown', () => {
    const html = renderContext(result({
      product: {
        ...result().product,
        name: evidenceValue('Uncategorized pantry item'),
      },
      rawIngredients: evidenceValue('', { sourceKind: 'user' }),
    }))

    expect(html).not.toContain('Pair with this snack')
    expect(html).not.toContain('Peanut butter')
    expect(html).not.toContain('Plain yogurt')
  })

  it('renders NOVA in processing context and Nutri-Score as external metadata', () => {
    const html = renderContext(result({
      rawIngredients: evidenceValue('Wheat flour, Maltodextrin, Sugar', { sourceKind: 'user' }),
      sugarVariants: [
        { rawSpan: 'Maltodextrin', canonicalName: 'Maltodextrin', category: 'maltodextrin', ingredientRank: 2, evidence: null },
        { rawSpan: 'Sugar', canonicalName: 'Sucrose', category: 'sugar_alias', ingredientRank: 3, evidence: null },
      ],
      externalMetadata: {
        novaGroup: '4 - Ultra processed food and drink products',
        novaGroupsTags: 'en:4-ultra-processed-food-and-drink-products',
        nutriscoreGrade: 'd',
        nutriscoreScore: 7,
        sourceName: 'Open Food Facts',
        sourceUrl: 'https://world.openfoodfacts.org/product/4800000000000',
        sourceKind: 'local_open_food_facts',
      },
    }))

    expect(html).toContain('Smart Context')
    expect(html).toContain('Processing context')
    expect(html).toContain('NOVA 4')
    expect(html).toContain('Ultra-processed')
    expect(html).toContain('does not predict your individual glucose response')
    expect(html).toContain('Sugar detected')
    expect(html).toContain('External metadata')
    expect(html).toContain('Nutri-Score · Grade D')
    expect(html).toContain('not a diabetes or glucose-response score')
    expect(html).toContain('Source: Open Food Facts')
    expect(html).not.toContain('NOVA score')
    expect(html).not.toContain('Diabetes score')
  })

  it('collapses cleanly when NOVA and Nutri-Score are missing', () => {
    const html = renderContext(result())

    expect(html).not.toContain('NOVA classification')
    expect(html).not.toContain('Community database metadata')
    expect(html).not.toContain('Nutri-Score')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
  })
})
