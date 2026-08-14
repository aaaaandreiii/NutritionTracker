import { describe, expect, it } from 'vitest'
import type { ChatStreamEvent } from '../domain/types'
import { parseSseStream } from './api'

describe('POST SSE parsing', () => {
  it('handles event boundaries split across network chunks and preserves ordering', async () => {
    const encoder = new TextEncoder()
    const chunks = [
      'data: {"type":"stage","stage":"retrieval","label":"Finding ev',
      'idence"}\n\ndata: {"type":"sources","sources":[],"warnings":[]}',
      '\n\ndata: {"type":"delta","text":"Hello"}\n\ndata: {"type":"done","finishReason":"complete"}\n\n',
    ]
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
        controller.close()
      },
    })
    const events: ChatStreamEvent[] = []
    await parseSseStream(stream, (event) => events.push(event))

    expect(events.map((event) => event.type)).toEqual(['stage', 'sources', 'delta', 'done'])
    expect(events[2]).toEqual({ type: 'delta', text: 'Hello' })
  })
})
