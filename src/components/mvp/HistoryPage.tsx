import {
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  History,
  Image,
  Info,
  LoaderCircle,
  MessageCircleQuestion,
  Pencil,
  Save,
  ScanLine,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { isCuratedUnlabeledLog, isEstimatedMealLog, isPackagedLabelLog, logStatusLabel } from '../../domain/logs'
import { NUTRIENT_KEYS, NUTRIENT_META, correctionsFromResult, makeLogTotals, rangeMidpoint } from '../../domain/nutrition'
import {
  buildIngredientContextFlags,
  buildPairingInsights,
  deterministicSmartContextSnapshot,
  smartContextFromCuratedRecord,
  smartContextRequestFromAnalysis,
  smartContextResponseToInsights,
} from '../../domain/pairing'
import type {
  AnalysisResult,
  CuratedUnlabeledLogEntry,
  EstimatedMealLogEntry,
  FinalizeCorrections,
  LabelRecordValidation,
  LogEntry,
  MealSlot,
  PackagedLabelLogEntry,
  SmartContextFlag,
  ValidationCheck,
} from '../../domain/types'
import { useLogs } from '../../hooks/useLogs'
import { resolveSmartContext, validateLabelRecord } from '../../lib/api'
import { deleteAllLogs, deleteLog, exportLogsCsv, exportLogsJson, saveLog } from '../../lib/db'
import ImagePreviewButton from './ImagePreviewButton'
import PairingIdeas from './PairingIdeas'
import { ConfirmationModal, GlycemicEvidenceBlock } from './uiHelpers'
import { marketLabel, reviewStatusLabel } from './uiDisplay'

interface Props { onScan: () => void }

const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other']

function numberFromInput(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function servingsFromInput(value: string): number {
  if (value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function correctionsFromLog(entry: PackagedLabelLogEntry): FinalizeCorrections {
  const corrections = correctionsFromResult(entry.result)
  return {
    ...corrections,
    productName: entry.productName || corrections.productName,
    consumedServings: entry.consumedServings,
  }
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatValue(value: number | null): string {
  return value == null ? 'Not declared / unavailable' : `${value} g`
}

function statusSlug(status: string): string {
  return status.toLowerCase().replaceAll(' ', '-')
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${statusSlug(status)}`}>{status}</span>
}

function validationSummary(checks: ValidationCheck[]): string {
  if (checks.some((check) => check.status === 'fail')) return 'Needs review'
  if (checks.some((check) => check.status === 'review')) return 'Needs review'
  return checks.length ? 'Confirmed' : 'Not validated'
}

function flagCategoryLabel(flag: SmartContextFlag): string {
  return flag.category.replaceAll('_', ' ')
}

function askAboutLog(entryId: string) {
  window.location.hash = `#/sugar-pai/ask?logId=${encodeURIComponent(entryId)}`
}

function ReadOnlyRow({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return <div className="readonly-row"><span>{label}</span><strong>{value}</strong>{meta && <small>{meta}</small>}</div>
}

function mergeValidatedRecord(
  entry: PackagedLabelLogEntry,
  corrections: FinalizeCorrections,
  meal: MealSlot,
  validation: LabelRecordValidation,
): PackagedLabelLogEntry {
  const result: AnalysisResult = {
    ...entry.result,
    status: validation.status,
    product: {
      ...entry.result.product,
      name: validation.productName,
    },
    serving: {
      ...entry.result.serving,
      size: validation.servingSize,
      unit: validation.servingUnit,
    },
    nutrients: validation.nutrients,
    rawIngredients: validation.rawIngredients,
    sugarVariants: validation.sugarVariants,
    glycemic: validation.glycemic,
    validationChecks: validation.validationChecks,
    limitations: validation.limitations,
    provenance: validation.provenance,
  }

  return {
    ...entry,
    updatedAt: new Date().toISOString(),
    meal,
    consumedServings: corrections.consumedServings,
    productName: validation.productName.value ?? corrections.productName.trim(),
    result,
    totals: makeLogTotals(result, corrections.consumedServings),
  }
}

function HistoryDetailDrawer({ entry, onClose }: { entry: PackagedLabelLogEntry; onClose: () => void }) {
  const [draft, setDraft] = useState<FinalizeCorrections>(() => correctionsFromLog(entry))
  const [meal, setMeal] = useState<MealSlot>(entry.meal)
  const [editing, setEditing] = useState(false)
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const markEdited = (key: string) => {
    setEdited((previous) => new Set(previous).add(key))
    setError(null)
  }

  const requestClose = useCallback(() => {
    if (editing && edited.size > 0 && !window.confirm('Discard unsaved Sugar pAI edits?')) return
    onClose()
  }, [edited.size, editing, onClose])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  const resetDraft = () => {
    setDraft(correctionsFromLog(entry))
    setMeal(entry.meal)
    setEditing(false)
    setEdited(new Set())
    setError(null)
  }

  const normalizedDraft = {
    ...draft,
    productName: draft.productName.trim(),
    servingUnit: draft.servingUnit.trim(),
  }
  const requiredComplete = normalizedDraft.productName.length > 0 && normalizedDraft.consumedServings > 0
  const hasNutrition = NUTRIENT_KEYS.some((key) => normalizedDraft.nutrients[key] != null)
  const validationLabel = editing && edited.size > 0 ? 'Needs validation' : validationSummary(entry.result.validationChecks)
  const fieldStatus = (key: string, fallback: string) => editing && edited.has(key) ? 'Needs validation' : fallback
  const pairingInsights = useMemo(
    () => entry.smartContextSnapshot ? smartContextResponseToInsights(entry.smartContextSnapshot) : buildPairingInsights({
      result: entry.result,
      consumedServings: entry.consumedServings,
      meal: entry.meal,
      productName: entry.productName,
    }),
    [entry],
  )
  const ingredientFlags = useMemo(() => buildIngredientContextFlags(entry.result), [entry.result])

  const save = async () => {
    if (!requiredComplete || !hasNutrition) return
    setSaving(true)
    setError(null)
    try {
      const validation = await validateLabelRecord(normalizedDraft)
      const merged = mergeValidatedRecord(entry, normalizedDraft, meal, validation)
      const context = {
        result: merged.result,
        consumedServings: merged.consumedServings,
        meal: merged.meal,
        productName: merged.productName,
      }
      try {
        merged.smartContextSnapshot = await resolveSmartContext(smartContextRequestFromAnalysis(context))
      } catch {
        merged.smartContextSnapshot = deterministicSmartContextSnapshot(buildPairingInsights(context))
      }
      await saveLog(merged)
      setEditing(false)
      setEdited(new Set())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not validate and save this record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="history-drawer-backdrop" role="presentation" onMouseDown={requestClose}>
      <aside
        className="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.productName} label record`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="history-drawer-header">
          <div>
            <span className="section-kicker">Saved label record</span>
            <h2>{entry.productName}</h2>
            <p>Logged {formatDateTime(entry.loggedAt)}{entry.updatedAt ? ` · Updated ${formatDateTime(entry.updatedAt)}` : ''}</p>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Close record details"><X size={18} /></button>
        </header>

        <div className="history-drawer-scroll">
          <section className="drawer-summary-grid" aria-label="Record summary">
            <div><span>Meal</span><strong>{meal}</strong></div>
            <div><span>Consumed</span><strong>{draft.consumedServings || '—'} serving{draft.consumedServings === 1 ? '' : 's'}</strong></div>
            <div><span>Validation</span><strong>{validationLabel}</strong></div>
          </section>

          <section className="drawer-section">
            <div className="section-heading">
              <div><span className="section-kicker">Product & serving</span><h3>Record details</h3></div>
              <StatusPill status={validationLabel} />
            </div>
            {!editing ? (
              <div className="readonly-list">
                <ReadOnlyRow label="Product" value={draft.productName || 'Unnamed product'} meta={fieldStatus('productName', entry.result.product.name.status)} />
                <ReadOnlyRow label="Meal" value={meal} />
                <ReadOnlyRow label="Servings consumed" value={`${draft.consumedServings || '—'} serving${draft.consumedServings === 1 ? '' : 's'}`} />
                <ReadOnlyRow label="Serving size" value={draft.servingSize == null ? 'Not declared / unavailable' : `${draft.servingSize} ${draft.servingUnit}`.trim()} />
              </div>
            ) : (
              <>
                <label className="field full-field">
                  <span>Product name</span>
                  <input
                    value={draft.productName}
                    onChange={(event) => {
                      markEdited('productName')
                      setDraft((value) => ({ ...value, productName: event.target.value }))
                    }}
                  />
                  <StatusPill status={fieldStatus('productName', entry.result.product.name.status)} />
                </label>
                <div className="drawer-two-fields">
                  <label className="compact-field">
                    <span>Meal</span>
                    <select
                      value={meal}
                      onChange={(event) => {
                        markEdited('meal')
                        setMeal(event.target.value as MealSlot)
                      }}
                    >
                      {MEAL_SLOTS.map((slot) => <option key={slot}>{slot}</option>)}
                    </select>
                  </label>
                  <label className="compact-field">
                    <span>Servings consumed</span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={draft.consumedServings || ''}
                      onChange={(event) => {
                        markEdited('consumedServings')
                        setDraft((value) => ({ ...value, consumedServings: servingsFromInput(event.target.value) }))
                      }}
                    />
                  </label>
                  <label className="compact-field">
                    <span>Serving size</span>
                    <input
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Not declared / unavailable"
                      value={draft.servingSize ?? ''}
                      onChange={(event) => {
                        markEdited('servingSize')
                        setDraft((value) => ({ ...value, servingSize: numberFromInput(event.target.value) }))
                      }}
                    />
                  </label>
                  <label className="compact-field">
                    <span>Serving unit</span>
                    <input
                      value={draft.servingUnit}
                      placeholder="g, mL, piece"
                      onChange={(event) => {
                        markEdited('servingUnit')
                        setDraft((value) => ({ ...value, servingUnit: event.target.value }))
                      }}
                    />
                  </label>
                </div>
              </>
            )}
            <div className="drawer-meta-grid">
              <span><strong>Market</strong>{marketLabel(entry.result.market)}</span>
              <span><strong>Source</strong>Confirmed label</span>
              <span><strong>Status</strong>{reviewStatusLabel(entry.result.status)}</span>
            </div>
            <details className="inline-technical-details"><summary>Technical details</summary><div className="diagnostic-row"><strong>Analysis ID</strong><span>{entry.analysisId}</span></div><div className="diagnostic-row"><strong>Raw status</strong><span>{entry.result.status}</span></div></details>
          </section>

          <section className="drawer-section">
            <div className="section-heading">
              <div><span className="section-kicker">Per labeled serving</span><h3>Nutrients</h3></div>
              <span className="unit-label">grams</span>
            </div>
            {!editing ? (
              <div className="nutrition-readonly-table">
                {NUTRIENT_KEYS.map((key) => (
                  <div key={key}>
                    <span>{NUTRIENT_META[key].label}</span>
                    <strong>{formatValue(entry.result.nutrients[key].value)}</strong>
                    {entry.result.nutrients[key].status === 'User confirmed' && <small>User confirmed</small>}
                    {entry.result.nutrients[key].status === 'Unavailable' && <small>Not declared</small>}
                    {entry.result.nutrients[key].status === 'Conflict' && <small>Conflict</small>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="nutrient-fields">
                {NUTRIENT_KEYS.map((key) => (
                  <label className={`field nutrient-field nutrient-${key}`} key={key}>
                    <span>{NUTRIENT_META[key].label}</span>
                    <input
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="any"
                      value={draft.nutrients[key] ?? ''}
                      placeholder="Not declared / unavailable"
                      onChange={(event) => {
                        markEdited(key)
                        const nutrientValue = numberFromInput(event.target.value)
                        setDraft((previous) => ({
                          ...previous,
                          nutrients: { ...previous.nutrients, [key]: nutrientValue },
                        }))
                      }}
                    />
                    <small>{formatValue(entry.result.nutrients[key].value)} · {NUTRIENT_META[key].helper}</small>
                    <StatusPill status={fieldStatus(key, entry.result.nutrients[key].status)} />
                  </label>
                ))}
              </div>
            )}
          </section>

          <details className="drawer-section drawer-details-section" open>
            <summary>Ingredient flags</summary>
            {editing && (
              <label className="field full-field">
                <span>Ingredients, in printed order</span>
                <textarea
                  rows={5}
                  value={draft.rawIngredients}
                  placeholder="No ingredient text saved"
                  onChange={(event) => {
                    markEdited('ingredients')
                    setDraft((value) => ({ ...value, rawIngredients: event.target.value }))
                  }}
                />
                <StatusPill status={fieldStatus('ingredients', entry.result.rawIngredients.status)} />
              </label>
            )}
            {ingredientFlags.length > 0 ? (
              <div className="context-flag-list">
                {ingredientFlags.map((flag) => (
                  <div className={`context-flag flag-${flag.category}`} key={flag.id}>
                    <strong>{flag.label}</strong>
                    <span>{flagCategoryLabel(flag)}</span>
                    <p>{flag.detail}</p>
                    <small>{flag.evidenceLabels.join(' · ')}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-inline">No ingredient context flags are currently matched for this record.</p>
            )}
          </details>

          <details className="drawer-section drawer-details-section">
            <summary>Experimental glycemic context</summary>
            <GlycemicEvidenceBlock glycemic={entry.result.glycemic} />
          </details>

          <details className="drawer-section drawer-details-section">
            <summary>Smart Context</summary>
            <PairingIdeas insights={pairingInsights} variant="drawer" />
          </details>

          <details className="drawer-section drawer-details-section">
            <summary>Validation checks</summary>
            <div className="validation-list">
              {entry.result.validationChecks.map((check) => (
                <div className={`validation-row validation-${check.status}`} key={check.code}>
                  {check.status === 'pass' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <div><strong>{check.code.replaceAll('_', ' ')}</strong><span>{check.message}</span></div>
                  <StatusPill status={check.status} />
                </div>
              ))}
            </div>
          </details>

          <details className="drawer-section drawer-details-section">
            <summary>Evidence photos</summary>
            {entry.retainedImages?.length ? (
              <div className="retained-image-list">
                {entry.retainedImages.map((image) => (
                  <div className="captured-image-row" key={`${image.kind}-${image.name}`}>
                    <ImagePreviewButton file={image.blob} fileName={image.name} label={`${image.kind} panel`} className="captured-image-button" />
                    <div><strong>{image.kind}</strong><span>{image.name}</span></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-inline">No source images were retained for this record.</p>
            )}
          </details>

          {error && <div className="notice error"><AlertCircle size={17} />{error}</div>}
          {editing && edited.size > 0 && <div className="notice neutral"><Info size={17} />Saving edits requires backend validation. Daily Dozen meal snapshots are not changed.</div>}
          {editing && !hasNutrition && <div className="notice warning"><AlertCircle size={17} />Enter at least one printed nutrition value before saving.</div>}
        </div>

        <footer className="history-drawer-actions">
          {!editing ? (
            <>
              <button type="button" className="secondary-button" onClick={() => askAboutLog(entry.id)}><MessageCircleQuestion size={17} /> Ask about this record</button>
              <button type="button" className="primary-button" onClick={() => setEditing(true)}><Pencil size={17} /> Edit</button>
            </>
          ) : (
            <>
              <button type="button" className="secondary-button" disabled={saving} onClick={resetDraft}>Cancel</button>
              <button type="button" className="primary-button" disabled={!requiredComplete || !hasNutrition || saving} onClick={() => void save()}>
                {saving ? <LoaderCircle className="spin" size={17} /> : <><ShieldCheck size={17} /><Save size={17} /></>} Validate and save
              </button>
            </>
          )}
        </footer>
      </aside>
    </div>
  )
}

function CuratedDemoHistoryDrawer({ entry, onClose }: { entry: CuratedUnlabeledLogEntry; onClose: () => void }) {
  const record = entry.curatedRecord
  const insights = useMemo(
    () => buildPairingInsights(smartContextFromCuratedRecord(record, entry.meal)),
    [entry.meal, record],
  )

  const requestClose = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  return (
    <div className="history-drawer-backdrop" role="presentation" onMouseDown={requestClose}>
      <aside
        className="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.productName} curated demo record`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="history-drawer-header">
          <div>
            <span className="section-kicker">Curated unlabeled demo</span>
            <h2>{entry.productName}</h2>
            <p>Logged {formatDateTime(entry.loggedAt)}{entry.updatedAt ? ` · Updated ${formatDateTime(entry.updatedAt)}` : ''}</p>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Close record details"><X size={18} /></button>
        </header>

        <div className="history-drawer-scroll">
          <section className="drawer-summary-grid" aria-label="Record summary">
            <div><span>Meal</span><strong>{entry.meal}</strong></div>
            <div><span>Portion</span><strong>{record.selectedPortionLabel}</strong></div>
            <div><span>Mode</span><strong>Curated demo</strong></div>
            <div><span>GI / GL</span><strong>Unavailable</strong></div>
          </section>

          <section className="drawer-section">
            <div className="section-heading">
              <div><span className="section-kicker">Food & portion</span><h3>Confirmed context</h3></div>
              <StatusPill status="User confirmed" />
            </div>
            <div className="drawer-meta-grid">
              <span><strong>Market</strong>{marketLabel(record.market)}</span>
              <span><strong>Source</strong>Quick-add catalog</span>
              <span><strong>Status</strong>User confirmed</span>
            </div>
            <details className="inline-technical-details"><summary>Technical details</summary><div className="diagnostic-row"><strong>Record ID</strong><span>{record.recordId}</span></div><div className="diagnostic-row"><strong>Raw status</strong><span>{record.status}</span></div></details>
            {record.notes && <p className="empty-inline">{record.notes}</p>}
          </section>

          <section className="drawer-section">
            <div className="section-heading"><div><span className="section-kicker">Qualitative tags</span><h3>Catalog descriptors</h3></div></div>
            <div className="context-flag-list">
              {record.contextFlags.map((flag) => (
                <div className="context-flag flag-curated_demo" key={flag.id}>
                  <strong>{flag.label}</strong>
                  <span>{flag.category.replaceAll('_', ' ')}</span>
                  <p>{flag.detail}</p>
                  <small>{flag.evidenceLabels.join(' · ')}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-heading"><div><span className="section-kicker">Glycemic evidence</span><h3>Unavailable</h3></div></div>
            <div className="unavailable-block">
              <AlertCircle size={22} />
              <strong>GI and GL unavailable</strong>
              <p>{record.glycemic.reason}</p>
            </div>
          </section>

          <PairingIdeas insights={insights} variant="drawer" />

          <section className="drawer-section">
            <div className="section-heading"><div><span className="section-kicker">Limitations</span><h3>Demo boundary</h3></div></div>
            <ul className="limitations-list">{record.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>

        <footer className="history-drawer-actions">
          <button type="button" className="secondary-button" onClick={requestClose}>Close</button>
        </footer>
      </aside>
    </div>
  )
}

function EstimatedMealHistoryDrawer({ entry, onClose }: { entry: EstimatedMealLogEntry; onClose: () => void }) {
  const record = entry.estimatedRecord
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div className="history-drawer-backdrop" role="presentation" onMouseDown={onClose}>
    <aside className="history-drawer" role="dialog" aria-modal="true" aria-label={`${entry.productName} estimated meal record`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="history-drawer-header"><div><span className="section-kicker">Saved estimated meal</span><h2>{entry.productName}</h2><p>Logged {formatDateTime(entry.loggedAt)} · read-only estimate</p></div><button className="icon-button" onClick={onClose} aria-label="Close record details"><X size={18} /></button></header>
      <div className="history-drawer-scroll">
        <section className="drawer-summary-grid" aria-label="Estimated meal summary"><div><span>Meal</span><strong>{record.meal}</strong></div><div><span>Components</span><strong>{record.components.length}</strong></div><div><span>Matched</span><strong>{record.matchedComponentCount}</strong></div><div><span>Excluded</span><strong>{record.excludedComponentCount}</strong></div></section>
        <section className="drawer-section"><div className="section-heading"><div><span className="section-kicker">Matched-component ranges</span><h3>Estimated nutrients</h3></div><StatusPill status={record.partial ? 'Estimated · partial' : 'Estimated'} /></div><div className="aggregate-range-grid">{NUTRIENT_KEYS.map((key) => { const range = record.aggregateNutrientRanges[key]; return <div key={key}><span>{NUTRIENT_META[key].label}</span><strong>{range ? `~${rangeMidpoint(range)} g` : 'Unknown'}</strong><small>{range ? `${range.minimum}–${range.maximum} g${record.unknownNutrientCounts[key] ? ' · partial' : ''}` : 'Not available'}</small></div> })}</div></section>
        <section className="drawer-section"><div className="section-heading"><div><span className="section-kicker">Confirmed components</span><h3>Identity, portion, and source</h3></div></div><div className="component-result-list">{record.components.map((component) => <article key={component.componentId}><div><strong>{component.confirmedName}</strong><span>{component.householdPortion} · {component.gramRange.minimum}–{component.gramRange.maximum} g</span></div><StatusPill status={component.contextOnly ? 'Contextual' : 'Estimated range'} />{component.usdaMatch ? <small>{component.usdaMatch.description}</small> : <small>Excluded from numeric aggregates</small>}<details><summary>Evidence trail</summary><ul>{component.evidenceTrail.map((item) => <li key={`${item.timestamp}-${item.note}`}>{item.evidenceType} · {item.note}</li>)}</ul></details></article>)}</div></section>
        {record.smartContextSnapshot && <section className="drawer-section"><div className="section-heading"><div><span className="section-kicker">Saved Smart Context</span><h3>Reproducible snapshot</h3></div></div><div className="smart-context-card-list">{record.smartContextSnapshot.cards.map((card) => <article key={card.id}><h3>{card.title}</h3><p>{card.body}</p><small>{card.evidenceLabels.join(' · ')}</small></article>)}</div></section>}
        <section className="drawer-section"><div className="section-heading"><div><span className="section-kicker">Limitations</span><h3>Estimate boundary</h3></div></div><ul className="limitations-list">{record.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="drawer-section"><div className="section-heading"><div><span className="section-kicker">Retained image</span><h3>Local opt-in only</h3></div></div>{entry.retainedImages?.length ? entry.retainedImages.map((image) => <ImagePreviewButton key={image.name} file={image.blob} fileName={image.name} label="meal photo" className="captured-image-button" />) : <p className="empty-inline">No source photo was retained.</p>}</section>
      </div>
      <footer className="history-drawer-actions"><span>Estimated records are read-only. Delete and recreate to change them.</span><button className="secondary-button" onClick={onClose}>Close</button></footer>
    </aside>
  </div>
}

export default function HistoryPage({ onScan }: Props) {
  const { logs, loading } = useLogs()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const selectedEntry = useMemo(
    () => logs.find((entry) => entry.id === selectedId) ?? null,
    [logs, selectedId],
  )

  const removeAll = async () => {
    setDeleting('all')
    await deleteAllLogs()
    setSelectedId(null)
    setDeleteAllOpen(false)
    setDeleting(null)
  }

  const removeLog = async (entry: LogEntry) => {
    setDeleting(entry.id)
    try {
      await deleteLog(entry.id)
      if (selectedId === entry.id) setSelectedId(null)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="page history-page">
      <header className="page-heading split-heading">
        <div><span className="eyebrow"><History size={14} /> History</span><h1>Your evidence-aware records.</h1><p>Stored only in this browser. Packaged labels remain editable; estimated meals are read-only and retain their ranges and Smart Context snapshot.</p></div>
        <div className="export-actions">
          <details className="export-menu">
            <summary><Download size={16} /> Export <ChevronDown size={14} /></summary>
            <div>
              <button disabled={!logs.length} onClick={() => exportLogsCsv(logs)}><Download size={16} /> CSV</button>
              <button disabled={!logs.length} onClick={() => exportLogsJson(logs)}><FileJson size={16} /> JSON</button>
            </div>
          </details>
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
                <button type="button" className="history-details history-details-button" onClick={() => setSelectedId(entry.id)}>
                  <strong>{entry.productName}</strong>
                  <span>{entry.meal} · {isCuratedUnlabeledLog(entry) ? entry.curatedRecord.selectedPortionLabel : isEstimatedMealLog(entry) ? `${entry.estimatedRecord.components.length} components` : `${entry.consumedServings} serving${entry.consumedServings === 1 ? '' : 's'}`} · {marketLabel(isPackagedLabelLog(entry) ? entry.result.market : isEstimatedMealLog(entry) ? entry.estimatedRecord.market : entry.curatedRecord.market)}</span>
                  <small>{logStatusLabel(entry)}{entry.updatedAt ? ` · edited ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(entry.updatedAt))}` : ''}</small>
                </button>
                <div className="history-values"><span>{historyValue(entry, 'totalCarbohydrate')} <small>carbs</small></span><span>{historyValue(entry, 'totalSugars')} <small>sugars</small></span><span>{historyValue(entry, 'addedSugars')} <small>added</small></span></div>
                {entry.retainedImages?.length ? <span className="images-kept" title={`${entry.retainedImages.length} images stored locally`}><Image size={15} /> {entry.retainedImages.length}</span> : <span className="images-kept no-images">No images</span>}
                <button className="icon-button history-open-button" onClick={() => setSelectedId(entry.id)} aria-label={`Open ${entry.productName}`}><Eye size={16} /></button>
                <button className="delete-button" disabled={deleting === entry.id} onClick={() => void removeLog(entry)} aria-label={`Delete ${entry.productName}`}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
        )}
      </section>
      {logs.length > 0 && (
        <section className="card data-privacy-card">
          <div><span className="section-kicker">Data & privacy</span><h2>Local records</h2><p>These records are stored in this browser. Deleting them does not affect Daily Dozen meal items already copied outside Sugar pAI.</p></div>
          <button className="danger-text-button" onClick={() => setDeleteAllOpen(true)}><Trash2 size={16} /> Delete all local data</button>
        </section>
      )}
      {deleteAllOpen && (
        <ConfirmationModal
          title="Delete all local Sugar pAI records?"
          body="This removes every saved Sugar pAI history record from this browser. The action cannot be undone."
          confirmLabel="Delete all records"
          busy={deleting === 'all'}
          onCancel={() => setDeleteAllOpen(false)}
          onConfirm={() => void removeAll()}
        />
      )}
      {selectedEntry && (isPackagedLabelLog(selectedEntry) ? (
        <HistoryDetailDrawer
          key={`${selectedEntry.id}-${selectedEntry.updatedAt ?? selectedEntry.loggedAt}`}
          entry={selectedEntry}
          onClose={() => setSelectedId(null)}
        />
      ) : isEstimatedMealLog(selectedEntry) ? (
        <EstimatedMealHistoryDrawer
          key={`${selectedEntry.id}-${selectedEntry.loggedAt}`}
          entry={selectedEntry}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <CuratedDemoHistoryDrawer
          key={`${selectedEntry.id}-${selectedEntry.updatedAt ?? selectedEntry.loggedAt}`}
          entry={selectedEntry}
          onClose={() => setSelectedId(null)}
        />
      ))}
    </div>
  )
}

function historyValue(entry: LogEntry, key: 'totalCarbohydrate' | 'totalSugars' | 'addedSugars'): string {
  if (isEstimatedMealLog(entry)) {
    const range = entry.rangeTotals[key]
    return range ? `~${entry.totals[key] ?? '—'}g (${range.minimum}–${range.maximum})` : '—'
  }
  return entry.totals[key] == null ? '—' : `${entry.totals[key]}g`
}
