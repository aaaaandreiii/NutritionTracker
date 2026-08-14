import { openDB } from 'idb'
import { isCuratedUnlabeledLog, isEstimatedMealLog, isPackagedLabelLog, logEntryKind, logStatusLabel } from '../domain/logs'
import type { ChatThread, LogEntry } from '../domain/types'

const DB_NAME = 'sugar-pai-research'
const STORE_NAME = 'logs'
const THREAD_STORE = 'chatThreads'

function announce(name: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name))
}

const dbPromise = openDB(DB_NAME, 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('loggedAt', 'loggedAt')
    }
    if (oldVersion < 2) {
      const threads = db.createObjectStore(THREAD_STORE, { keyPath: 'id' })
      threads.createIndex('updatedAt', 'updatedAt')
    }
  },
})

export async function saveLog(entry: LogEntry): Promise<void> {
  const db = await dbPromise
  await db.put(STORE_NAME, entry)
  announce('sugar-pai:logs-changed')
}

export async function listLogs(): Promise<LogEntry[]> {
  const db = await dbPromise
  const logs = await db.getAll(STORE_NAME)
  return logs.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
}

export async function deleteLog(id: string): Promise<void> {
  const db = await dbPromise
  await db.delete(STORE_NAME, id)
  announce('sugar-pai:logs-changed')
}

export async function deleteAllLogs(): Promise<void> {
  const db = await dbPromise
  await db.clear(STORE_NAME)
  announce('sugar-pai:logs-changed')
}

export async function saveChatThread(thread: ChatThread): Promise<void> {
  const db = await dbPromise
  await db.put(THREAD_STORE, thread)
  announce('sugar-pai:threads-changed')
}

export async function listChatThreads(): Promise<ChatThread[]> {
  const db = await dbPromise
  const threads = await db.getAll(THREAD_STORE) as ChatThread[]
  return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getChatThread(id: string): Promise<ChatThread | undefined> {
  const db = await dbPromise
  return db.get(THREAD_STORE, id) as Promise<ChatThread | undefined>
}

export async function deleteChatThread(id: string): Promise<void> {
  const db = await dbPromise
  await db.delete(THREAD_STORE, id)
  announce('sugar-pai:threads-changed')
}

export async function deleteAllChatThreads(): Promise<void> {
  const db = await dbPromise
  await db.clear(THREAD_STORE)
  announce('sugar-pai:threads-changed')
}

function download(contents: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportLogsJson(logs: LogEntry[]) {
  const withoutImages = JSON.stringify(logs, (key, value) => key === 'retainedImages' ? undefined : value, 2)
  download(withoutImages, 'application/json', 'sugar-pai-history.json')
}

export function exportLogsCsv(logs: LogEntry[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = [
    [
      'logged_at',
      'updated_at',
      'meal',
      'product',
      'kind',
      'status',
      'market',
      'portion_label',
      'consumed_servings',
      'total_carbohydrate_g',
      'total_carbohydrate_min_g',
      'total_carbohydrate_max_g',
      'total_sugars_g',
      'total_sugars_min_g',
      'total_sugars_max_g',
      'added_sugars_g',
      'added_sugars_min_g',
      'added_sugars_max_g',
      'excluded_components',
      'partial_estimate',
      'analysis_id',
    ],
    ...logs.map((entry) => [
      entry.loggedAt,
      entry.updatedAt,
      entry.meal,
      entry.productName,
      logEntryKind(entry),
      logStatusLabel(entry),
      isPackagedLabelLog(entry) ? entry.result.market : isEstimatedMealLog(entry) ? entry.estimatedRecord.market : entry.curatedRecord.market,
      isCuratedUnlabeledLog(entry) ? entry.curatedRecord.selectedPortionLabel : isEstimatedMealLog(entry) ? `${entry.estimatedRecord.components.length} confirmed components` : '',
      entry.consumedServings,
      entry.totals.totalCarbohydrate,
      isEstimatedMealLog(entry) ? entry.rangeTotals.totalCarbohydrate?.minimum : entry.totals.totalCarbohydrate,
      isEstimatedMealLog(entry) ? entry.rangeTotals.totalCarbohydrate?.maximum : entry.totals.totalCarbohydrate,
      entry.totals.totalSugars,
      isEstimatedMealLog(entry) ? entry.rangeTotals.totalSugars?.minimum : entry.totals.totalSugars,
      isEstimatedMealLog(entry) ? entry.rangeTotals.totalSugars?.maximum : entry.totals.totalSugars,
      entry.totals.addedSugars,
      isEstimatedMealLog(entry) ? entry.rangeTotals.addedSugars?.minimum : entry.totals.addedSugars,
      isEstimatedMealLog(entry) ? entry.rangeTotals.addedSugars?.maximum : entry.totals.addedSugars,
      isEstimatedMealLog(entry) ? entry.estimatedRecord.excludedComponentCount : 0,
      isEstimatedMealLog(entry) ? entry.estimatedRecord.partial : false,
      entry.analysisId,
    ]),
  ]
  download(rows.map((row) => row.map(escape).join(',')).join('\n'), 'text/csv', 'sugar-pai-history.csv')
}
