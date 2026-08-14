import { describe, expect, it } from 'vitest'
import type { AnalysisResult } from './types'
import { createInitialScanSession, scanWorkflowStep } from './scanSession'

describe('label workflow progress', () => {
  it('moves from identify to evidence to review and context', () => {
    const initial = createInitialScanSession()
    expect(scanWorkflowStep(initial)).toBe(0)
    expect(scanWorkflowStep({ ...initial, barcode: '4800000000000' })).toBe(1)
    expect(scanWorkflowStep({
      ...initial,
      barcode: '4800000000000',
      barcodeLookup: {
        barcode: '4800000000000',
        market: 'PH',
        status: 'found',
        complete: true,
        missingFields: [],
        product: null,
        ingredients: null,
        qualitativeMarkers: null,
        sourceUrl: null,
        sourceKind: 'local_open_food_facts',
        message: 'A complete local product match is available.',
      },
    })).toBe(0)
    expect(scanWorkflowStep({ ...initial, result: { status: 'ready' } as AnalysisResult })).toBe(2)
    expect(scanWorkflowStep({ ...initial, result: { status: 'confirmed' } as AnalysisResult })).toBe(3)
  })
})
