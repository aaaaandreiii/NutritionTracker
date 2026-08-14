import { describe, expect, it } from 'vitest'
import { automaticThreadTitle, citationIndexFromHref, citationIndexes, createChatThread } from './chat'

describe('evidence chat helpers', () => {
  it('extracts only well-formed matching citation links', () => {
    expect(citationIndexes('First [1](#source-1), repeat [1](#source-1), mismatch [2](#source-3).')).toEqual([1])
    expect(citationIndexFromHref('#source-4')).toBe(4)
    expect(citationIndexFromHref('https://example.com')).toBeNull()
  })

  it('creates local-only threads and compact automatic titles', () => {
    const thread = createChatThread(null)
    expect(thread.context).toBeNull()
    expect(thread.messages).toEqual([])
    expect(automaticThreadTitle('  What   are added sugars? ')).toBe('What are added sugars?')
    expect(automaticThreadTitle('x'.repeat(80))).toHaveLength(50)
  })
})
