import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ChatThread } from '../domain/types'

async function createVersionOneDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('sugar-pai-research', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('logs', { keyPath: 'id' })
      store.createIndex('loggedAt', 'loggedAt')
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
  })
}

let storage: typeof import('./db')

beforeAll(async () => {
  await createVersionOneDatabase()
  storage = await import('./db')
})

describe('IndexedDB chat migration and CRUD', () => {
  it('upgrades a v1 logs database with a chat store and performs CRUD', async () => {
    const now = new Date().toISOString()
    const thread: ChatThread = {
      id: 'thread-test',
      title: 'Added sugars',
      createdAt: now,
      updatedAt: now,
      context: null,
      messages: [],
    }

    await storage.saveChatThread(thread)
    expect(await storage.getChatThread(thread.id)).toEqual(thread)
    expect((await storage.listChatThreads()).map((item) => item.id)).toContain(thread.id)
    await storage.deleteChatThread(thread.id)
    expect(await storage.getChatThread(thread.id)).toBeUndefined()
  })
})
