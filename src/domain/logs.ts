import type {
  CuratedUnlabeledLogEntry,
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

export function logStatusLabel(entry: LogEntry): string {
  if (isCuratedUnlabeledLog(entry)) return 'curated demo'
  return entry.result.status
}
