import { describe, expect, it } from 'vitest'
import { calculateGl, scaleKnown, sumKnown } from './nutrition'
import { classifyGlare } from '../lib/imageQuality'

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
