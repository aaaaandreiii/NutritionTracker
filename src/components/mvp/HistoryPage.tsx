import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  History,
  Image,
  Info,
  LoaderCircle,
  Pencil,
  Save,
  ScanLine,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NUTRIENT_KEYS, NUTRIENT_META, correctionsFromResult, makeLogTotals } from '../../domain/nutrition'
import type {
  AnalysisResult,
  FinalizeCorrections,
  LabelRecordValidation,
  LogEntry,
  MealSlot,
  ValidationCheck,
} from '../../domain/types'
import { useLogs } from '../../hooks/useLogs'
import { validateLabelRecord } from '../../lib/api'
import { deleteAllLogs, deleteLog, exportLogsCsv, exportLogsJson, saveLog } from '../../lib/db'
import ImagePreviewButton from './ImagePreviewButton'

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

function correctionsFromLog(entry: LogEntry): FinalizeCorrections {
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
  return value == null ? 'Unknown' : `${value} g`
}

function statusSlug(status: string): string {
  return status.toLowerCase().replaceAll(' ', '-')
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${statusSlug(status)}`}>{status}</span>
}

function validationSummary(checks: ValidationCheck[]): string {
  if (checks.some((check) => check.status === 'fail')) return 'Failed'
  if (checks.some((check) => check.status === 'review')) return 'Needs review'
  return checks.length ? 'Passed' : 'Not validated'
}

function glBandLabel(band: AnalysisResult['glycemic']['glBand']): string {
  if (band === 'green') return 'Green demo band'
  if (band === 'yellow') return 'Yellow demo band'
  if (band === 'red') return 'Red demo band'
  return 'GL unavailable'
}

function mergeValidatedRecord(
  entry: LogEntry,
  corrections: FinalizeCorrections,
  meal: MealSlot,
  validation: LabelRecordValidation,
): LogEntry {
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

function HistoryDetailDrawer({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
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

  const save = async () => {
    if (!requiredComplete || !hasNutrition) return
    setSaving(true)
    setError(null)
    try {
      const validation = await validateLabelRecord(normalizedDraft)
      await saveLog(mergeValidatedRecord(entry, normalizedDraft, meal, validation))
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
            <div><span>GL band</span><strong>{glBandLabel(entry.result.glycemic.glBand)}</strong></div>
          </section>

          <section className="drawer-section">
            <div className="section-heading">
              <div><span className="section-kicker">Product & serving</span><h3>Record details</h3></div>
              <StatusPill status={validationLabel} />
            </div>
            <label className="field full-field">
              <span>Product name</span>
              <input
                disabled={!editing}
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
                  disabled={!editing}
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
                  disabled={!editing}
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
                  disabled={!editing}
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Unknown"
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
                  disabled={!editing}
                  value={draft.servingUnit}
                  placeholder="g, mL, piece"
                  onChange={(event) => {
                    markEdited('servingUnit')
                    setDraft((value) => ({ ...value, servingUnit: event.target.value }))
                  }}
                />
              </label>
            </div>
            <div className="drawer-meta-grid">
              <span><strong>Market</strong>{entry.result.market}</span>
              <span><strong>Analysis</strong>{entry.analysisId}</span>
              <span><strong>Status</strong>{entry.result.status}</span>
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-heading">
              <div><span className="section-kicker">Per labeled serving</span><h3>Nutrients</h3></div>
              <span className="unit-label">grams</span>
            </div>
            <div className="nutrient-fields">
              {NUTRIENT_KEYS.map((key) => (
                <label className={`field nutrient-field nutrient-${key}`} key={key}>
                  <span>{NUTRIENT_META[key].label}</span>
                  <input
                    disabled={!editing}
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.nutrients[key] ?? ''}
                    placeholder="Unknown"
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
          </section>

          <section className="drawer-section">
            <div className="section-heading"><div><span className="section-kicker">Ingredient order</span><h3>Ingredients & sugar variants</h3></div></div>
            <label className="field full-field">
              <span>Ingredients, in printed order</span>
              <textarea
                disabled={!editing}
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
            {entry.result.sugarVariants.length > 0 ? (
              <div className="variant-list">
                {entry.result.sugarVariants.map((variant) => (
                  <div className="variant-row" key={`${variant.ingredientRank}-${variant.rawSpan}`}>
                    <span className="rank">#{variant.ingredientRank}</span>
                    <div><strong>{variant.canonicalName}</strong><small>Printed as “{variant.rawSpan}” · {variant.category}</small></div>
                    <Tag size={16} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-inline">No sugar variants are currently matched for this record.</p>
            )}
          </section>

          <section className="drawer-section">
            <div className="section-heading"><div><span className="section-kicker">Glycemic evidence</span><h3>Demo GL status</h3></div></div>
            {entry.result.glycemic.gl != null ? (
              <div className={`heuristic-block band-${entry.result.glycemic.glBand ?? 'unknown'}`}>
                <div className="demo-gl-value"><strong>{entry.result.glycemic.gl}</strong><span>Demo GL</span></div>
                <div className="band-pill">{glBandLabel(entry.result.glycemic.glBand)}</div>
                <p>{entry.result.glycemic.reason}</p>
                <small>Net carbohydrate: {entry.result.glycemic.availableCarbohydrateGrams ?? 'unavailable'} g.</small>
              </div>
            ) : (
              <div className="unavailable-block">
                <AlertCircle size={22} />
                <strong>GL unavailable</strong>
                <p>{entry.result.glycemic.reason}</p>
              </div>
            )}
          </section>

          <section className="drawer-section">
            <div className="section-heading"><div><span className="section-kicker">Validation status</span><h3>Backend checks</h3></div></div>
            <div className="validation-list">
              {entry.result.validationChecks.map((check) => (
                <div className={`validation-row validation-${check.status}`} key={check.code}>
                  {check.status === 'pass' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <div><strong>{check.code.replaceAll('_', ' ')}</strong><span>{check.message}</span></div>
                  <StatusPill status={check.status} />
                </div>
              ))}
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-heading"><div><span className="section-kicker">Retained images</span><h3>Local images</h3></div></div>
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
          </section>

          {error && <div className="notice error"><AlertCircle size={17} />{error}</div>}
          {editing && edited.size > 0 && <div className="notice neutral"><Info size={17} />Saving edits requires backend validation. Daily Dozen meal snapshots are not changed.</div>}
          {editing && !hasNutrition && <div className="notice warning"><AlertCircle size={17} />Enter at least one printed nutrition value before saving.</div>}
        </div>

        <footer className="history-drawer-actions">
          {!editing ? (
            <button type="button" className="primary-button" onClick={() => setEditing(true)}><Pencil size={17} /> Edit record</button>
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

export default function HistoryPage({ onScan }: Props) {
  const { logs, loading } = useLogs()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedEntry = useMemo(
    () => logs.find((entry) => entry.id === selectedId) ?? null,
    [logs, selectedId],
  )

  const removeAll = async () => {
    if (!window.confirm('Delete every local Sugar pAI log? This cannot be undone.')) return
    await deleteAllLogs()
    setSelectedId(null)
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
        <div><span className="eyebrow"><History size={14} /> History</span><h1>Your confirmed label records.</h1><p>Stored only in this browser. Open a record to review, edit, validate, export, or delete it.</p></div>
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
                <button type="button" className="history-details history-details-button" onClick={() => setSelectedId(entry.id)}>
                  <strong>{entry.productName}</strong>
                  <span>{entry.meal} · {entry.consumedServings} serving{entry.consumedServings === 1 ? '' : 's'} · {entry.result.market}</span>
                  <small>Analysis {entry.analysisId.slice(0, 8)}… · {entry.result.status}{entry.updatedAt ? ` · edited ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(entry.updatedAt))}` : ''}</small>
                </button>
                <div className="history-values"><span>{entry.totals.totalCarbohydrate ?? '—'}g <small>carbs</small></span><span>{entry.totals.totalSugars ?? '—'}g <small>sugars</small></span><span>{entry.totals.addedSugars ?? '—'}g <small>added</small></span></div>
                {entry.retainedImages?.length ? <span className="images-kept" title={`${entry.retainedImages.length} images stored locally`}><Image size={15} /> {entry.retainedImages.length}</span> : <span className="images-kept no-images">No images</span>}
                <button className="icon-button history-open-button" onClick={() => setSelectedId(entry.id)} aria-label={`Open ${entry.productName}`}><Eye size={16} /></button>
                <button className="delete-button" disabled={deleting === entry.id} onClick={() => void removeLog(entry)} aria-label={`Delete ${entry.productName}`}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
        )}
      </section>
      {logs.length > 0 && <button className="danger-text-button" onClick={() => void removeAll()}><Trash2 size={16} /> Delete all local data</button>}
      {selectedEntry && (
        <HistoryDetailDrawer
          key={`${selectedEntry.id}-${selectedEntry.updatedAt ?? selectedEntry.loggedAt}`}
          entry={selectedEntry}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
