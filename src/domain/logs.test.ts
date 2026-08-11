import { describe, expect, it } from 'vitest'
import { isCuratedUnlabeledLog, isPackagedLabelLog, logEntryKind, logStatusLabel } from './logs'
import type { LogEntry } from './types'

describe('log entry compatibility', () => {
  it('treats missing kind as a legacy packaged-label record', () => {
    const oldEntry = {
      result: { status: 'confirmed' },
    } as LogEntry

    expect(logEntryKind(oldEntry)).toBe('packaged_label')
    expect(isPackagedLabelLog(oldEntry)).toBe(true)
    expect(isCuratedUnlabeledLog(oldEntry)).toBe(false)
    expect(logStatusLabel(oldEntry)).toBe('confirmed')
  })

  it('identifies curated unlabeled demo records without requiring packaged result data', () => {
    const curatedEntry = {
      kind: 'curated_unlabeled_demo',
      curatedRecord: { status: 'confirmed' },
    } as LogEntry

    expect(logEntryKind(curatedEntry)).toBe('curated_unlabeled_demo')
    expect(isCuratedUnlabeledLog(curatedEntry)).toBe(true)
    expect(isPackagedLabelLog(curatedEntry)).toBe(false)
    expect(logStatusLabel(curatedEntry)).toBe('curated demo')
  })
})
