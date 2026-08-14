import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { GlycemicEvidence, ImageQualityReport } from '../../domain/types'
import { imageQualitySummary } from './uiDisplay'

export function TechnicalDetails({ summary = 'Technical details', children }: { summary?: string; children: ReactNode }) {
  return (
    <details className="card disclosure-card technical-details">
      <summary>{summary}</summary>
      <div className="disclosure-body technical-details-body">{children}</div>
    </details>
  )
}

export function GlycemicEvidenceBlock({ glycemic }: { glycemic: GlycemicEvidence }) {
  if (glycemic.status === 'sourced') {
    return (
      <>
        <div className="gi-value"><strong>{glycemic.gi}</strong><span>Sourced GI</span></div>
        <p>{glycemic.testedFoodMatchDescription}</p>
        {glycemic.gl != null && <p><strong>GL {glycemic.gl}</strong> for the validated consumed portion.</p>}
        {glycemic.citation && <a href={glycemic.citation.url} target="_blank" rel="noreferrer">{glycemic.citation.title}<ExternalLink size={13} /></a>}
      </>
    )
  }

  if (glycemic.status === 'heuristic_demo') {
    return (
      <div className={`heuristic-block band-${glycemic.glBand ?? 'unknown'}`}>
        <strong className="gl-unavailable-lead">Tested-product data unavailable</strong>
        <p>{glycemic.reason}</p>
        <small>{glycemic.gl == null ? 'Experimental demo estimate unavailable' : `Experimental demo estimate · ${glycemic.gl}`}</small>
        {glycemic.gi != null && <small>Demo GI input: {glycemic.gi}. Net carbohydrate: {glycemic.availableCarbohydrateGrams ?? 'unavailable'} g.</small>}
        {glycemic.licensing && <small>{glycemic.licensing}</small>}
      </div>
    )
  }

  return (
    <div className="unavailable-block">
      <AlertCircle size={22} />
      <strong>GI and GL unavailable</strong>
      <p>{glycemic.reason}</p>
      <small>Sourced GI cannot be calculated from sugar grams or ingredient order.</small>
    </div>
  )
}

export function ConfirmationModal({
  title,
  body,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="confirmation-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirmation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirmation-icon"><AlertCircle size={22} /></div>
        <h2 id="confirmation-title">{title}</h2>
        <p>{body}</p>
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export function QualitySummaryInline({ report, checking }: { report?: ImageQualityReport; checking?: boolean }) {
  const summary = checking ? { tone: 'pending' as const, message: 'Checking image quality...', details: [] } : imageQualitySummary(report)
  const Icon = summary.tone === 'good' ? CheckCircle2 : AlertCircle
  return (
    <div className={`quality-summary-inline quality-${summary.tone}`}>
      <Icon size={15} />
      <div>
        <strong>{summary.message}</strong>
        {summary.details.slice(0, 2).map((detail) => <small key={detail}>{detail}</small>)}
      </div>
    </div>
  )
}
