import { describe, expect, it } from 'vitest'
import type { ImageQualityReport } from '../../domain/types'
import {
  formatNovaGroup,
  formatNutriScoreGrade,
  getNovaPresentation,
  imageQualitySummary,
  marketLabel,
  reviewStatusLabel,
  scanSetupState,
} from './uiDisplay'

function report(statuses: Array<'pass' | 'warn' | 'fail'>): ImageQualityReport {
  return {
    width: 1200,
    height: 900,
    canSubmit: !statuses.includes('fail'),
    checks: statuses.map((status, index) => ({
      code: `${status}-${index}`,
      label: `${status} check`,
      status,
      detail: `${status} detail`,
    })),
  }
}

describe('mvp UI display helpers', () => {
  it('summarizes image quality into one user-facing state', () => {
    expect(imageQualitySummary(report(['pass'])).message).toBe('Image quality looks good')
    expect(imageQualitySummary(report(['pass', 'warn']))).toMatchObject({
      tone: 'warning',
      message: 'Photo is usable, but confirm carefully',
      details: ['warn detail'],
    })
    expect(imageQualitySummary(report(['fail', 'warn']))).toMatchObject({
      tone: 'fail',
      message: 'Photo needs attention',
      details: ['fail detail'],
    })
  })

  it('uses consumer labels for markets, review statuses, and scan state', () => {
    expect(marketLabel('PH')).toBe('Philippines')
    expect(marketLabel('US')).toBe('United States')
    expect(reviewStatusLabel('ready')).toBe('Ready to review')
    expect(reviewStatusLabel('partial')).toBe('Needs review')
    expect(reviewStatusLabel('confirmed')).toBe('User confirmed')
    expect(scanSetupState({ hasEvidence: false, canAnalyze: false, analyzing: false, fails: 0, warnings: 0 }).label).toBe('Evidence needed')
    expect(scanSetupState({ hasEvidence: true, canAnalyze: true, analyzing: false, fails: 0, warnings: 0 }).label).toBe('Ready to analyze')
    expect(scanSetupState({ hasEvidence: true, canAnalyze: false, analyzing: false, fails: 1, warnings: 0 }).label).toBe('Needs attention')
    expect(scanSetupState({ hasEvidence: true, canAnalyze: false, analyzing: true, fails: 0, warnings: 0 }).label).toBe('Analyzing')
  })

  it('normalizes NOVA groups without rendering malformed metadata', () => {
    expect(formatNovaGroup('1 - Unprocessed or minimally processed foods')).toBe('NOVA 1 · Unprocessed or minimally processed foods')
    expect(formatNovaGroup('2 - Processed culinary ingredients')).toBe('NOVA 2 · Processed culinary ingredients')
    expect(formatNovaGroup('3 - Aliments transformés', 'en:3-processed-foods')).toBe('NOVA 3 · Processed foods')
    expect(formatNovaGroup('4 - Produits alimentaires et boissons ultra-transformés')).toBe('NOVA 4 · Ultra-processed')
    expect(getNovaPresentation(null, null)).toBeNull()
    expect(getNovaPresentation('Not applicable', 'unknown')).toBeNull()
    expect(getNovaPresentation('not a group', 'en:4-ultra-processed-food-and-drink-products')).toMatchObject({
      group: 4,
      label: 'Ultra-processed',
    })
  })

  it('normalizes Nutri-Score grades and rejects unknown values', () => {
    expect(['a', 'B', 'c', 'D', 'e'].map(formatNutriScoreGrade)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(formatNutriScoreGrade(null)).toBeNull()
    expect(formatNutriScoreGrade('not-applicable')).toBeNull()
    expect(formatNutriScoreGrade('z')).toBeNull()
    expect(formatNutriScoreGrade('Grade D')).toBeNull()
  })
})
