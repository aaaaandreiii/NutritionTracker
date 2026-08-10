import { useCallback, useEffect, useState } from 'react'
import type { LogEntry } from '../domain/types'
import { listLogs } from '../lib/db'

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLogs(await listLogs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener('sugar-pai:logs-changed', refresh)
    return () => window.removeEventListener('sugar-pai:logs-changed', refresh)
  }, [refresh])

  return { logs, loading, refresh }
}
