import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Info,
  LoaderCircle,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react'
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { NUTRIENT_KEYS, NUTRIENT_META, correctionsFromResult, makeLogTotals } from '../../domain/nutrition'
import {
  buildIngredientContextFlags,
  buildPairingInsights,
  buildSnackPairingIdeas,
  deterministicSmartContextSnapshot,
  smartContextRequestFromAnalysis,
  smartContextResponseToInsights,
  type PairingInsight,
} from '../../domain/pairing'
import type {
  AnalysisResult,
  FinalizeCorrections,
  GlycemicEvidence,
  LogEntry,
  MealSlot,
  MethodDiagnostic,
  NutrientKey,
  PanelDiagnostic,
  SmartContextFlag,
  SmartContextResponse,
} from '../../domain/types'
import { finalizeAnalysis, resolveSmartContext } from '../../lib/api'
import { saveLog } from '../../lib/db'
import type { AnalysisImages } from '../../lib/api'
import ImagePreviewButton from './ImagePreviewButton'
import PairingIdeas from './PairingIdeas'
import SnackPairingSection from './SnackPairingSection'
import {
  formatProductDisplayName,
  formatNutriScoreGrade,
  getNovaPresentation,
  formatSmartContextMode,
  normalizeIngredientDisplay,
  normalizeNameDisplay,
  sourceLabel,
  type NovaPresentation,
} from './uiDisplay'

interface Props {
  result: AnalysisResult
  images: AnalysisImages
  onBack: () => void
  onLogged: (entry: LogEntry) => void | Promise<void>
  onValidated?: (result: AnalysisResult) => void
  onReviewing?: (result: AnalysisResult) => void
}

type CapturedImage = { kind: 'nutrition' | 'ingredients' | 'front'; label: string; file: File }

const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other']
const SUMMARY_NUTRIENTS = ['totalCarbohydrate', 'totalSugars', 'addedSugars', 'fiber'] as const satisfies readonly NutrientKey[]
const PERMANENT_HELPER_NUTRIENTS = new Set<NutrientKey>(['totalCarbohydrate', 'addedSugars'])

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

function sourceSummary(sourceKind: string | null | undefined): string {
  if (sourceKind === 'database') return 'Database match'
  if (sourceKind === 'label') return 'From photo'
  if (sourceKind === 'user') return 'Edited by you'
  if (sourceKind === 'calculated') return 'Calculated'
  return 'Unavailable'
}

function fieldBadge({
  edited,
  status,
  sourceKind,
  value,
  missingLabel = 'Unavailable',
}: {
  edited: boolean
  status?: string
  sourceKind?: string | null
  value?: unknown
  missingLabel?: string
}): string | null {
  if (edited) return 'Edited'
  if (value == null || status === 'Unavailable') return missingLabel
  if (status === 'Conflict') return 'Needs review'
  if (sourceKind === 'label') return 'From photo'
  if (sourceKind === 'user') return 'Edited'
  return null
}

function nutrientBadge(
  key: NutrientKey,
  current: AnalysisResult,
  corrections: FinalizeCorrections,
  edited: Set<string>,
): string | null {
  const field = current.nutrients[key]
  return fieldBadge({
    edited: edited.has(key),
    status: field.status,
    sourceKind: field.sourceKind,
    value: corrections.nutrients[key],
    missingLabel: 'Not declared',
  })
}

function formatNutrientValue(value: number | null): string {
  return value == null ? 'Not declared' : `${value} g`
}

function servingUnit(result: AnalysisResult, corrections: FinalizeCorrections): string {
  return corrections.servingUnit.trim() || result.serving.unit || result.serving.size.unit || 'g'
}

function servingSummary(result: AnalysisResult, corrections: FinalizeCorrections): string {
  if (corrections.servingSize == null) return 'Serving not declared'
  return `Per ${corrections.servingSize} ${servingUnit(result, corrections)}`
}

function displayProduct(result: AnalysisResult, corrections: FinalizeCorrections): string {
  return formatProductDisplayName(
    corrections.productName || result.product.name.value,
    corrections.servingSize ?? result.serving.size.value,
    servingUnit(result, corrections),
  )
}

function statusForRank(rank: number): string {
  const lastTwo = rank % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`
  switch (rank % 10) {
    case 1: return `${rank}st`
    case 2: return `${rank}nd`
    case 3: return `${rank}rd`
    default: return `${rank}th`
  }
}

function flagRank(flag: SmartContextFlag): string | null {
  const match = flag.evidenceLabels.join(' ').match(/#(\d+)/)
  return match ? statusForRank(Number(match[1])) : null
}

function flagPackageTerm(flag: SmartContextFlag): string {
  const ranked = flag.evidenceLabels.find((label) => /^#\d+\s+/.test(label))
  if (ranked) return normalizeNameDisplay(ranked.replace(/^#\d+\s+/, ''), flag.label)
  return normalizeNameDisplay(flag.label)
}

function consumerFlagCopy(flag: SmartContextFlag): { title: string; body: string; meta: string | null } {
  const term = flagPackageTerm(flag)
  const rank = flagRank(flag)
  if (flag.category === 'sugar_alias' || flag.category === 'hfcs' || flag.category === 'high_intensity_sweetener') {
    return {
      title: /sugar|sucrose|fructose|syrup|sweetener/i.test(term) ? 'Sugar detected' : `${term} detected`,
      body: `${term} appears${rank ? ` ${rank}` : ''} in the ingredient list. Ingredient order confirms presence but does not reveal how many grams come from that ingredient.`,
      meta: flag.label.toLowerCase() !== term.toLowerCase() ? `Mapped for context as ${normalizeNameDisplay(flag.label)}.` : null,
    }
  }
  if (flag.category === 'starch' || flag.category === 'maltodextrin') {
    return {
      title: `${term} detected`,
      body: `${term} is present in the ingredient list. Use this as context alongside the confirmed carbohydrate value, not as a product-specific glycemic estimate.`,
      meta: rank ? `Ingredient order: ${rank}.` : null,
    }
  }
  if (flag.category === 'polyol') {
    return {
      title: `${term} detected`,
      body: `${term} appears in the ingredient list. Only use sugar-alcohol grams when the Nutrition Facts panel declares them.`,
      meta: rank ? `Ingredient order: ${rank}.` : null,
    }
  }
  return {
    title: normalizeNameDisplay(flag.label),
    body: 'This is ingredient-list context only. It is not a food rating and does not provide ingredient quantities.',
    meta: flag.evidenceLabels.length ? flag.evidenceLabels.join(' · ') : null,
  }
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

export default function EvidenceReview({ result, images, onBack, onLogged, onValidated, onReviewing }: Props) {
  const [corrections, setCorrections] = useState<FinalizeCorrections>(() => correctionsFromResult(result))
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState<AnalysisResult | null>(null)
  const [resultsMode, setResultsMode] = useState(result.status === 'confirmed')
  const [meal, setMeal] = useState<MealSlot>('Snack')
  const [retainImages, setRetainImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ingredientsEditing, setIngredientsEditing] = useState(false)
  const [ingredientsEditorOpen, setIngredientsEditorOpen] = useState(false)
  const [smartContextSnapshot, setSmartContextSnapshot] = useState<SmartContextResponse | null>(null)
  const [resolvedPairingInsights, setResolvedPairingInsights] = useState<PairingInsight[] | null>(null)

  const current = confirmed ?? result
  const validatedRecord = confirmed ?? (edited.size === 0 && result.status === 'confirmed' ? result : null)
  const canConfirmLabel = corrections.productName.trim().length > 0
  const hasNutrition = NUTRIENT_KEYS.some((key) => corrections.nutrients[key] != null)
  const editedCount = edited.size
  const diagnostics = current.diagnostics
  const fallbackReason = diagnostics?.fallbackReason
  const ingredientFieldHasText = Boolean(current.rawIngredients.value?.trim())
  const ingredientTextAccepted = ['label', 'database'].includes(current.rawIngredients.sourceKind) && ingredientFieldHasText
  const ingredientFlags = useMemo(() => buildIngredientContextFlags(current), [current])
  const limitations = useMemo(() => Array.from(new Set(current.limitations)), [current.limitations])
  const externalMetadata = current.externalMetadata ?? null
  const novaPresentation = getNovaPresentation(externalMetadata?.novaGroup, externalMetadata?.novaGroupsTags)
  const nutriScoreGrade = formatNutriScoreGrade(externalMetadata?.nutriscoreGrade)
  const displayName = displayProduct(current, corrections)
  const productNameForInput = edited.has('productName')
    ? corrections.productName
    : normalizeNameDisplay(corrections.productName || current.product.name.value, '')
  const ingredientsForDisplay = normalizeIngredientDisplay(corrections.rawIngredients || current.rawIngredients.value)

  const changed = (key: string) => {
    setConfirmed(null)
    setResultsMode(false)
    setResolvedPairingInsights(null)
    setSmartContextSnapshot(null)
    setEdited((previous) => new Set(previous).add(key))
  }

  const startReviewing = () => {
    const reviewingResult = current.status === 'confirmed' ? { ...current, status: 'ready' as const } : current
    setConfirmed(null)
    setResultsMode(false)
    setResolvedPairingInsights(null)
    setSmartContextSnapshot(null)
    onReviewing?.(reviewingResult)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const updateLogServings = (value: string) => {
    const parsed = Number(value)
    setCorrections((previous) => ({ ...previous, consumedServings: Number.isFinite(parsed) ? parsed : 0 }))
    setResolvedPairingInsights(null)
    setSmartContextSnapshot(null)
  }

  const updateMeal = (value: MealSlot) => {
    setMeal(value)
    setResolvedPairingInsights(null)
    setSmartContextSnapshot(null)
  }

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
  const snackPairing = useMemo(
    () => current.status === 'confirmed'
      ? buildSnackPairingIdeas({
        result: current,
        consumedServings: corrections.consumedServings,
        meal,
        productName: corrections.productName,
      })
      : null,
    [corrections.consumedServings, corrections.productName, current, meal],
  )

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
    { kind: 'nutrition' as const, label: 'Nutrition Facts', file: images.nutrition },
    { kind: 'ingredients' as const, label: 'Ingredients', file: images.ingredients },
    { kind: 'front' as const, label: 'Front label', file: images.front },
  ].filter((item): item is CapturedImage => Boolean(item.file))
  const hasCapturedEvidence = capturedImages.length > 0

  const validate = async () => {
    if (!canConfirmLabel || !hasNutrition) return
    setSaving(true)
    setError(null)
    setResolvedPairingInsights(null)
    setSmartContextSnapshot(null)
    try {
      const next = await finalizeAnalysis(result.analysisId, corrections)
      setConfirmed(next)
      setResultsMode(true)
      onValidated?.(next)
      window.scrollTo({ top: 0, behavior: 'auto' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not confirm label values.')
    } finally {
      setSaving(false)
    }
  }

  const log = async () => {
    if (!validatedRecord || corrections.consumedServings <= 0) return
    setSaving(true)
    try {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        kind: 'packaged_label',
        analysisId: validatedRecord.analysisId,
        loggedAt: new Date().toISOString(),
        meal,
        consumedServings: corrections.consumedServings,
        productName: displayName,
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
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Back to evidence</button>
      <div className="review-heading">
        <div>
          <span className="eyebrow">{resultsMode ? 'Validated product' : 'Review evidence'}</span>
          <h1>{resultsMode ? 'Your evidence, in context.' : 'Confirm the label'}</h1>
          <p>{resultsMode ? 'Context is based on the package values you confirmed.' : 'Check the values below against the package. Leave anything not declared as unavailable rather than entering zero.'}</p>
        </div>
      </div>

      <div className="safety-note"><Info size={16} /><span>Sugar pAI explains package labels for adult research use. It does not predict glucose or provide medical advice.</span></div>
      {current.retakeRecommended && current.retakeReasons.length > 0 && !resultsMode && (
        <div className="notice warning retake-notice">
          <AlertCircle size={18} />
          <span>{current.retakeReasons.join(' ')}</span>
        </div>
      )}

      {!resultsMode ? (
        <>
          <div className={`review-layout ${hasCapturedEvidence ? 'has-evidence-rail' : 'review-no-rail'}`}>
            <div className="review-main">
              <section className="review-source-summary" aria-label="Review source summary">
                <strong>{displayName}</strong>
                <span>{sourceSummary(current.product.name.sourceKind)} · {servingSummary(current, corrections)}</span>
              </section>

              <ProductServingCard
                current={current}
                corrections={corrections}
                edited={edited}
                productNameForInput={productNameForInput}
                onChange={changed}
                setCorrections={setCorrections}
              />

              <NutritionReviewCard
                current={current}
                corrections={corrections}
                edited={edited}
                onChange={changed}
                setCorrections={setCorrections}
              />

              <section className="card form-card ingredients-review-card">
                <div className="section-heading">
                  <div><span className="section-kicker">Ingredients</span><h2>Ingredient list</h2></div>
                  <StatusBadge label={fieldBadge({
                    edited: edited.has('ingredients'),
                    status: current.rawIngredients.status,
                    sourceKind: current.rawIngredients.sourceKind,
                    value: current.rawIngredients.value,
                  })} />
                </div>

                {!ingredientsEditing ? (
                  <div className="ingredient-display-panel">
                    {ingredientsForDisplay ? <p>{ingredientsForDisplay}</p> : (
                      <p className="ingredient-empty-copy">No ingredient text was available. Add it from the package if the panel is readable.</p>
                    )}
                    <button
                      type="button"
                      className="secondary-button ingredient-edit-button"
                      onClick={() => {
                        setIngredientsEditing(true)
                        if (window.innerWidth <= 900) setIngredientsEditorOpen(true)
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <label className="field full-field ingredient-editor-field">
                    <span>Ingredients, in printed order</span>
                    <textarea
                      className="desktop-ingredients-editor"
                      rows={5}
                      value={edited.has('ingredients') ? corrections.rawIngredients : ingredientsForDisplay}
                      placeholder={fallbackReason ? `No ingredient text accepted: ${fallbackReason}` : 'No ingredient text accepted'}
                      onChange={(event) => {
                        changed('ingredients')
                        setCorrections((value) => ({ ...value, rawIngredients: event.target.value }))
                      }}
                    />
                    <button type="button" className="mobile-field-editor-button" onClick={() => setIngredientsEditorOpen(true)}>
                      <span>{ingredientsForDisplay || 'Not declared / unavailable'}</span><strong>Edit ingredients</strong>
                    </button>
                  </label>
                )}

                {edited.has('ingredients') ? (
                  <p className="empty-inline">Ingredient context will refresh after you confirm these label values.</p>
                ) : ingredientFlags.length > 0 ? (
                  <div className="consumer-flag-list">
                    {ingredientFlags.map((flag) => {
                      const copy = consumerFlagCopy(flag)
                      return (
                        <div className={`consumer-context-flag flag-${flag.category}`} key={flag.id}>
                          <strong>{copy.title}</strong>
                          <p>{copy.body}</p>
                          {copy.meta && <small>{copy.meta}</small>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="empty-inline">No sugar-source ingredient context is available from the accepted ingredient text.</p>
                )}
              </section>
            </div>

            {hasCapturedEvidence && (
              <aside className="review-aside">
                <section className="card captured-images-card captured-evidence-rail">
                  <span className="section-kicker">Captured evidence</span>
                  <CapturedEvidenceList images={capturedImages} />
                </section>
              </aside>
            )}
          </div>

          <section className="card review-action-card">
            <div>
              <span className="section-kicker">Confirmation</span>
              <h2>Confirm label values</h2>
              <p>Smart Context starts after the package values are confirmed. Logging details come later.</p>
              {editedCount > 0 && <small>{editedCount} value{editedCount === 1 ? '' : 's'} edited</small>}
            </div>
            {error && <div className="notice error"><AlertCircle size={17} />{error}</div>}
            {!hasNutrition && <div className="notice warning"><AlertCircle size={17} />Enter at least one printed nutrition value before confirming.</div>}
            <div className="review-actions">
              <button type="button" className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> Back to evidence</button>
              <button className="primary-button" disabled={!canConfirmLabel || !hasNutrition || saving} onClick={validate}>
                {saving ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />} Confirm label values
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="context-stack">
            <section className="card context-product-summary">
              <div className="context-summary-head">
                <div>
                  <span className="section-kicker">Product summary</span>
                  <h2>{displayName}</h2>
                  <p>{servingSummary(current, corrections)}</p>
                </div>
                <div className="context-summary-actions">
                  <span>Values confirmed by you</span>
                  <button className="secondary-button" onClick={startReviewing}>Edit evidence</button>
                </div>
              </div>
              <div className="context-metric-grid">
                {SUMMARY_NUTRIENTS.map((key) => (
                  <div key={key}>
                    <span>{NUTRIENT_META[key].label}</span>
                    <strong>{formatNutrientValue(current.nutrients[key].value)}</strong>
                  </div>
                ))}
              </div>
            </section>

            {current.status === 'confirmed' && <PairingIdeas insights={visiblePairingInsights} />}

            {novaPresentation && <ProcessingContextCard presentation={novaPresentation} metadata={externalMetadata} />}

            {ingredientFlags.length > 0 && <IngredientContextCard flags={ingredientFlags} />}

            {current.status === 'confirmed' && snackPairing && (
              <SnackPairingSection pairing={snackPairing} productDisplayName={displayName} />
            )}

            <section className="card interpretation-card">
              <div className="section-heading">
                <div><span className="section-kicker">Interpretation</span><h2>What the label can tell us</h2></div>
              </div>
              <div className="interpretation-grid">
                <div><strong>What the label tells us</strong><p>The values above use one serving basis and keep declared zero separate from values that were not declared.</p></div>
                <div><strong>What may influence response</strong><p>Total carbohydrate, portion, fiber, protein, fat, preparation, meal order, and individual response can all matter.</p></div>
                <div><strong>What the label cannot determine</strong><p>The label cannot reveal grams of each named sweetener or predict your blood glucose response.</p></div>
              </div>
            </section>

            <section className="card glycemic-card context-glycemic-card">
              <div className="section-heading">
                <div><span className="section-kicker">Glycemic evidence</span><h2>Product-specific data</h2></div>
              </div>
              <GlycemicEvidenceSummary glycemic={current.glycemic} />
            </section>

            {nutriScoreGrade && <ExternalProductMetadataCard grade={nutriScoreGrade} metadata={externalMetadata} />}

            <details className="card sources-limitations-card disclosure-card">
              <summary>Sources & limitations</summary>
              <div className="disclosure-body">
                <ul className="sources-limitations-list">
                  <li>Product information came from {sourceLabel(current.product.name.sourceKind)}.</li>
                  <li>Nutrition values were confirmed by you before Smart Context was shown.</li>
                  <li>Ingredients were {ingredientTextAccepted || current.rawIngredients.sourceKind === 'user' ? 'confirmed for context' : 'not available'}.</li>
                  <li>Ingredient order cannot reveal ingredient quantities.</li>
                  <li>{current.glycemic.status === 'sourced' ? 'A tested glycemic-index source was available for comparison.' : 'No tested product-specific glycemic study was available.'}</li>
                  {novaPresentation && <li>NOVA processing context was imported from Open Food Facts metadata. It does not predict individual glucose response.</li>}
                  {nutriScoreGrade && <li>Nutri-Score was imported from Open Food Facts metadata. It is not a diabetes or glucose-response score.</li>}
                  <li>Sugar pAI does not predict individual glucose response.</li>
                  {limitations.map((item) => <li key={item}>{item}</li>)}
                </ul>
                {hasCapturedEvidence ? (
                  <>
                    <div className="sources-evidence-block">
                      <strong>Captured panels</strong>
                      <CapturedEvidenceList images={capturedImages} />
                    </div>
                    <label className="checkbox-row image-retention-row">
                      <input type="checkbox" checked={retainImages} onChange={(event) => setRetainImages(event.target.checked)} />
                      <span><strong>Keep original images on this device</strong><small>Off by default. Images are otherwise removed from the server after 15 minutes.</small></span>
                    </label>
                  </>
                ) : (
                  <p className="empty-inline">No captured photos were used for this database match.</p>
                )}
                {import.meta.env.DEV && (
                  <DeveloperDiagnostics
                    current={current}
                    diagnostics={diagnostics}
                    ingredientTextAccepted={ingredientTextAccepted}
                    smartContextSnapshot={smartContextSnapshot}
                    fallbackReason={fallbackReason}
                  />
                )}
              </div>
            </details>
          </div>

          <section className="card log-card post-context-log-card">
            <div>
              <span className="section-kicker">Log</span>
              <h2>Log this portion</h2>
              <p>Your label values remain per serving. Today totals use the multiplier below.</p>
            </div>
            <div className="log-controls">
              <label className="compact-field"><span>Servings consumed</span><input type="number" min="0.1" step="0.1" value={corrections.consumedServings} onChange={(event) => updateLogServings(event.target.value)} /></label>
              <label className="compact-field"><span>Meal</span><select value={meal} onChange={(event) => updateMeal(event.target.value as MealSlot)}>{MEAL_SLOTS.map((slot) => <option key={slot}>{slot}</option>)}</select></label>
            </div>
            {error && <div className="notice error"><AlertCircle size={17} />{error}</div>}
            <div className="confirmed-actions">
              <div><CheckCircle2 size={21} /><span><strong>Ready to log</strong><small>Context is based on confirmed label values.</small></span></div>
              <button className="primary-button" disabled={saving || corrections.consumedServings <= 0} onClick={log}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Save to Today</button>
            </div>
          </section>
        </>
      )}

      {ingredientsEditorOpen && (
        <div className="mobile-ingredients-editor" role="dialog" aria-modal="true" aria-label="Edit ingredients">
          <header><div><span className="section-kicker">Ingredient evidence</span><strong>Ingredients, in printed order</strong></div><button className="icon-button" onClick={() => setIngredientsEditorOpen(false)} aria-label="Close ingredients editor"><X size={20} /></button></header>
          <textarea autoFocus value={edited.has('ingredients') ? corrections.rawIngredients : ingredientsForDisplay} placeholder="Not declared / unavailable" onChange={(event) => {
            changed('ingredients')
            setCorrections((value) => ({ ...value, rawIngredients: event.target.value }))
          }} />
          <button className="primary-button" onClick={() => setIngredientsEditorOpen(false)}>Done editing</button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ label }: { label: string | null }) {
  return label ? <StatusPill status={label} /> : null
}

function ProductServingCard({
  current,
  corrections,
  edited,
  productNameForInput,
  onChange,
  setCorrections,
}: {
  current: AnalysisResult
  corrections: FinalizeCorrections
  edited: Set<string>
  productNameForInput: string
  onChange: (key: string) => void
  setCorrections: Dispatch<SetStateAction<FinalizeCorrections>>
}) {
  return (
    <section className="card form-card product-serving-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Product & serving</span>
          <h2>Serving basis</h2>
        </div>
        <span className="section-source">Source: {sourceSummary(current.product.name.sourceKind)}</span>
      </div>
      <label className="label-input-stack product-name-field">
        <span>Product name</span>
        <input
          value={productNameForInput}
          placeholder="Enter the name printed on the package"
          onChange={(event) => {
            onChange('productName')
            setCorrections((value) => ({ ...value, productName: event.target.value }))
          }}
        />
        <StatusBadge label={fieldBadge({
          edited: edited.has('productName'),
          status: current.product.name.status,
          sourceKind: current.product.name.sourceKind,
          value: current.product.name.value,
        })} />
      </label>
      <div className="product-serving-grid">
        <label className="label-input-stack">
          <span>Serving size</span>
          <input
            inputMode="decimal"
            type="number"
            min="0"
            step="any"
            value={corrections.servingSize ?? ''}
            placeholder="Unavailable"
            onChange={(event) => {
              onChange('servingSize')
              setCorrections((value) => ({ ...value, servingSize: numberFromInput(event.target.value) }))
            }}
          />
          <StatusBadge label={fieldBadge({
            edited: edited.has('servingSize'),
            status: current.serving.size.status,
            sourceKind: current.serving.size.sourceKind,
            value: corrections.servingSize,
          })} />
        </label>
        <label className="label-input-stack">
          <span>Unit</span>
          <input
            value={corrections.servingUnit}
            placeholder="g, mL, piece"
            onChange={(event) => {
              onChange('servingUnit')
              setCorrections((value) => ({ ...value, servingUnit: event.target.value }))
            }}
          />
        </label>
      </div>
    </section>
  )
}

function NutritionReviewCard({
  current,
  corrections,
  edited,
  onChange,
  setCorrections,
}: {
  current: AnalysisResult
  corrections: FinalizeCorrections
  edited: Set<string>
  onChange: (key: string) => void
  setCorrections: Dispatch<SetStateAction<FinalizeCorrections>>
}) {
  return (
    <section className="card form-card nutrition-review-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Per labeled serving</span>
          <h2>Nutrition per serving</h2>
        </div>
        <span className="section-source">Source: {sourceSummary(current.nutrients.totalCarbohydrate.sourceKind)}</span>
      </div>
      <div className="nutrient-review-rows" role="group" aria-label="Nutrition values per serving">
        {NUTRIENT_KEYS.map((key) => {
          const badge = nutrientBadge(key, current, corrections, edited)
          return (
            <div className={`nutrient-review-row nutrient-${key}`} key={key}>
              <div className="nutrient-review-label">
                <label htmlFor={`review-${key}`}>{NUTRIENT_META[key].label}</label>
                {PERMANENT_HELPER_NUTRIENTS.has(key) && <small>{NUTRIENT_META[key].helper}</small>}
              </div>
              <div className="nutrient-value-control">
                <input
                  id={`review-${key}`}
                  aria-label={`${NUTRIENT_META[key].label} grams`}
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="any"
                  value={corrections.nutrients[key] ?? ''}
                  placeholder="--"
                  onChange={(event) => {
                    onChange(key)
                    const value = numberFromInput(event.target.value)
                    setCorrections((previous) => ({
                      ...previous,
                      nutrients: { ...previous.nutrients, [key]: value },
                    }))
                  }}
                />
                <span>g</span>
              </div>
              <div className="field-status-cell">
                <StatusBadge label={badge} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CapturedEvidenceList({ images }: { images: CapturedImage[] }) {
  return (
    <div className="captured-image-list">
      {images.map((image) => (
        <div className="captured-image-row" key={image.label}>
          <ImagePreviewButton file={image.file} label={`${image.label} panel`} className="captured-image-button" />
          <div><strong>{image.label}</strong><span>{image.file.name}</span><small>Uploaded</small></div>
        </div>
      ))}
    </div>
  )
}

function metadataSourceName(metadata: AnalysisResult['externalMetadata']): string {
  const source = metadata?.sourceName?.trim()
  return source && /open food facts/i.test(source) ? 'Open Food Facts' : source || 'Open Food Facts'
}

function MetadataSource({ metadata }: { metadata: AnalysisResult['externalMetadata'] }) {
  const label = metadataSourceName(metadata)
  if (metadata?.sourceUrl) {
    return (
      <a className="metadata-source-link" href={metadata.sourceUrl} target="_blank" rel="noreferrer">
        Source: {label}<ExternalLink size={12} />
      </a>
    )
  }
  return <span className="metadata-source-link">Source: {label}</span>
}

function ProcessingContextCard({
  presentation,
  metadata,
}: {
  presentation: NovaPresentation
  metadata: AnalysisResult['externalMetadata']
}) {
  return (
    <section className="card processing-context-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Processing context</span>
          <h2>NOVA classification</h2>
        </div>
        <Info size={18} />
      </div>
      <div className="metadata-main-row">
        <span className="metadata-badge">{presentation.badge}</span>
        <strong>{presentation.label}</strong>
      </div>
      <p>NOVA describes the extent and purpose of food processing. It does not predict your individual glucose response.</p>
      <MetadataSource metadata={metadata} />
      <details className="metadata-disclosure">
        <summary>About NOVA</summary>
        <p>NOVA classifies foods by the extent and purpose of processing, from minimally processed foods (Group 1) to ultra-processed products (Group 4). It provides processing context rather than predicting your glucose response.</p>
      </details>
    </section>
  )
}

function IngredientContextCard({ flags }: { flags: SmartContextFlag[] }) {
  return (
    <section className="card ingredient-context-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Ingredient context</span>
          <h2>Detected from ingredients</h2>
        </div>
      </div>
      <div className="consumer-flag-list">
        {flags.map((flag) => {
          const copy = consumerFlagCopy(flag)
          return (
            <div className={`consumer-context-flag flag-${flag.category}`} key={flag.id}>
              <strong>{copy.title}</strong>
              <p>{copy.body}</p>
              {copy.meta && <small>{copy.meta}</small>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ExternalProductMetadataCard({
  grade,
  metadata,
}: {
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  metadata: AnalysisResult['externalMetadata']
}) {
  return (
    <section className="card external-metadata-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">External metadata</span>
          <h2>Community database metadata</h2>
        </div>
      </div>
      <div className="external-metadata-row">
        <div>
          <strong>Nutri-Score · Grade {grade}</strong>
          <p>A general nutrition-quality classification from Open Food Facts. It is not a diabetes or glucose-response score.</p>
          <MetadataSource metadata={metadata} />
        </div>
        <span className="metadata-badge">Grade {grade}</span>
      </div>
      <details className="metadata-disclosure">
        <summary>About Nutri-Score</summary>
        <p>Nutri-Score summarizes general nutritional composition. It is not designed to predict glucose response or diabetes suitability.</p>
      </details>
    </section>
  )
}

function GlycemicEvidenceSummary({ glycemic }: { glycemic: GlycemicEvidence }) {
  if (glycemic.status === 'sourced') {
    return (
      <div className="glycemic-sourced-block">
        <div className="gi-value"><strong>{glycemic.gi}</strong><span>Sourced GI</span></div>
        {glycemic.testedFoodMatchDescription && <p>{glycemic.testedFoodMatchDescription}</p>}
        {glycemic.gl != null && <p><strong>GL {glycemic.gl}</strong> for the confirmed consumed portion.</p>}
        {glycemic.citation && <a href={glycemic.citation.url} target="_blank" rel="noreferrer">{glycemic.citation.title}<ExternalLink size={13} /></a>}
      </div>
    )
  }

  return (
    <div className="glycemic-empty-state">
      <Info size={19} />
      <div>
        <strong>No tested glycemic-index data found for this product.</strong>
        <p>Sugar pAI will not estimate a product-specific GI from its ingredient list.</p>
        <details>
          <summary>How missing glycemic evidence is handled</summary>
          <p>Ingredient names and sugar grams can provide context, but they are not a substitute for tested product-specific glycemic evidence.</p>
        </details>
      </div>
    </div>
  )
}

function DeveloperDiagnostics({
  current,
  diagnostics,
  ingredientTextAccepted,
  smartContextSnapshot,
  fallbackReason,
}: {
  current: AnalysisResult
  diagnostics: AnalysisResult['diagnostics']
  ingredientTextAccepted: boolean
  smartContextSnapshot: SmartContextResponse | null
  fallbackReason: string | null | undefined
}) {
  return (
    <details className="developer-diagnostics">
      <summary>Development diagnostics</summary>
      <div className="technical-details-body">
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
      </div>
    </details>
  )
}
