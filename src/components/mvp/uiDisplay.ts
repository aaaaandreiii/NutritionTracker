import type { AnalysisResult, AnalysisStageEvent, ImageQualityReport, Market, SmartContextResponse } from '../../domain/types'

export function marketLabel(market: Market | string | null | undefined): string {
  if (market === 'PH') return 'Philippines'
  if (market === 'US') return 'United States'
  return market || 'Market unavailable'
}

export function reviewStatusLabel(status: AnalysisResult['status'] | string | undefined): string {
  if (status === 'confirmed') return 'User confirmed'
  if (status === 'ready') return 'Ready to review'
  if (status === 'partial') return 'Needs review'
  return 'Needs review'
}

export function scanSetupState({
  hasEvidence,
  canAnalyze,
  analyzing,
  fails,
  warnings,
  resultStatus,
}: {
  hasEvidence: boolean
  canAnalyze: boolean
  analyzing: boolean
  fails: number
  warnings: number
  resultStatus?: AnalysisResult['status'] | null
}): { label: string; tone: 'neutral' | 'ready' | 'warning' | 'busy' } {
  if (resultStatus) return { label: resultStatus === 'confirmed' ? 'Ready to log' : 'Ready to review', tone: 'ready' }
  if (analyzing) return { label: 'Analyzing', tone: 'busy' }
  if (fails > 0) return { label: 'Needs attention', tone: 'warning' }
  if (canAnalyze) return { label: warnings > 0 ? 'Ready with notes' : 'Ready to analyze', tone: 'ready' }
  if (hasEvidence) return { label: 'Evidence added', tone: warnings > 0 ? 'warning' : 'neutral' }
  return { label: 'Evidence needed', tone: 'neutral' }
}

export function imageQualitySummary(report?: ImageQualityReport): {
  tone: 'pending' | 'good' | 'warning' | 'fail'
  message: string
  details: string[]
} {
  if (!report) return { tone: 'pending', message: 'Checking image quality...', details: [] }
  const failed = report.checks.filter((check) => check.status === 'fail')
  const warned = report.checks.filter((check) => check.status === 'warn')
  if (failed.length > 0) {
    return {
      tone: 'fail',
      message: 'Photo needs attention',
      details: failed.map((check) => check.detail || check.label),
    }
  }
  if (warned.length > 0) {
    return {
      tone: 'warning',
      message: 'Photo is usable, but confirm carefully',
      details: warned.map((check) => check.detail || check.label),
    }
  }
  return { tone: 'good', message: 'Image quality looks good', details: [] }
}

export function consumerPipelineStageLabel(stageId: string): string {
  switch (stageId) {
    case 'image_check': return 'Checking photo'
    case 'barcode_lookup': return 'Checking barcode'
    case 'label_extraction': return 'Reading label'
    case 'ingredient_classification': return 'Checking ingredients'
    case 'evidence_assembly': return 'Preparing evidence'
    case 'safety_validation': return 'Checking the result'
    case 'nutrition_matching': return 'Matching foods'
    case 'meal_detection': return 'Finding meal components'
    default: return stageId.replaceAll('_', ' ')
  }
}

export function consumerStageStatus(event?: AnalysisStageEvent): string {
  if (!event) return 'Waiting'
  if (event.status === 'running') return 'In progress'
  if (event.status === 'complete') return 'Complete'
  if (event.status === 'skipped') return 'Skipped'
  if (event.status === 'failed') return 'Needs attention'
  return 'Waiting'
}

export function normalizeIngredientDisplay(value: string | null | undefined): string {
  if (!value) return ''
  const preservedAcronyms = new Set(['BHA', 'BHT', 'MSG', 'TBHQ'])
  return value
    .replace(/_([^_]+)_/g, (_, allergen: string) => allergen.toLowerCase())
    .replace(/\b[A-Z]{2,}\b/g, (word) => preservedAcronyms.has(word) ? word : word.toLowerCase())
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\s*\[\s*/g, ' [')
    .replace(/\s*\]\s*/g, '] ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[a-z]/, (letter) => letter.toUpperCase())
}

export function normalizeNameDisplay(value: string | null | undefined, fallback = 'Product'): string {
  const cleaned = (value || fallback)
    .replace(/\s+/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*(g|kg|mg|ml|l)\b/gi, (_, amount: string, unit: string) => `${amount} ${unit.toLowerCase()}`)
    .replace(/\bsky\s*flakes\b/gi, 'SkyFlakes')
    .trim()
  if (!cleaned) return fallback
  if (/[a-z]/.test(cleaned) && /[A-Z]/.test(cleaned.replace(/\b(SkyFlakes)\b/g, ''))) return cleaned
  return cleaned.replace(/\b([a-z])([a-z'’-]*)/gi, (word) => {
    if (/^(g|kg|mg|ml|l)$/i.test(word)) return word.toLowerCase()
    if (/^SkyFlakes$/i.test(word)) return 'SkyFlakes'
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}

const NOVA_LABELS = {
  1: 'Unprocessed or minimally processed foods',
  2: 'Processed culinary ingredients',
  3: 'Processed foods',
  4: 'Ultra-processed',
} as const

export type NovaPresentation = {
  group: 1 | 2 | 3 | 4
  badge: string
  label: string
  fullLabel: string
}

function metadataString(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (!text) return null
  const normalized = text.toLowerCase()
  if (['-', 'unknown', 'null', 'none', 'nan', 'not applicable', 'not-applicable'].includes(normalized)) return null
  return text
}

function novaGroupNumber(value: unknown): 1 | 2 | 3 | 4 | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4) {
    return value as 1 | 2 | 3 | 4
  }
  const text = metadataString(value)
  if (!text) return null
  const normalized = text.toLowerCase()
  const patterns = [
    /^\s*([1-4])(?:\b|\s*-)/,
    /\ben:([1-4])[-_\s]/,
    /\bgroup\s*([1-4])\b/,
    /\bnova\s*([1-4])\b/,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) return Number(match[1]) as 1 | 2 | 3 | 4
  }
  return null
}

export function getNovaPresentation(value: unknown, tags?: unknown): NovaPresentation | null {
  const group = novaGroupNumber(value) ?? novaGroupNumber(tags)
  if (!group) return null
  const fullLabel = NOVA_LABELS[group]
  return {
    group,
    badge: `NOVA ${group}`,
    label: group === 4 ? 'Ultra-processed' : fullLabel,
    fullLabel,
  }
}

export function formatNovaGroup(value: unknown, tags?: unknown): string | null {
  const presentation = getNovaPresentation(value, tags)
  return presentation ? `${presentation.badge} · ${presentation.label}` : null
}

export function formatNutriScoreGrade(value: unknown): 'A' | 'B' | 'C' | 'D' | 'E' | null {
  const text = metadataString(value)
  if (!text) return null
  const grade = text.trim().toUpperCase()
  return /^[A-E]$/.test(grade) ? grade as 'A' | 'B' | 'C' | 'D' | 'E' : null
}

export function formatProductDisplayName(
  productName: string | null | undefined,
  servingSize?: number | null,
  servingUnit?: string | null,
): string {
  const base = normalizeNameDisplay(productName)
  if (servingSize == null) return base
  const serving = `${servingSize} ${(servingUnit || 'g').trim() || 'g'}`.replace(/\s+/g, ' ').trim()
  const compactServing = serving.replace(/\s+/g, '')
  const normalizedBase = base.toLowerCase()
  if (normalizedBase.includes(serving.toLowerCase()) || normalizedBase.includes(compactServing.toLowerCase())) return base
  return `${base} ${serving}`
}

export function sourceLabel(sourceKind: string | null | undefined): string {
  if (sourceKind === 'label') return 'photographed label'
  if (sourceKind === 'database') return 'product database'
  if (sourceKind === 'user') return 'user correction'
  if (sourceKind === 'calculated') return 'calculated from confirmed values'
  return 'unavailable'
}

export function formatSmartContextMode(response: SmartContextResponse | null | undefined): string {
  if (!response) return 'Smart Context unavailable'
  return response.generationMode === 'generated' ? 'Grounded writer' : 'Deterministic rules'
}
