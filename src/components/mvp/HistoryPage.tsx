import { Download, FileJson, History, Image, ScanLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useLogs } from '../../hooks/useLogs'
import { deleteAllLogs, deleteLog, exportLogsCsv, exportLogsJson } from '../../lib/db'

interface Props { onScan: () => void }

export default function HistoryPage({ onScan }: Props) {
  const { logs, loading } = useLogs()
  const [deleting, setDeleting] = useState<string | null>(null)

  const removeAll = async () => {
    if (!window.confirm('Delete every local Sugar pAI log? This cannot be undone.')) return
    await deleteAllLogs()
  }

  return (
    <div className="page history-page">
      <header className="page-heading split-heading">
        <div><span className="eyebrow"><History size={14} /> History</span><h1>Your confirmed label records.</h1><p>Stored only in this browser. Export or delete them at any time.</p></div>
        <div className="export-actions">
          <button className="secondary-button" disabled={!logs.length} onClick={() => exportLogsCsv(logs)}><Download size={16} /> CSV</button>
          <button className="secondary-button" disabled={!logs.length} onClick={() => exportLogsJson(logs)}><FileJson size={16} /> JSON</button>
        </div>
      </header>

      <section className="card history-card">
        {loading ? <div className="empty-state">Loading local history…</div> : logs.length === 0 ? (
          <div className="empty-state"><History size={31} /><h3>No saved history</h3><p>Confirmed scans will appear here and remain on this device.</p><button className="primary-button" onClick={onScan}><ScanLine size={17} /> Scan a label</button></div>
        ) : (
          <div className="history-list">
            {logs.map((entry) => (
              <article className="history-row" key={entry.id}>
                <div className="history-date"><strong>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(entry.loggedAt))}</strong><span>{new Intl.DateTimeFormat(undefined, { year: 'numeric' }).format(new Date(entry.loggedAt))}</span></div>
                <div className="history-details"><strong>{entry.productName}</strong><span>{entry.meal} · {entry.consumedServings} serving{entry.consumedServings === 1 ? '' : 's'} · {entry.result.market}</span><small>Analysis {entry.analysisId.slice(0, 8)}… · {entry.result.status}</small></div>
                <div className="history-values"><span>{entry.totals.totalCarbohydrate ?? '—'}g <small>carbs</small></span><span>{entry.totals.totalSugars ?? '—'}g <small>sugars</small></span><span>{entry.totals.addedSugars ?? '—'}g <small>added</small></span></div>
                {entry.retainedImages?.length ? <span className="images-kept" title={`${entry.retainedImages.length} images stored locally`}><Image size={15} /> {entry.retainedImages.length}</span> : null}
                <button className="delete-button" disabled={deleting === entry.id} onClick={async () => {
                  setDeleting(entry.id)
                  await deleteLog(entry.id)
                  setDeleting(null)
                }} aria-label={`Delete ${entry.productName}`}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
        )}
      </section>
      {logs.length > 0 && <button className="danger-text-button" onClick={() => void removeAll()}><Trash2 size={16} /> Delete all local data</button>}
    </div>
  )
}
