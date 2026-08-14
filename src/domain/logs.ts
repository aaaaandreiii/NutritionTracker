import type {
  CuratedUnlabeledLogEntry,
  EstimatedMealLogEntry,
  LogEntry,
  PackagedLabelLogEntry,
  SmartContextRecordKind,
} from './types'

export function logEntryKind(entry: LogEntry): SmartContextRecordKind {
  return entry.kind ?? 'packaged_label'
}

export function isPackagedLabelLog(entry: LogEntry): entry is PackagedLabelLogEntry {
  return logEntryKind(entry) === 'packaged_label'
}

export function isCuratedUnlabeledLog(entry: LogEntry): entry is CuratedUnlabeledLogEntry {
  return logEntryKind(entry) === 'curated_unlabeled_demo'
}

export function isEstimatedMealLog(entry: LogEntry): entry is EstimatedMealLogEntry {
  return logEntryKind(entry) === 'estimated_unlabeled_meal'
}

export function logStatusLabel(entry: LogEntry): string {
  if (isCuratedUnlabeledLog(entry)) return 'curated demo'
  if (isEstimatedMealLog(entry)) return entry.estimatedRecord.partial ? 'estimated · partial' : 'estimated'
  return entry.result.status
}
