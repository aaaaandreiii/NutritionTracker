import { ArrowRight, CalendarDays, CircleHelp, ScanLine } from 'lucide-react'
import { isCuratedUnlabeledLog, isEstimatedMealLog, logStatusLabel } from '../../domain/logs'
import { summarizeLogRanges } from '../../domain/nutrition'
import type { LogEntry } from '../../domain/types'
import { useLogs } from '../../hooks/useLogs'

interface Props { onScan: () => void }

function isToday(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function TotalCard({ label, entries, nutrient, tone }: { label: string; entries: LogEntry[]; nutrient: 'totalCarbohydrate' | 'totalSugars' | 'addedSugars'; tone: string }) {
  const summary = summarizeLogRanges(entries, nutrient)
  return (
    <div className={`total-card ${tone}`}>
      <span>{label}</span>
      <div><strong>{summary.estimated ? `~${summary.midpoint}` : summary.midpoint}</strong><small>{summary.estimated ? `g · ${summary.minimum}–${summary.maximum} g` : 'g known'}</small></div>
      {summary.unknown > 0 ? <p><CircleHelp size={14} /> {summary.unknown} value{summary.unknown === 1 ? '' : 's'} unknown; total is partial</p> : <p className="complete-data">{summary.estimated ? `Includes ${summary.estimated} estimated meal${summary.estimated === 1 ? '' : 's'}` : 'All logged values known'}</p>}
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
        <button className="primary-button" onClick={onScan}><ScanLine size={18} /> Open Sugar pAI</button>
      </header>

      <section className="totals-grid">
        <TotalCard label="Total carbohydrate" entries={today} nutrient="totalCarbohydrate" tone="carb" />
        <TotalCard label="Total sugars" entries={today} nutrient="totalSugars" tone="sugar" />
        <TotalCard label="Added sugars" entries={today} nutrient="addedSugars" tone="added" />
      </section>

      <section className="card entries-card">
        <div className="section-heading"><div><span className="section-kicker">Local log</span><h2>Today’s entries</h2></div><span className="entry-count">{today.length} {today.length === 1 ? 'entry' : 'entries'}</span></div>
        {loading ? <div className="empty-state">Loading local history…</div> : today.length === 0 ? (
          <div className="empty-state"><ScanLine size={30} /><h3>No Sugar pAI records today</h3><p>Scan a packaged label or confirm an estimated meal, then save the record here.</p><button className="text-button" onClick={onScan}>Start Sugar pAI <ArrowRight size={16} /></button></div>
        ) : (
          <div className="entry-list">
            {today.map((entry) => (
              <article className="entry-row" key={entry.id}>
                <div className="entry-time"><strong>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.loggedAt))}</strong><span>{entry.meal}</span></div>
                <div className="entry-name"><strong>{entry.productName}</strong><span>{isCuratedUnlabeledLog(entry) ? entry.curatedRecord.selectedPortionLabel : isEstimatedMealLog(entry) ? `${entry.estimatedRecord.components.length} components` : `${entry.consumedServings} serving${entry.consumedServings === 1 ? '' : 's'}`} · {logStatusLabel(entry)}</span></div>
                <div className="entry-macros">
                  <span><strong>{displayLogValue(entry, 'totalCarbohydrate')}</strong> carbs</span>
                  <span><strong>{displayLogValue(entry, 'totalSugars')}</strong> sugars</span>
                  <span><strong>{displayLogValue(entry, 'addedSugars')}</strong> added</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="page-footnote">Exact label values are fixed ranges. Estimated meal values retain min–max ranges. Unknown values do not count as zero, and partial totals stay labeled.</p>
    </div>
  )
}

function displayLogValue(entry: LogEntry, key: 'totalCarbohydrate' | 'totalSugars' | 'addedSugars'): string {
  if (isEstimatedMealLog(entry)) {
    const range = entry.rangeTotals[key]
    return range ? `~${entry.totals[key] ?? '—'} g (${range.minimum}–${range.maximum})` : '—'
  }
  return entry.totals[key] == null ? '—' : `${entry.totals[key]} g`
}
