import { openDB } from 'idb'
import type { LogEntry } from '../domain/types'

const DB_NAME = 'sugar-pai-research'
const STORE_NAME = 'logs'

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    store.createIndex('loggedAt', 'loggedAt')
  },
})

export async function saveLog(entry: LogEntry): Promise<void> {
  const db = await dbPromise
  await db.put(STORE_NAME, entry)
  window.dispatchEvent(new CustomEvent('sugar-pai:logs-changed'))
}

export async function listLogs(): Promise<LogEntry[]> {
  const db = await dbPromise
  const logs = await db.getAll(STORE_NAME)
  return logs.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
}

export async function deleteLog(id: string): Promise<void> {
  const db = await dbPromise
  await db.delete(STORE_NAME, id)
  window.dispatchEvent(new CustomEvent('sugar-pai:logs-changed'))
}

export async function deleteAllLogs(): Promise<void> {
  const db = await dbPromise
  await db.clear(STORE_NAME)
  window.dispatchEvent(new CustomEvent('sugar-pai:logs-changed'))
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
      'meal',
      'product',
      'consumed_servings',
      'total_carbohydrate_g',
      'total_sugars_g',
      'added_sugars_g',
      'analysis_id',
    ],
    ...logs.map((entry) => [
      entry.loggedAt,
      entry.meal,
      entry.productName,
      entry.consumedServings,
      entry.totals.totalCarbohydrate,
      entry.totals.totalSugars,
      entry.totals.addedSugars,
      entry.analysisId,
    ]),
  ]
  download(rows.map((row) => row.map(escape).join(',')).join('\n'), 'text/csv', 'sugar-pai-history.csv')
}
