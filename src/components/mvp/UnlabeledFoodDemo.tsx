import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NUTRIENT_KEYS, NUTRIENT_META, rangeMidpoint } from '../../domain/nutrition'
import type {
  CuratedFoodCandidate,
  EstimatedMealComponentDraft,
  EstimatedMealDraft,
  EstimatedMealRecord,
  LogEntry,
  MealSlot,
  NumericRange,
  SmartContextResponse,
  SmartContextResolveRequest,
} from '../../domain/types'
import {
  createUnlabeledMealAnalysis,
  deleteUnlabeledMealAnalysis,
  finalizeUnlabeledMealAnalysis,
  getUnlabeledFoodCatalog,
  resolveSmartContext,
  searchFoodData,
  streamUnlabeledMealAnalysis,
} from '../../lib/api'
import { saveLog } from '../../lib/db'
import { inspectImage } from '../../lib/imageQuality'
import CameraCapture from './CameraCapture'
import ImagePanelCard from './ImagePanelCard'
import { formatSmartContextMode } from './uiDisplay'

interface Props {
  onLogged: (entry: LogEntry) => void | Promise<void>
}

const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other']

export default function UnlabeledFoodDemo({ onLogged }: Props) {
  const [catalog, setCatalog] = useState<CuratedFoodCandidate[]>([])
  const [catalogLimitations, setCatalogLimitations] = useState<string[]>([])
  const [foodImage, setFoodImage] = useState<File | null>(null)
  const [imageReport, setImageReport] = useState<Awaited<ReturnType<typeof inspectImage>> | undefined>()
  const [checkingImage, setCheckingImage] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EstimatedMealDraft | null>(null)
  const [record, setRecord] = useState<EstimatedMealRecord | null>(null)
  const [smartContext, setSmartContext] = useState<SmartContextResponse | null>(null)
  const [manualQuery, setManualQuery] = useState('')
  const [matchQueries, setMatchQueries] = useState<Record<string, string>>({})
  const [stageLabels, setStageLabels] = useState<string[]>([])
  const [mealName, setMealName] = useState('Estimated meal')
  const [meal, setMeal] = useState<MealSlot>('Other')
  const [retainImage, setRetainImage] = useState(false)
  const [quickAddExpanded, setQuickAddExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getUnlabeledFoodCatalog('PH').then((payload) => {
      if (!cancelled) {
        setCatalog(payload.foods)
        setCatalogLimitations(payload.limitations)
      }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const components = useMemo(() => draft?.components ?? [], [draft?.components])
  const validationErrors = useMemo(() => validateComponents(components), [components])
  const canFinalize = Boolean(analysisId && components.length > 0 && validationErrors.length === 0)
  const visibleQuickAdd = quickAddExpanded ? catalog : catalog.slice(0, 8)
  const hiddenQuickAddCount = Math.max(catalog.length - visibleQuickAdd.length, 0)

  const chooseFoodImage = async (file: File) => {
    setCheckingImage(true)
    setImageReport(undefined)
    setError(null)
    try {
      setImageReport(await inspectImage(file))
      setFoodImage(file)
      setDraft(null)
      setRecord(null)
      setSmartContext(null)
    } catch {
      setFoodImage(null)
      setError('This image could not be read. Choose a JPEG, PNG, or WebP photo.')
    } finally {
      setCheckingImage(false)
    }
  }

  const runAnalysis = async (image?: File, description?: string, curatedFallback?: CuratedFoodCandidate) => {
    setBusy(true)
    setError(null)
    setRecord(null)
    setSmartContext(null)
    setStageLabels([])
    try {
      if (analysisId) await deleteUnlabeledMealAnalysis(analysisId)
      const nextId = await createUnlabeledMealAnalysis(image, description)
      setAnalysisId(nextId)
      const nextDraft = await streamUnlabeledMealAnalysis(nextId, (event) => {
        if (event.type === 'stage' && event.label) {
          setStageLabels((previous) => [...previous.filter((item) => item !== event.label), event.label!].slice(-3))
        }
      })
      const normalizedDraft = curatedFallback && nextDraft.components[0] ? {
        ...nextDraft,
        components: [{
          ...nextDraft.components[0],
          identifiedName: curatedFallback.displayName,
          householdPortion: curatedFallback.portionLabels[0] ?? 'user-described portion',
          candidates: [],
          selectedFdcId: null,
          contextOnly: true,
          qualitativeTags: curatedFallback.qualitativeTags,
          sourcePath: 'curated' as const,
        }],
      } : nextDraft
      setDraft(normalizedDraft)
      if (nextDraft.components.length === 1 && mealName === 'Estimated meal') {
        setMealName(nextDraft.components[0].identifiedName)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not analyse this meal.')
    } finally {
      setBusy(false)
    }
  }

  const updateComponent = (componentId: string, change: Partial<EstimatedMealComponentDraft>) => {
    setDraft((previous) => previous ? {
      ...previous,
      components: previous.components.map((component) => component.componentId === componentId ? { ...component, ...change } : component),
    } : previous)
    setRecord(null)
    setSmartContext(null)
    setError(null)
  }

  const searchDifferentMatch = async (component: EstimatedMealComponentDraft) => {
    const query = (matchQueries[component.componentId] ?? component.identifiedName).trim()
    if (!query) return
    setBusy(true)
    setError(null)
    try {
      const result = await searchFoodData(query)
      updateComponent(component.componentId, {
        identifiedName: query,
        candidates: result.candidates,
        selectedFdcId: result.candidates[0]?.fdcId ?? null,
        contextOnly: result.candidates.length === 0,
      })
      if (result.warning) setError(result.warning)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not search food data.')
    } finally {
      setBusy(false)
    }
  }

  const addManualFood = async () => {
    const query = manualQuery.trim()
    if (!query) return
    if (!draft || !analysisId) {
      await runAnalysis(undefined, query)
      setManualQuery('')
      return
    }
    if (components.length >= 12) {
      setError('A meal draft can contain at most 12 components.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await searchFoodData(query)
      const component = manualComponent(query, result.candidates)
      setDraft((previous) => previous ? { ...previous, components: [...previous.components, component] } : previous)
      setManualQuery('')
      if (result.warning) setError(result.warning)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this food.')
    } finally {
      setBusy(false)
    }
  }

  const addCuratedFallback = async (food: CuratedFoodCandidate) => {
    if (!draft || !analysisId) {
      await runAnalysis(undefined, food.displayName, food)
      return
    }
    if (components.length >= 12) return
    setDraft((previous) => previous ? {
      ...previous,
      components: [...previous.components, {
        ...manualComponent(food.displayName, []),
        householdPortion: food.portionLabels[0] ?? 'user-described portion',
        contextOnly: true,
        qualitativeTags: food.qualitativeTags,
        sourcePath: 'curated',
      }],
    } : previous)
  }

  const finalize = async () => {
    if (!analysisId || !canFinalize) return
    setBusy(true)
    setError(null)
    setSmartContext(null)
    try {
      const confirmed = await finalizeUnlabeledMealAnalysis(analysisId, {
        mealName: mealName.trim() || 'Estimated meal',
        meal,
        components: components.map((component) => ({
          componentId: component.componentId,
          confirmedName: component.identifiedName.trim(),
          fdcId: component.contextOnly ? null : component.selectedFdcId,
          householdPortion: component.householdPortion.trim(),
          gramRange: component.gramRange,
          contextOnly: component.contextOnly,
          qualitativeTags: component.qualitativeTags,
        })),
      })
      setRecord(confirmed)
      const fallback = fallbackSmartContext(confirmed)
      setSmartContext(fallback)
      resolveSmartContext(smartRequest(confirmed)).then((response) => {
        setSmartContext(response)
        setRecord((current) => current ? { ...current, smartContextSnapshot: response } : current)
      }).catch(() => undefined)
      setAnalysisId(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not finalize this estimated meal.')
    } finally {
      setBusy(false)
    }
  }

  const logRecord = async () => {
    if (!record) return
    setSaving(true)
    try {
      const rangeTotals = {
        totalCarbohydrate: record.aggregateNutrientRanges.totalCarbohydrate,
        totalSugars: record.aggregateNutrientRanges.totalSugars,
        addedSugars: record.aggregateNutrientRanges.addedSugars,
      }
      const snapshot = smartContext ?? fallbackSmartContext(record)
      const savedRecord = { ...record, smartContextSnapshot: snapshot }
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        kind: 'estimated_unlabeled_meal',
        analysisId: record.analysisId,
        loggedAt: new Date().toISOString(),
        meal: record.meal,
        consumedServings: 1,
        productName: record.mealName,
        totals: {
          totalCarbohydrate: rangeMidpoint(rangeTotals.totalCarbohydrate),
          totalSugars: rangeMidpoint(rangeTotals.totalSugars),
          addedSugars: rangeMidpoint(rangeTotals.addedSugars),
        },
        rangeTotals,
        estimatedRecord: savedRecord,
        retainedImages: retainImage && foodImage ? [{ kind: 'food', blob: foodImage, name: foodImage.name }] : undefined,
      }
      await saveLog(entry)
      await onLogged(entry)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this estimated meal locally.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="scan-layout unlabeled-layout">
        <div className="capture-stack">
          <ImagePanelCard
            number={1}
            title="Add a meal photo"
            description="Photograph the whole meal for optional identification, or add foods manually below."
            recommended
            file={foodImage ?? undefined}
            report={imageReport}
            checking={checkingImage}
            onChoose={(file) => void chooseFoodImage(file)}
            onCamera={() => setCameraOpen(true)}
            onRemove={() => { setFoodImage(null); setImageReport(undefined) }}
          />

          <section className="card meal-search-card meal-workspace-card">
            <div className="section-heading"><div><span className="section-kicker">Add foods manually</span><h2>Meal components</h2></div></div>
            <p className="meal-workspace-intro">Add a meal photo first, or add foods manually.</p>
            <div className="meal-search-row">
              <label className="meal-search-input">
                <Search size={16} />
                <input value={manualQuery} placeholder="e.g. chicken adobo, white rice" onChange={(event) => setManualQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addManualFood() }} />
              </label>
              <button type="button" className="secondary-button add-food-button" disabled={busy || !manualQuery.trim()} onClick={() => void addManualFood()}><Plus size={16} /> Add food</button>
            </div>
            {foodImage ? (
              <button type="button" className="primary-button meal-photo-identify" disabled={busy} onClick={() => void runAnalysis(foodImage ?? undefined)}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <ImagePlus size={18} />} Identify foods in photo
              </button>
            ) : (
              <p className="meal-manual-hint">or add foods manually</p>
            )}
            {stageLabels.length > 0 && <div className="analysis-stage-list">{stageLabels.map((label) => <span key={label}><CheckCircle2 size={14} /> {label}</span>)}</div>}

            {catalog.length > 0 && (
              <div className="quick-add-block">
                <div className="quick-add-heading"><span>Quick add</span><small>Common foods become context-only components.</small></div>
                <div className="curated-fallback-list">
                  {visibleQuickAdd.map((food) => <button type="button" key={food.foodId} disabled={busy} onClick={() => void addCuratedFallback(food)}><Utensils size={14} /> {food.displayName}</button>)}
                  {catalog.length > 8 && (
                    <button type="button" className="quick-add-more" onClick={() => setQuickAddExpanded((expanded) => !expanded)}>
                      {quickAddExpanded ? 'Show less' : `More${hiddenQuickAddCount ? ` (${hiddenQuickAddCount})` : ''}`}
                    </button>
                  )}
                </div>
                {catalogLimitations.length > 0 && (
                  <details className="inline-technical-details">
                    <summary>Catalog limits</summary>
                    <ul>{catalogLimitations.map((item) => <li key={item}>{item}</li>)}</ul>
                  </details>
                )}
              </div>
            )}

            <div className="component-workspace">
              <div className="component-workspace-heading">
                <span>Identity and portions</span>
                <strong>{components.length ? `${components.length} component${components.length === 1 ? '' : 's'}` : 'No components yet'}</strong>
              </div>
              {(!draft || components.length === 0) ? (
                <div className="meal-components-empty">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>{draft ? 'No components detected' : 'No foods added yet'}</strong>
                    <span>{draft ? 'Search above or use Quick Add to build the meal.' : 'Use the search field or Quick Add to start the estimate.'}</span>
                  </div>
                </div>
              ) : (
                <div className="estimated-component-list">
                  {components.map((component, index) => (
                    <article className="estimated-component" key={component.componentId}>
                      <div className="component-title"><span>{index + 1}</span><input aria-label={`Component ${index + 1} name`} value={component.identifiedName} onChange={(event) => updateComponent(component.componentId, { identifiedName: event.target.value })} /><button type="button" className="icon-button" aria-label={`Remove ${component.identifiedName}`} onClick={() => setDraft((previous) => previous ? { ...previous, components: previous.components.filter((item) => item.componentId !== component.componentId) } : previous)}><Trash2 size={16} /></button></div>
                      <div className="component-meta"><span className={`evidence-badge badge-${component.sourcePath}`}>{component.sourcePath === 'vlm' ? 'Estimated identity' : component.sourcePath === 'curated' ? 'Context only' : 'User added'}</span><span>{Math.round(component.confidence * 100)}% {component.confidenceBand} confidence</span></div>
                      {component.preparationClues.length > 0 && <p>{component.preparationClues.join(' · ')}</p>}
                      <label className="select-field"><span>Food data match</span><select disabled={component.contextOnly} value={component.selectedFdcId ?? ''} onChange={(event) => updateComponent(component.componentId, { selectedFdcId: Number(event.target.value) || null })}><option value="">Choose a match</option>{component.candidates.map((candidate) => <option value={candidate.fdcId} key={candidate.fdcId}>{candidate.description}{candidate.brandOwner ? ` - ${candidate.brandOwner}` : ''}</option>)}</select></label>
                      <div className="component-remap"><input aria-label={`Search a different match for ${component.identifiedName}`} value={matchQueries[component.componentId] ?? ''} placeholder="Search a different food-data match" onChange={(event) => setMatchQueries((value) => ({ ...value, [component.componentId]: event.target.value }))} /><button type="button" className="text-button" disabled={busy} onClick={() => void searchDifferentMatch(component)}><Search size={14} /> Search</button></div>
                      <div className="component-portion-grid">
                        <label><span>Household portion</span><input value={component.householdPortion} onChange={(event) => updateComponent(component.componentId, { householdPortion: event.target.value })} /></label>
                        <label><span>Minimum g</span><input type="number" min="1" max="5000" value={component.gramRange.minimum} onChange={(event) => updateComponent(component.componentId, { gramRange: { ...component.gramRange, minimum: Number(event.target.value) } })} /></label>
                        <label><span>Maximum g</span><input type="number" min="1" max="5000" value={component.gramRange.maximum} onChange={(event) => updateComponent(component.componentId, { gramRange: { ...component.gramRange, maximum: Number(event.target.value) } })} /></label>
                      </div>
                      <label className="checkbox-row"><input type="checkbox" checked={component.contextOnly} onChange={(event) => updateComponent(component.componentId, { contextOnly: event.target.checked, selectedFdcId: event.target.checked ? null : component.candidates[0]?.fdcId ?? null })} /><span><strong>Context-only component</strong><small>Exclude it from every numeric meal range when no credible food-data match exists.</small></span></label>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {record && <EstimatedBreakdown record={record} />}
          {record && smartContext && <SmartContextCards response={smartContext} />}
        </div>

        <aside className="scan-sidebar">
          <section className="card analysis-card">
            <div className="section-heading"><div><span className="section-kicker">Estimated meal</span><h2>Confirm and calculate</h2></div><Database size={19} /></div>
            <div className="meal-flow-steps">
              <span className={foodImage ? 'complete' : components.length === 0 ? 'current' : ''}>Add a meal photo</span>
              <span className={components.length > 0 ? 'complete' : foodImage ? 'current' : ''}>Add foods manually</span>
              <span className={record ? 'complete' : components.length > 0 ? 'current' : ''}>Confirm portions</span>
            </div>
            <div className="component-sidebar-summary">
              <strong>{components.length ? `${components.length} component${components.length === 1 ? '' : 's'}` : 'No components yet'}</strong>
              <span>{validationErrors.length ? `${validationErrors.length} portion or match item${validationErrors.length === 1 ? '' : 's'} need confirmation` : components.length ? 'Identities and portions are ready' : 'Use a photo, manual search, or quick add.'}</span>
            </div>
            <div className={`meal-confirm-fields ${components.length > 0 ? 'ready' : 'muted'}`}>
              <label className="select-field"><span>Meal name</span><input value={mealName} onChange={(event) => setMealName(event.target.value)} /></label>
              <label className="select-field"><span>Meal</span><select value={meal} onChange={(event) => setMeal(event.target.value as MealSlot)}>{MEAL_SLOTS.map((slot) => <option key={slot}>{slot}</option>)}</select></label>
            </div>
            {draft?.warnings.map((warning) => <div className="notice warning" key={warning}><AlertCircle size={16} /><span>{warning}</span></div>)}
            {error && <div className="notice error"><AlertCircle size={17} /><span>{error}</span></div>}
            {validationErrors.length > 0 && draft && <ul className="component-errors">{validationErrors.map((item) => <li key={item}>{item}</li>)}</ul>}
            {!record ? <button className="primary-button wide" disabled={!canFinalize || busy} onClick={() => void finalize()}>{busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />} Confirm portions and calculate <ArrowRight size={16} /></button> : <>
              <label className="checkbox-row"><input type="checkbox" checked={retainImage} disabled={!foodImage} onChange={(event) => setRetainImage(event.target.checked)} /><span><strong>Keep source photo locally</strong><small>Off by default. The backend copy has already been deleted.</small></span></label>
              <button className="primary-button wide" disabled={saving} onClick={() => void logRecord()}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Save estimated meal to Today</button>
            </>}
          </section>
        </aside>
      </div>

      {cameraOpen && <CameraCapture label="Meal photo" onCapture={(file) => { setCameraOpen(false); void chooseFoodImage(file) }} onClose={() => setCameraOpen(false)} />}
    </>
  )
}

function EstimatedBreakdown({ record }: { record: EstimatedMealRecord }) {
  return <section className="card estimated-breakdown-card">
    <div className="section-heading"><div><span className="section-kicker">Estimated breakdown</span><h2>{record.mealName}</h2></div><span className="evidence-badge badge-derived">Derived ranges</span></div>
    <div className="aggregate-range-grid">{NUTRIENT_KEYS.map((key) => <div key={key}><span>{NUTRIENT_META[key].label}</span><strong>{formatRange(record.aggregateNutrientRanges[key])}</strong><small>{record.unknownNutrientCounts[key] ? `${record.unknownNutrientCounts[key]} matched component value unknown` : 'Known matched components'}</small></div>)}</div>
    {record.partial && <div className="notice warning"><AlertCircle size={17} /><span>Partial meal estimate: {record.excludedComponentCount} context-only component{record.excludedComponentCount === 1 ? '' : 's'} excluded from all aggregate ranges.</span></div>}
    <div className="component-result-list">{record.components.map((component) => <article key={component.componentId}><div><strong>{component.confirmedName}</strong><span>{component.householdPortion} · {component.gramRange.minimum}–{component.gramRange.maximum} g</span></div><span className={`evidence-badge ${component.contextOnly ? 'badge-contextual' : 'badge-estimated'}`}>{component.contextOnly ? 'Context only' : 'Estimated range'}</span>{component.usdaMatch && <small>{component.usdaMatch.description}</small>}</article>)}</div>
  </section>
}

function SmartContextCards({ response }: { response: SmartContextResponse }) {
  return <section className="card smart-context-response-card">
    <div className="section-heading"><div><span className="section-kicker">Smart Context</span><h2>Grounded meal context</h2></div></div>
    <div className="smart-context-card-list">{response.cards.map((card) => <article key={card.id}><h3>{card.title}</h3><p>{card.body}</p><div>{card.evidenceLabels.map((label) => <span key={label}>{label}</span>)}</div>{card.actions.length > 0 && <small>{card.actions.join(' · ')}</small>}</article>)}</div>
    {response.sources.length > 0 && <div className="smart-context-sources">{response.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.sourceId}>{source.publisher}: {source.title}</a>)}</div>}
    <details className="inline-technical-details"><summary>Technical details</summary><div className="diagnostic-row"><strong>Smart Context</strong><span>{formatSmartContextMode(response)}</span></div><div className="diagnostic-row"><strong>Rule version</strong><span>{response.provenance.ruleVersion}</span></div></details>
  </section>
}

function manualComponent(name: string, candidates: EstimatedMealComponentDraft['candidates']): EstimatedMealComponentDraft {
  return {
    componentId: crypto.randomUUID(), identifiedName: name, preparationClues: [], householdPortion: 'user-described portion',
    gramRange: { minimum: 50, maximum: 150, unit: 'g' }, confidence: 1, confidenceBand: 'high', candidates,
    selectedFdcId: candidates[0]?.fdcId ?? null, contextOnly: candidates.length === 0, qualitativeTags: [], sourcePath: 'manual',
  }
}

function validateComponents(components: EstimatedMealComponentDraft[]): string[] {
  const errors: string[] = []
  components.forEach((component, index) => {
    const label = `Component ${index + 1}`
    if (!component.identifiedName.trim()) errors.push(`${label}: confirm a food identity.`)
    if (!component.householdPortion.trim()) errors.push(`${label}: confirm a household portion.`)
    if (!Number.isFinite(component.gramRange.minimum) || !Number.isFinite(component.gramRange.maximum) || component.gramRange.minimum < 1 || component.gramRange.maximum > 5000 || component.gramRange.minimum > component.gramRange.maximum) errors.push(`${label}: use a valid 1–5000 g range with minimum no greater than maximum.`)
    if (!component.contextOnly && !component.selectedFdcId) errors.push(`${label}: choose a food-data match or mark it context-only.`)
  })
  return errors
}

function formatRange(range: NumericRange | null): string {
  if (!range) return 'Unknown'
  const midpoint = rangeMidpoint(range)
  return `~${midpoint} g · ${range.minimum}–${range.maximum} g`
}

function smartRequest(record: EstimatedMealRecord): SmartContextResolveRequest {
  return {
    kind: 'estimated_unlabeled_meal' as const,
    displayName: record.mealName,
    market: record.market,
    meal: record.meal,
    portionLabel: `${record.components.length} confirmed component${record.components.length === 1 ? '' : 's'}`,
    nutrients: Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, { value: null, range: record.aggregateNutrientRanges[key], evidenceType: record.aggregateNutrientRanges[key] ? 'derived' : 'unavailable', sourceId: record.aggregateNutrientRanges[key] ? 'usda-fdc' : null }])) as SmartContextResolveRequest['nutrients'],
    contextFlags: [],
    qualitativeTags: record.components.flatMap((component) => component.qualitativeTags),
    limitations: record.limitations,
    excludedComponentCount: record.excludedComponentCount,
  }
}

function fallbackSmartContext(record: EstimatedMealRecord): SmartContextResponse {
  return {
    triggeredRuleIds: ['estimated-boundary'], evidenceSourceIds: [], sources: [], generationMode: 'deterministic', warnings: [],
    cards: [{ id: 'estimated-boundary', ruleId: 'estimated-boundary', title: 'Estimated meal range', body: `Ranges cover ${record.matchedComponentCount} matched component${record.matchedComponentCount === 1 ? '' : 's'} only; ${record.excludedComponentCount} context-only component${record.excludedComponentCount === 1 ? ' was' : 's were'} excluded.`, evidenceLabels: ['Food-data estimate', 'User-confirmed portion ranges'], actions: ['Review each match', 'Keep ranges visible'], sourceIds: [] }],
    provenance: { ruleVersion: 'local-fallback-v1', evidenceVersion: 'local-fallback-v1', pairingVersion: 'ph-pairings-v1', writerVersion: 'none', model: null, cacheHit: false, fallbackReason: 'Backend Smart Context is still loading or unavailable.' },
  }
}
