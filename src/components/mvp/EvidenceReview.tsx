import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  Info,
  LoaderCircle,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NUTRIENT_KEYS, NUTRIENT_META, correctionsFromResult, makeLogTotals } from '../../domain/nutrition'
import {
  buildIngredientContextFlags,
  buildPairingInsights,
  deterministicSmartContextSnapshot,
  smartContextRequestFromAnalysis,
  smartContextResponseToInsights,
  type PairingInsight,
} from '../../domain/pairing'
import type {
  AnalysisResult,
  FinalizeCorrections,
  LogEntry,
  MealSlot,
  MethodDiagnostic,
  PanelDiagnostic,
  SmartContextFlag,
  SmartContextResponse,
} from '../../domain/types'
import { finalizeAnalysis, resolveSmartContext } from '../../lib/api'
import { saveLog } from '../../lib/db'
import type { AnalysisImages } from '../../lib/api'
import ImagePreviewButton from './ImagePreviewButton'
import PairingIdeas from './PairingIdeas'
import { GlycemicEvidenceBlock, TechnicalDetails } from './uiHelpers'
import { formatSmartContextMode, normalizeIngredientDisplay, reviewStatusLabel, sourceLabel } from './uiDisplay'

interface Props {
  result: AnalysisResult
  images: AnalysisImages
  onBack: () => void
  onLogged: (entry: LogEntry) => void | Promise<void>
  onValidated?: (result: AnalysisResult) => void
}

function numberFromInput(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function StatusPill({ status }: { status: string }) {
  const slug = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`status-pill status-${slug}`}>{status}</span>
}

function statusLabel(status: string | undefined): string {
  if (!status) return 'Not reported'
  return status[0].toUpperCase() + status.slice(1)
}

function flagCategoryLabel(flag: SmartContextFlag): string {
  return flag.category.replaceAll('_', ' ')
}

function panelSummary(panel: PanelDiagnostic | null | undefined): string {
  if (!panel) return 'Not supplied'
  if (panel.status === 'skipped') return 'Not supplied'
  if (panel.status === 'failed') return 'Panel failed server checks'
  return 'Panel available for vision review'
}

function methodStatus(method: MethodDiagnostic | null | undefined): string {
  if (!method) return 'Not reported'
  const bits = [statusLabel(method.status)]
  if (method.model) bits.push(method.model)
  if (method.latencyMs != null) bits.push(`${method.latencyMs} ms`)
  return bits.join(' · ')
}

export default function EvidenceReview({ result, images, onBack, onLogged, onValidated }: Props) {
  const [corrections, setCorrections] = useState<FinalizeCorrections>(() => correctionsFromResult(result))
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState<AnalysisResult | null>(null)
  const [resultsMode, setResultsMode] = useState(result.status === 'confirmed')
  const [meal, setMeal] = useState<MealSlot>('Snack')
  const [retainImages, setRetainImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ingredientsEditorOpen, setIngredientsEditorOpen] = useState(false)
  const [smartContextSnapshot, setSmartContextSnapshot] = useState<SmartContextResponse | null>(null)
  const [resolvedPairingInsights, setResolvedPairingInsights] = useState<PairingInsight[] | null>(null)

  const current = confirmed ?? result
  const validatedRecord = confirmed ?? (edited.size === 0 && result.status === 'confirmed' ? result : null)
  const requiredComplete = corrections.productName.trim().length > 0 && corrections.consumedServings > 0
  const hasNutrition = NUTRIENT_KEYS.some((key) => corrections.nutrients[key] != null)
  const changed = (key: string) => {
    setConfirmed(null)
    setResultsMode(false)
    setResolvedPairingInsights(null)
    setSmartContextSnapshot(null)
    setEdited((previous) => new Set(previous).add(key))
  }

  const limitations = useMemo(() => Array.from(new Set(current.limitations)), [current.limitations])
  const diagnostics = current.diagnostics
  const fallbackReason = diagnostics?.fallbackReason
  const ingredientFieldHasText = Boolean(current.rawIngredients.value?.trim())
  const ingredientTextAccepted = ['label', 'database'].includes(current.rawIngredients.sourceKind) && ingredientFieldHasText
  const ingredientFlags = useMemo(() => buildIngredientContextFlags(current), [current])
  const pairingInsights = useMemo(
    () => current.status === 'confirmed'
      ? buildPairingInsights({
        result: current,
        consumedServings: corrections.consumedServings,
        meal,
        productName: corrections.productName,
      })
      : [],
    [corrections.consumedServings, corrections.productName, current, meal],
  )
  const visiblePairingInsights = resolvedPairingInsights ?? pairingInsights

  useEffect(() => {
    if (current.status !== 'confirmed') return
    let active = true
    const context = {
      result: current,
      consumedServings: corrections.consumedServings,
      meal,
      productName: corrections.productName,
    }
    void resolveSmartContext(smartContextRequestFromAnalysis(context)).then((response) => {
      if (!active) return
      setSmartContextSnapshot(response)
      setResolvedPairingInsights(smartContextResponseToInsights(response))
    }).catch(() => undefined)
    return () => { active = false }
  }, [corrections.consumedServings, corrections.productName, current, meal])
  const capturedImages = [
    { kind: 'nutrition' as const, label: 'Nutrition', file: images.nutrition },
    { kind: 'ingredients' as const, label: 'Ingredients', file: images.ingredients },
    { kind: 'front' as const, label: 'Front', file: images.front },
  ].filter((item): item is { kind: 'nutrition' | 'ingredients' | 'front'; label: string; file: File } => Boolean(item.file))

  const validate = async () => {
    setSaving(true)
    setError(null)
    setResolvedPairingInsights(null)
    setSmartContextSnapshot(null)
    try {
      const next = await finalizeAnalysis(result.analysisId, corrections)
      setConfirmed(next)
      setResultsMode(true)
      onValidated?.(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not validate corrections.')
    } finally {
      setSaving(false)
    }
  }

  const log = async () => {
    if (!validatedRecord) return
    setSaving(true)
    try {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        kind: 'packaged_label',
        analysisId: validatedRecord.analysisId,
        loggedAt: new Date().toISOString(),
        meal,
        consumedServings: corrections.consumedServings,
        productName: corrections.productName.trim(),
        result: validatedRecord,
        smartContextSnapshot: smartContextSnapshot ?? deterministicSmartContextSnapshot(pairingInsights),
        totals: makeLogTotals(validatedRecord, corrections.consumedServings),
        retainedImages: retainImages && capturedImages.length > 0
          ? capturedImages.map((image) => ({ kind: image.kind, blob: image.file, name: image.file.name }))
          : undefined,
      }
      await saveLog(entry)
      await onLogged(entry)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save locally.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`page review-page ${resultsMode ? 'results-page' : ''}`}>
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Retake or replace images</button>
      <div className="review-heading">
        <div>
          <span className="eyebrow">{resultsMode ? 'Validated product' : 'Review evidence'}</span>
          <h1>{resultsMode ? 'Your evidence, in context.' : 'Confirm the label'}</h1>
          <p>{resultsMode ? 'Smart Context uses only the label values you confirmed.' : 'Not declared / unavailable stays blank, not zero. Correct each field you can verify from the photographed panel.'}</p>
        </div>
        <div className={`result-state state-${current.status}`}><FileCheck2 size={18} /> {reviewStatusLabel(current.status)}</div>
      </div>

      <div className="notice neutral"><Info size={18} /><span>This tool explains package labels for adult research use. It does not predict glucose or provide medical advice.</span></div>
      {current.retakeRecommended && current.retakeReasons.length > 0 && (
        <div className="notice warning retake-notice">
          <AlertCircle size={18} />
          <span>{current.retakeReasons.join(' ')}</span>
        </div>
      )}

      {resultsMode && (
        <section className="results-product-summary">
          <div>
            <span className="section-kicker">Product summary</span>
            <h2>{current.product.name.value}</h2>
            <p>{current.serving.size.value == null ? 'Serving not declared / unavailable' : `Per ${current.serving.size.value} ${current.serving.unit ?? current.serving.size.unit ?? ''}`}</p>
            <small className="section-source">Source: {sourceLabel(current.product.name.sourceKind)}</small>
          </div>
          <div className="results-nutrients">
            {(['totalCarbohydrate', 'totalSugars', 'addedSugars', 'fiber'] as const).map((key) => {
              const field = current.nutrients[key]
              const showStatus = field.status === 'Unavailable' || field.status === 'Conflict' || field.status === 'User confirmed' || field.sourceKind === 'database'
              return <div key={key}><span>{NUTRIENT_META[key].label}</span><strong>{field.value == null ? 'Not declared / unavailable' : `${field.value} g`}</strong>{showStatus && <small>{field.status}</small>}</div>
            })}
          </div>
          <button className="secondary-button" onClick={() => setResultsMode(false)}>Edit evidence</button>
        </section>
      )}

      {resultsMode && current.status === 'confirmed' && <PairingIdeas insights={visiblePairingInsights} />}

      <div className="review-layout">
        {!resultsMode && (
        <div className="review-main">
          <section className="card form-card">
            <div className="section-heading"><div><span className="section-kicker">Product & serving</span><h2>Serving basis</h2></div></div>
            <label className="field full-field">
              <span>Product name</span>
              <input
                value={corrections.productName}
                placeholder="Enter the name printed on the package"
                onChange={(event) => {
                  changed('productName')
                  setCorrections((value) => ({ ...value, productName: event.target.value }))
                }}
              />
              <StatusPill status={edited.has('productName') ? 'User confirmed' : current.product.name.status} />
            </label>
            <div className="two-fields">
              <label className="field">
                <span>Serving size</span>
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="any"
                  value={corrections.servingSize ?? ''}
                  placeholder="Not declared / unavailable"
                  onChange={(event) => {
                    changed('servingSize')
                    setCorrections((value) => ({ ...value, servingSize: numberFromInput(event.target.value) }))
                  }}
                />
                <StatusPill status={edited.has('servingSize') ? 'User confirmed' : current.serving.size.status} />
              </label>
              <label className="field">
                <span>Serving unit</span>
                <input
                  value={corrections.servingUnit}
                  placeholder="g, mL, piece"
                  onChange={(event) => {
                    changed('servingUnit')
                    setCorrections((value) => ({ ...value, servingUnit: event.target.value }))
                  }}
                />
              </label>
            </div>
          </section>

          <section className="card form-card">
            <div className="section-heading">
              <div><span className="section-kicker">Per labeled serving</span><h2>Carbohydrate-first review</h2></div>
              <span className="unit-label">grams</span>
            </div>
            <div className="nutrient-fields">
              {NUTRIENT_KEYS.map((key) => (
                <label className={`field nutrient-field nutrient-${key}`} key={key}>
                  <span>{NUTRIENT_META[key].label}</span>
                  <input
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="any"
                    value={corrections.nutrients[key] ?? ''}
                    placeholder="Not declared / unavailable"
                    onChange={(event) => {
                      changed(key)
                      const value = numberFromInput(event.target.value)
                      setCorrections((previous) => ({
                        ...previous,
                        nutrients: { ...previous.nutrients, [key]: value },
                      }))
                    }}
                  />
                  <small>{NUTRIENT_META[key].helper}</small>
                  <StatusPill status={edited.has(key) ? 'User confirmed' : current.nutrients[key].status} />
                </label>
              ))}
            </div>
          </section>

          <section className="card form-card">
            <div className="section-heading"><div><span className="section-kicker">Ingredient order</span><h2>Ingredient context flags</h2></div></div>
            <label className="field full-field">
              <span>Ingredients, in printed order</span>
              <textarea
                className="desktop-ingredients-editor"
                rows={5}
                value={corrections.rawIngredients}
                placeholder={fallbackReason ? `No ingredient text accepted: ${fallbackReason}` : 'No ingredient text accepted'}
                onChange={(event) => {
                  changed('ingredients')
                  setCorrections((value) => ({ ...value, rawIngredients: event.target.value }))
                }}
              />
              <button type="button" className="mobile-field-editor-button" onClick={() => setIngredientsEditorOpen(true)}>
                <span>{normalizeIngredientDisplay(corrections.rawIngredients) || 'Not declared / unavailable'}</span><strong>Edit ingredients</strong>
              </button>
              <StatusPill status={edited.has('ingredients') ? 'User confirmed' : current.rawIngredients.status} />
            </label>
            {!ingredientFieldHasText && !corrections.rawIngredients.trim() && (
              <p className="empty-inline">No ingredient text accepted{fallbackReason ? `: ${fallbackReason}` : '. Confirm by typing it from the panel if readable.'}</p>
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
              <p className="empty-inline">No ingredient context flags are accepted yet. Confirm the ingredient text to run the versioned taxonomy.</p>
            )}
          </section>
        </div>
        )}

        <aside className={`review-aside ${resultsMode ? 'results-audit-columns' : ''}`}>
          {!resultsMode ? (
            <>
              <section className="card captured-images-card">
                <span className="section-kicker">Captured evidence</span>
                <div className="captured-image-list">
                  {capturedImages.length > 0 ? capturedImages.map((image) => (
                    <div className="captured-image-row" key={image.label}>
                      <ImagePreviewButton file={image.file} label={`${image.label} panel`} className="captured-image-button" />
                      <div><strong>{image.label}</strong><span>{image.file.name}</span></div>
                    </div>
                  )) : <p className="empty-inline">No captured panels were needed for this database match.</p>}
                </div>
              </section>
              <div className="notice neutral derived-context-note"><Info size={17} /><span>Derived context becomes available after validation.</span></div>
            </>
          ) : (
            <>
              <div className="context-column">
                <section className="card glycemic-card">
                  <span className="section-kicker">Glycemic evidence</span>
                  <GlycemicEvidenceBlock glycemic={current.glycemic} />
                </section>

                <details className="card captured-images-card disclosure-card" open>
                  <summary>Evidence used</summary>
                  <div className="disclosure-body">
                    <div className="captured-image-list">
                      {capturedImages.length > 0 ? capturedImages.map((image) => (
                        <div className="captured-image-row" key={image.label}>
                          <ImagePreviewButton file={image.file} label={`${image.label} panel`} className="captured-image-button" />
                          <div><strong>{image.label}</strong><span>{image.file.name}</span></div>
                        </div>
                      )) : <p className="empty-inline">No captured panels were needed for this database match.</p>}
                    </div>
                    {capturedImages.length > 0 && (
                      <label className="checkbox-row image-retention-row">
                        <input type="checkbox" checked={retainImages} onChange={(event) => setRetainImages(event.target.checked)} />
                        <span><strong>Keep original images on this device</strong><small>Off by default. Images are otherwise removed from the server after 15 minutes.</small></span>
                      </label>
                    )}
                  </div>
                </details>

                {limitations.length > 0 && (
                  <details className="card limitations-card disclosure-card">
                    <summary>Limitations</summary>
                    <div className="disclosure-body">
                      <ul>{limitations.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  </details>
                )}
              </div>

              <div className="context-column">
                <details className="card explainer-card disclosure-card">
                  <summary>Interpretation</summary>
                  <div className="disclosure-body">
                    <div><strong>What is printed</strong><p>The values above use one serving basis and retain their evidence status.</p></div>
                    <div><strong>What may influence response</strong><p>Total carbohydrate, portion, fiber, protein, fat, preparation, and individual response can all matter.</p></div>
                    <div><strong>What cannot be determined</strong><p>The label cannot reveal grams of each named sweetener or predict your blood glucose.</p></div>
                  </div>
                </details>

                <TechnicalDetails>
                  <div className="diagnostic-row"><strong>Barcode</strong><span>{current.product.barcode.value ? `${current.product.barcode.status}: ${current.product.barcode.value}` : 'No barcode accepted'}</span></div>
                  <div className="diagnostic-row"><strong>Label extraction</strong><span>{statusLabel(diagnostics?.extractionStatus)}</span></div>
                  <div className="diagnostic-row"><strong>Ingredient read</strong><span>{ingredientTextAccepted ? `Accepted as ${current.rawIngredients.status}` : current.rawIngredients.sourceKind === 'user' ? 'User confirmed manually' : 'No ingredient text accepted'}</span></div>
                  <div className="diagnostic-row"><strong>Ingredients raw</strong><span>{current.rawIngredients.value || 'Unavailable'}</span></div>
                  <div className="diagnostic-row"><strong>Smart Context</strong><span>{formatSmartContextMode(smartContextSnapshot)}</span></div>
                  {smartContextSnapshot && <div className="diagnostic-row"><strong>Rule version</strong><span>{smartContextSnapshot.provenance.ruleVersion}</span></div>}
                  {smartContextSnapshot?.provenance.model && <div className="diagnostic-row"><strong>Writer model</strong><span>{smartContextSnapshot.provenance.model}</span></div>}
                  <div className="diagnostic-row"><strong>Vision model</strong><span>{diagnostics?.visionModel ?? 'Unavailable'}</span></div>
                  <div className="method-diagnostics">
                    {[
                      ['Vision extraction', diagnostics?.vlm] as const,
                    ].map(([label, method]) => (
                      <div key={label} className={`method-diagnostic method-${method?.status ?? 'skipped'}`}>
                        <div><strong>{label}</strong><span>{methodStatus(method)}</span></div>
                        {method?.imagePanels.length ? <small>Panels: {method.imagePanels.join(', ')}</small> : null}
                        {method?.failureReason && <small className="candidate-warning">{method.failureReason}</small>}
                        {method?.validationFailures.map((failure) => <small className="candidate-warning" key={failure}>{failure}</small>)}
                      </div>
                    ))}
                  </div>
                  {fallbackReason && <div className="diagnostic-fallback"><AlertCircle size={16} /><span>{fallbackReason}</span></div>}
                  <div className="panel-diagnostic-list">
                    {[
                      ['Nutrition', diagnostics?.panels.nutrition] as const,
                      ['Ingredients', diagnostics?.panels.ingredients] as const,
                      ['Front', diagnostics?.panels.front] as const,
                    ].map(([label, panel]) => (
                      <div key={label} className={`panel-diagnostic panel-diagnostic-${panel?.status ?? 'skipped'}`}>
                        <div><strong>{label}</strong><span>{panelSummary(panel)}</span></div>
                        {panel?.warnings.map((warning) => <small key={warning}>{warning}</small>)}
                      </div>
                    ))}
                  </div>
                </TechnicalDetails>
              </div>
            </>
          )}
        </aside>
      </div>

      <section className="card log-card">
        <div>
          <span className="section-kicker">{validatedRecord ? 'Log this portion' : 'Validation'}</span>
          <h2>{validatedRecord ? 'Log this portion' : 'Validate label values'}</h2>
          <p>{validatedRecord ? 'Your label values remain per serving; Today totals use the multiplier below.' : 'Confirm the printed values first. Smart Context and logging unlock after validation.'}</p>
        </div>
        <div className="log-controls">
          <label className="compact-field"><span>Servings consumed</span><input type="number" min="0.1" step="0.1" value={corrections.consumedServings} onChange={(event) => {
            changed('consumedServings')
            setCorrections((value) => ({ ...value, consumedServings: Number(event.target.value) }))
          }} /></label>
          <label className="compact-field"><span>Meal</span><select value={meal} onChange={(event) => { setMeal(event.target.value as MealSlot); setResolvedPairingInsights(null); setSmartContextSnapshot(null) }}>{['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'].map((slot) => <option key={slot}>{slot}</option>)}</select></label>
        </div>
        {error && <div className="notice error"><AlertCircle size={17} />{error}</div>}
        {!hasNutrition && <div className="notice warning"><AlertCircle size={17} />Enter at least one printed nutrition value before confirming.</div>}
        {!validatedRecord ? (
          <button className="primary-button wide" disabled={!requiredComplete || !hasNutrition || saving} onClick={validate}>
            {saving ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />} Validate corrections
          </button>
        ) : (
          <div className="confirmed-actions">
            <div><CheckCircle2 size={21} /><span><strong>Deterministic checks passed</strong><small>Manual corrections are marked “User confirmed.”</small></span></div>
            <button className="primary-button" disabled={saving} onClick={log}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Save to Today</button>
          </div>
        )}
      </section>

      {ingredientsEditorOpen && (
        <div className="mobile-ingredients-editor" role="dialog" aria-modal="true" aria-label="Edit ingredients">
          <header><div><span className="section-kicker">Ingredient evidence</span><strong>Ingredients, in printed order</strong></div><button className="icon-button" onClick={() => setIngredientsEditorOpen(false)} aria-label="Close ingredients editor"><X size={20} /></button></header>
          <textarea autoFocus value={corrections.rawIngredients} placeholder="Not declared / unavailable" onChange={(event) => {
            changed('ingredients')
            setCorrections((value) => ({ ...value, rawIngredients: event.target.value }))
          }} />
          <button className="primary-button" onClick={() => setIngredientsEditorOpen(false)}>Done editing</button>
        </div>
      )}
    </div>
  )
}
