import { describe, expect, it } from 'vitest'
import { calculateGl, rangeMidpoint, scaleKnown, sumKnown, summarizeLogRanges } from './nutrition'
import { classifyGlare } from '../lib/imageQuality'
import type { LogEntry } from './types'

describe('nutrition calculations', () => {
  it('preserves missing values instead of turning them into zero', () => {
    expect(scaleKnown(null, 2)).toBeNull()
    expect(sumKnown([12, null, 3])).toEqual({ total: 15, unknown: 1 })
  })

  it('calculates GL only from complete eligible inputs', () => {
    expect(calculateGl(55, 20)).toBe(11)
    expect(calculateGl(null, 20)).toBeNull()
    expect(calculateGl(55, null)).toBeNull()
  })

  it('combines exact values as fixed ranges with estimated ranges and unknown counts', () => {
    const exact = { kind: 'packaged_label', totals: { totalCarbohydrate: 10, totalSugars: 2, addedSugars: null } } as LogEntry
    const estimated = {
      kind: 'estimated_unlabeled_meal',
      totals: { totalCarbohydrate: 30, totalSugars: null, addedSugars: null },
      rangeTotals: { totalCarbohydrate: { minimum: 20, maximum: 40, unit: 'g' }, totalSugars: null, addedSugars: null },
      estimatedRecord: { unknownNutrientCounts: { totalCarbohydrate: 1 } },
    } as unknown as LogEntry

    expect(rangeMidpoint({ minimum: 20, maximum: 40, unit: 'g' })).toBe(30)
    expect(summarizeLogRanges([exact, estimated], 'totalCarbohydrate')).toEqual({
      minimum: 30, maximum: 50, midpoint: 40, unknown: 1, estimated: 1,
    })
  })
})

describe('image quality classification', () => {
  it('does not reject a white label when text detail is strong', () => {
    expect(classifyGlare(0.51, 67, 30)).toBe('warn')
  })

  it('rejects a heavily clipped image when readable detail is also missing', () => {
    expect(classifyGlare(0.85, 8, 3)).toBe('fail')
  })

  it('passes an image without significant clipping', () => {
    expect(classifyGlare(0.04, 45, 24)).toBe('pass')
  })
})
