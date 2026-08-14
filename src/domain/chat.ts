import { isPackagedLabelLog } from './logs'
import type { ChatProductContext, ChatThread, LogEntry, NutrientKey } from './types'

const NUTRIENT_KEYS: NutrientKey[] = [
  'totalCarbohydrate',
  'fiber',
  'totalSugars',
  'addedSugars',
  'sugarAlcohols',
  'protein',
  'fat',
]

export function productContextFromLog(entry: LogEntry): ChatProductContext | null {
  if (!isPackagedLabelLog(entry) || entry.result.status !== 'confirmed') return null
  const result = entry.result
  const size = result.serving.size.value
  const servingLabel = size == null
    ? null
    : `${size} ${result.serving.unit ?? result.serving.size.unit ?? ''}`.trim()
  return {
    localLogId: entry.id,
    productName: entry.productName,
    brand: result.product.brand.value,
    market: result.market,
    servingLabel,
    barcode: result.product.barcode.value,
    nutrients: Object.fromEntries(
      NUTRIENT_KEYS.map((key) => [key, result.nutrients[key].value]),
    ) as ChatProductContext['nutrients'],
    ingredients: result.rawIngredients.value,
    sugarVariants: result.sugarVariants.map((variant) => variant.canonicalName),
    glycemicStatus: result.glycemic.status,
    glycemicReason: result.glycemic.reason,
  }
}

export function automaticThreadTitle(question: string): string {
  const normalized = question.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 52) return normalized
  return `${normalized.slice(0, 49).trimEnd()}…`
}

export function createChatThread(context: ChatProductContext | null = null): ChatThread {
  const now = new Date().toISOString()
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: 'New question',
    createdAt: now,
    updatedAt: now,
    context,
    messages: [],
  }
}

export function citationIndexes(markdown: string): number[] {
  const matches = markdown.matchAll(/\[(\d+)]\(#source-(\d+)\)/g)
  return [...new Set(
    Array.from(matches)
      .filter((match) => match[1] === match[2])
      .map((match) => Number(match[1])),
  )]
}

export function citationIndexFromHref(href: string | undefined): number | null {
  const match = href?.match(/^#source-(\d+)$/)
  return match ? Number(match[1]) : null
}
