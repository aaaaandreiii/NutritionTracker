import { ArrowRight, CalendarDays, CircleHelp, ScanLine } from 'lucide-react'
import { sumKnown } from '../../domain/nutrition'
import { useLogs } from '../../hooks/useLogs'

interface Props { onScan: () => void }

function isToday(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function TotalCard({ label, values, tone }: { label: string; values: Array<number | null>; tone: string }) {
  const summary = sumKnown(values)
  return (
    <div className={`total-card ${tone}`}>
      <span>{label}</span>
      <div><strong>{Math.round(summary.total * 10) / 10}</strong><small>g known</small></div>
      {summary.unknown > 0 ? <p><CircleHelp size={14} /> {summary.unknown} entr{summary.unknown === 1 ? 'y has' : 'ies have'} missing data</p> : <p className="complete-data">All logged values known</p>}
    </div>
  )
}

export default function TodayPage({ onScan }: Props) {
  const { logs, loading } = useLogs()
  const today = logs.filter((entry) => isToday(entry.loggedAt))

  return (
    <div className="page today-page">
      <header className="page-heading split-heading">
        <div><span className="eyebrow"><CalendarDays size={14} /> Today</span><h1>Known totals, without invented zeroes.</h1><p>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p></div>
        <button className="primary-button" onClick={onScan}><ScanLine size={18} /> Scan a label</button>
      </header>

      <section className="totals-grid">
        <TotalCard label="Total carbohydrate" values={today.map((entry) => entry.totals.totalCarbohydrate)} tone="carb" />
        <TotalCard label="Total sugars" values={today.map((entry) => entry.totals.totalSugars)} tone="sugar" />
        <TotalCard label="Added sugars" values={today.map((entry) => entry.totals.addedSugars)} tone="added" />
      </section>

      <section className="card entries-card">
        <div className="section-heading"><div><span className="section-kicker">Local log</span><h2>Today’s entries</h2></div><span className="entry-count">{today.length} {today.length === 1 ? 'entry' : 'entries'}</span></div>
        {loading ? <div className="empty-state">Loading local history…</div> : today.length === 0 ? (
          <div className="empty-state"><ScanLine size={30} /><h3>No labels logged today</h3><p>Scan a packaged-food label, review each value, then save it here.</p><button className="text-button" onClick={onScan}>Start a scan <ArrowRight size={16} /></button></div>
        ) : (
          <div className="entry-list">
            {today.map((entry) => (
              <article className="entry-row" key={entry.id}>
                <div className="entry-time"><strong>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.loggedAt))}</strong><span>{entry.meal}</span></div>
                <div className="entry-name"><strong>{entry.productName}</strong><span>{entry.consumedServings} serving{entry.consumedServings === 1 ? '' : 's'} · {entry.result.status}</span></div>
                <div className="entry-macros">
                  <span><strong>{entry.totals.totalCarbohydrate ?? '—'}</strong>g carbs</span>
                  <span><strong>{entry.totals.totalSugars ?? '—'}</strong>g sugars</span>
                  <span><strong>{entry.totals.addedSugars ?? '—'}</strong>g added</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="page-footnote">Totals are educational records of confirmed package-label values. “Unknown” is preserved and does not count as zero.</p>
    </div>
  )
}
