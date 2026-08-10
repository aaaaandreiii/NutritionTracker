import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Info,
  LoaderCircle,
  Save,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { NUTRIENT_KEYS, NUTRIENT_META, correctionsFromResult, makeLogTotals } from '../../domain/nutrition'
import type {
  AnalysisResult,
  FinalizeCorrections,
  LogEntry,
  MealSlot,
  MethodDiagnostic,
  PanelDiagnostic,
} from '../../domain/types'
import { finalizeAnalysis } from '../../lib/api'
import { saveLog } from '../../lib/db'
import type { AnalysisImages } from '../../lib/api'
import ImagePreviewButton from './ImagePreviewButton'

interface Props {
  result: AnalysisResult
  images: AnalysisImages
  onBack: () => void
  onLogged: (entry: LogEntry) => void | Promise<void>
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

function glBandLabel(band: AnalysisResult['glycemic']['glBand']): string {
  if (band === 'green') return 'Green demo band'
  if (band === 'yellow') return 'Yellow demo band'
  if (band === 'red') return 'Red demo band'
  return 'GL unavailable'
}

function statusLabel(status: string | undefined): string {
  if (!status) return 'Not reported'
  return status[0].toUpperCase() + status.slice(1)
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

export default function EvidenceReview({ result, images, onBack, onLogged }: Props) {
  const [corrections, setCorrections] = useState<FinalizeCorrections>(() => correctionsFromResult(result))
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState<AnalysisResult | null>(null)
  const [meal, setMeal] = useState<MealSlot>('Snack')
  const [retainImages, setRetainImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = confirmed ?? result
  const requiredComplete = corrections.productName.trim().length > 0 && corrections.consumedServings > 0
  const hasNutrition = NUTRIENT_KEYS.some((key) => corrections.nutrients[key] != null)
  const changed = (key: string) => {
    setConfirmed(null)
    setEdited((previous) => new Set(previous).add(key))
  }

  const limitations = useMemo(() => Array.from(new Set(current.limitations)), [current.limitations])
  const diagnostics = current.diagnostics
  const fallbackReason = diagnostics?.fallbackReason
  const ingredientFieldHasText = Boolean(current.rawIngredients.value?.trim())
  const ingredientTextAccepted = current.rawIngredients.sourceKind === 'label' && ingredientFieldHasText
  const capturedImages = [
    { label: 'Nutrition', file: images.nutrition },
    { label: 'Ingredients', file: images.ingredients },
    { label: 'Front', file: images.front },
  ].filter((item): item is { label: string; file: File } => Boolean(item.file))

  const validate = async () => {
    setSaving(true)
    setError(null)
    try {
      setConfirmed(await finalizeAnalysis(result.analysisId, corrections))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not validate corrections.')
    } finally {
      setSaving(false)
    }
  }

  const log = async () => {
    if (!confirmed) return
    setSaving(true)
    try {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        analysisId: confirmed.analysisId,
        loggedAt: new Date().toISOString(),
        meal,
        consumedServings: corrections.consumedServings,
        productName: corrections.productName.trim(),
        result: confirmed,
        totals: makeLogTotals(confirmed, corrections.consumedServings),
        retainedImages: retainImages
          ? [
              { kind: 'nutrition' as const, blob: images.nutrition, name: images.nutrition.name },
              ...(images.ingredients ? [{ kind: 'ingredients' as const, blob: images.ingredients, name: images.ingredients.name }] : []),
              ...(images.front ? [{ kind: 'front' as const, blob: images.front, name: images.front.name }] : []),
            ]
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
    <div className="page review-page">
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Retake or replace images</button>
      <div className="review-heading">
        <div>
          <span className="eyebrow">Review evidence</span>
          <h1>Confirm what the label actually says.</h1>
          <p>Blank means unknown—not zero. Correct every field that you can verify in the photographed panel.</p>
        </div>
        <div className={`result-state state-${current.status}`}><FileCheck2 size={18} /> {current.status}</div>
      </div>

      <div className="notice neutral"><Info size={18} /><span>This tool explains package labels for adult research use. It does not predict glucose or provide medical advice.</span></div>
      {current.retakeRecommended && current.retakeReasons.length > 0 && (
        <div className="notice warning retake-notice">
          <AlertCircle size={18} />
          <span>{current.retakeReasons.join(' ')}</span>
        </div>
      )}

      <div className="review-layout">
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
                  placeholder="Unknown"
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
                    placeholder="Unknown"
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
            <div className="section-heading"><div><span className="section-kicker">Ingredient order</span><h2>Sugar-related ingredients</h2></div></div>
            <label className="field full-field">
              <span>Ingredients, in printed order</span>
              <textarea
                rows={5}
                value={corrections.rawIngredients}
                placeholder={fallbackReason ? `No ingredient text accepted: ${fallbackReason}` : 'No ingredient text accepted'}
                onChange={(event) => {
                  changed('ingredients')
                  setCorrections((value) => ({ ...value, rawIngredients: event.target.value }))
                }}
              />
              <StatusPill status={edited.has('ingredients') ? 'User confirmed' : current.rawIngredients.status} />
            </label>
            {!ingredientFieldHasText && !corrections.rawIngredients.trim() && (
              <p className="empty-inline">No ingredient text accepted{fallbackReason ? `: ${fallbackReason}` : '. Confirm by typing it from the panel if readable.'}</p>
            )}
            {current.sugarVariants.length > 0 ? (
              <div className="variant-list">
                {current.sugarVariants.map((variant) => (
                  <div className="variant-row" key={`${variant.ingredientRank}-${variant.rawSpan}`}>
                    <span className="rank">#{variant.ingredientRank}</span>
                    <div><strong>{variant.canonicalName}</strong><small>Printed as “{variant.rawSpan}” · {variant.category}</small></div>
                    <Tag size={16} />
                  </div>
                ))}
              </div>
            ) : <p className="empty-inline">No sugar variants are accepted yet. Confirm the ingredient text to run the versioned taxonomy.</p>}
          </section>
        </div>

        <aside className="review-aside">
          <section className="card captured-images-card">
            <span className="section-kicker">Captured panels</span>
            <div className="captured-image-list">
              {capturedImages.map((image) => (
                <div className="captured-image-row" key={image.label}>
                  <ImagePreviewButton file={image.file} label={`${image.label} panel`} className="captured-image-button" />
                  <div><strong>{image.label}</strong><span>{image.file.name}</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className="card extraction-card">
            <span className="section-kicker">Vision details</span>
            <div className="diagnostic-row">
              <strong>Barcode</strong>
              <span>{current.product.barcode.value ? `${current.product.barcode.status}: ${current.product.barcode.value}` : 'No barcode accepted'}</span>
            </div>
            <div className="diagnostic-row">
              <strong>Label extraction</strong>
              <span>{statusLabel(diagnostics?.extractionStatus)}</span>
            </div>
            <div className="diagnostic-row">
              <strong>Ingredient read</strong>
              <span>{ingredientTextAccepted ? `Accepted as ${current.rawIngredients.status}` : current.rawIngredients.sourceKind === 'user' ? 'User confirmed manually' : 'No ingredient text accepted'}</span>
            </div>
            <div className="diagnostic-row">
              <strong>Vision model</strong>
              <span>{diagnostics?.visionModel ?? 'Unavailable'}</span>
            </div>
            <div className="method-diagnostics">
              {[
                ['VLM', diagnostics?.vlm] as const,
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
          </section>

          <section className="card glycemic-card">
            <span className="section-kicker">Glycemic evidence</span>
            {current.glycemic.status === 'sourced' ? (
              <>
                <div className="gi-value"><strong>{current.glycemic.gi}</strong><span>Sourced GI</span></div>
                <p>{current.glycemic.testedFoodMatchDescription}</p>
                {current.glycemic.gl != null && <p><strong>GL {current.glycemic.gl}</strong> for the validated consumed portion.</p>}
                {current.glycemic.citation && <a href={current.glycemic.citation.url} target="_blank" rel="noreferrer">{current.glycemic.citation.title}<ExternalLink size={13} /></a>}
              </>
            ) : current.glycemic.status === 'heuristic_demo' ? (
              <div className={`heuristic-block band-${current.glycemic.glBand ?? 'unknown'}`}>
                <div className="demo-gl-value"><strong>{current.glycemic.gl ?? '—'}</strong><span>Demo GL</span></div>
                <div className="band-pill">{glBandLabel(current.glycemic.glBand)}</div>
                <p>{current.glycemic.reason}</p>
                {current.glycemic.gi != null && <small>Alias demo GI input: {current.glycemic.gi}. Net carbohydrate: {current.glycemic.availableCarbohydrateGrams ?? 'unavailable'} g.</small>}
                {current.glycemic.licensing && <small>{current.glycemic.licensing}</small>}
              </div>
            ) : (
              <div className="unavailable-block">
                <AlertCircle size={22} />
                <strong>GI unavailable</strong>
                <p>{current.glycemic.reason}</p>
                <small>Sourced GI cannot be calculated from sugar grams or ingredient order. Demo GL also requires confirmed carbohydrate, fiber, and sugar-alias evidence.</small>
              </div>
            )}
          </section>

          <section className="card explainer-card">
            <span className="section-kicker">Interpretation</span>
            <div><strong>What is printed</strong><p>The values above use one serving basis and retain their evidence status.</p></div>
            <div><strong>What may influence response</strong><p>Total carbohydrate, portion, fiber, protein, fat, preparation, and individual response can all matter.</p></div>
            <div><strong>What cannot be determined</strong><p>The label cannot reveal grams of each named sweetener or predict your blood glucose.</p></div>
          </section>

          {limitations.length > 0 && (
            <section className="card limitations-card">
              <span className="section-kicker">Limitations</span>
              <ul>{limitations.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
        </aside>
      </div>

      <section className="card log-card">
        <div>
          <span className="section-kicker">Consumed portion</span>
          <h2>Confirm, then log locally</h2>
          <p>Your label values remain per serving; Today totals use the multiplier below.</p>
        </div>
        <div className="log-controls">
          <label className="compact-field"><span>Servings consumed</span><input type="number" min="0.1" step="0.1" value={corrections.consumedServings} onChange={(event) => {
            changed('consumedServings')
            setCorrections((value) => ({ ...value, consumedServings: Number(event.target.value) }))
          }} /></label>
          <label className="compact-field"><span>Meal</span><select value={meal} onChange={(event) => setMeal(event.target.value as MealSlot)}>{['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'].map((slot) => <option key={slot}>{slot}</option>)}</select></label>
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={retainImages} onChange={(event) => setRetainImages(event.target.checked)} /><span><strong>Keep original images on this device</strong><small>Off by default. Images are otherwise removed from the server after 15 minutes.</small></span></label>
        {error && <div className="notice error"><AlertCircle size={17} />{error}</div>}
        {!hasNutrition && <div className="notice warning"><AlertCircle size={17} />Enter at least one printed nutrition value before confirming.</div>}
        {!confirmed ? (
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
    </div>
  )
}
