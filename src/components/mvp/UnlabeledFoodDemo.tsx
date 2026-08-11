import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ImagePlus,
  LoaderCircle,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Utensils,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { buildPairingInsights, smartContextFromCuratedRecord } from '../../domain/pairing'
import type { CuratedFoodCandidate, CuratedFoodRecord, LogEntry, MealSlot } from '../../domain/types'
import { getUnlabeledFoodCatalog, identifyUnlabeledFood, validateUnlabeledFoodRecord } from '../../lib/api'
import { saveLog } from '../../lib/db'
import { inspectImage } from '../../lib/imageQuality'
import CameraCapture from './CameraCapture'
import ImagePanelCard from './ImagePanelCard'
import PairingIdeas from './PairingIdeas'

interface Props {
  onLogged: (entry: LogEntry) => void | Promise<void>
}

const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other']

export default function UnlabeledFoodDemo({ onLogged }: Props) {
  const [catalog, setCatalog] = useState<CuratedFoodCandidate[]>([])
  const [catalogLimitations, setCatalogLimitations] = useState<string[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [foodImage, setFoodImage] = useState<File | null>(null)
  const [imageReport, setImageReport] = useState<Awaited<ReturnType<typeof inspectImage>> | undefined>()
  const [checkingImage, setCheckingImage] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [candidates, setCandidates] = useState<CuratedFoodCandidate[]>([])
  const [identifyMessage, setIdentifyMessage] = useState<string | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [selectedFoodId, setSelectedFoodId] = useState('')
  const [selectedPortionLabel, setSelectedPortionLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [meal, setMeal] = useState<MealSlot>('Snack')
  const [record, setRecord] = useState<CuratedFoodRecord | null>(null)
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCatalogLoading(true)
    getUnlabeledFoodCatalog('PH')
      .then((payload) => {
        if (cancelled) return
        setCatalog(payload.foods)
        setCatalogLimitations(payload.limitations)
      })
      .catch((caught) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Could not load curated demo foods.')
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const foodOptions = useMemo(() => {
    const byId = new Map<string, CuratedFoodCandidate>()
    for (const candidate of candidates) byId.set(candidate.foodId, candidate)
    for (const food of catalog) if (!byId.has(food.foodId)) byId.set(food.foodId, food)
    return Array.from(byId.values())
  }, [candidates, catalog])
  const selectedFood = foodOptions.find((food) => food.foodId === selectedFoodId) ?? null
  const insights = useMemo(
    () => record ? buildPairingInsights(smartContextFromCuratedRecord(record, meal)) : [],
    [meal, record],
  )

  const chooseFoodImage = async (file: File) => {
    setFoodImage(file)
    setCheckingImage(true)
    setImageReport(undefined)
    setCandidates([])
    setIdentifyMessage(null)
    setRecord(null)
    setError(null)
    try {
      setImageReport(await inspectImage(file))
    } catch {
      setFoodImage(null)
      setError('This image could not be read. Choose a JPEG, PNG, or WebP photo.')
    } finally {
      setCheckingImage(false)
    }
  }

  const selectFood = (foodId: string) => {
    const nextFood = foodOptions.find((food) => food.foodId === foodId)
    setSelectedFoodId(foodId)
    setSelectedPortionLabel(nextFood?.portionLabels[0] ?? '')
    setRecord(null)
    setError(null)
  }

  const suggestFromPhoto = async () => {
    if (!foodImage) return
    setIdentifying(true)
    setError(null)
    setRecord(null)
    try {
      const payload = await identifyUnlabeledFood(foodImage, 'PH')
      setCandidates(payload.candidates)
      setIdentifyMessage(payload.message)
      if (payload.candidates[0]) {
        setSelectedFoodId(payload.candidates[0].foodId)
        setSelectedPortionLabel(payload.candidates[0].portionLabels[0] ?? '')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not suggest a curated demo food.')
    } finally {
      setIdentifying(false)
    }
  }

  const validateRecord = async () => {
    if (!selectedFood || !selectedPortionLabel) return
    setValidating(true)
    setError(null)
    try {
      setRecord(await validateUnlabeledFoodRecord({
        market: 'PH',
        foodId: selectedFood.foodId,
        portionLabel: selectedPortionLabel,
        notes,
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not validate this curated demo record.')
    } finally {
      setValidating(false)
    }
  }

  const logRecord = async () => {
    if (!record) return
    setSaving(true)
    setError(null)
    try {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        kind: 'curated_unlabeled_demo',
        analysisId: record.recordId,
        loggedAt: new Date().toISOString(),
        meal,
        consumedServings: 1,
        productName: record.displayName,
        totals: {
          totalCarbohydrate: null,
          totalSugars: null,
          addedSugars: null,
        },
        curatedRecord: record,
      }
      await saveLog(entry)
      await onLogged(entry)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this curated demo record.')
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
            title="Food photo"
            description="Optional. A photo can suggest catalog candidates, but you must confirm the food and portion manually."
            recommended
            file={foodImage ?? undefined}
            report={imageReport}
            checking={checkingImage}
            onChoose={(file) => void chooseFoodImage(file)}
            onCamera={() => setCameraOpen(true)}
            onRemove={() => {
              setFoodImage(null)
              setImageReport(undefined)
              setCandidates([])
              setIdentifyMessage(null)
              setRecord(null)
            }}
          />

          <section className="card catalog-card">
            <div className="section-heading">
              <div><span className="section-kicker">Curated demo catalog</span><h2>Confirm food identity</h2></div>
              <Utensils size={19} />
            </div>
            <p className="catalog-intro">Choose one allowed Filipino demo food. Smart Context remains hidden until the backend validates this selection and portion.</p>
            {identifyMessage && <div className="notice neutral"><Search size={17} /><span>{identifyMessage}</span></div>}
            {catalogLoading ? (
              <div className="empty-inline"><LoaderCircle className="spin" size={15} /> Loading curated foods…</div>
            ) : (
              <div className="candidate-grid">
                {foodOptions.map((food) => {
                  const suggested = candidates.some((candidate) => candidate.foodId === food.foodId)
                  return (
                    <button
                      type="button"
                      className={`candidate-food ${selectedFoodId === food.foodId ? 'selected' : ''}`}
                      key={food.foodId}
                      onClick={() => selectFood(food.foodId)}
                    >
                      <strong>{food.displayName}</strong>
                      <span>{suggested ? 'Photo hint' : 'Manual catalog'}</span>
                      <small>{food.qualitativeTags.slice(0, 3).join(' · ')}</small>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="scan-sidebar">
          <section className="card analysis-card">
            <div className="section-heading">
              <div><span className="section-kicker">Unlabeled demo</span><h2>Selection</h2></div>
              <ClipboardCheck size={19} />
            </div>
            <button className="secondary-button wide" disabled={!foodImage || identifying} onClick={() => void suggestFromPhoto()}>
              {identifying ? <LoaderCircle className="spin" size={17} /> : <ImagePlus size={17} />}
              Suggest from photo
            </button>
            <label className="select-field">
              <span>Confirmed food</span>
              <select value={selectedFoodId} onChange={(event) => selectFood(event.target.value)}>
                <option value="">Choose from catalog</option>
                {foodOptions.map((food) => <option key={food.foodId} value={food.foodId}>{food.displayName}</option>)}
              </select>
            </label>
            <label className="select-field">
              <span>Portion label</span>
              <select
                value={selectedPortionLabel}
                disabled={!selectedFood}
                onChange={(event) => {
                  setSelectedPortionLabel(event.target.value)
                  setRecord(null)
                }}
              >
                <option value="">Choose portion</option>
                {selectedFood?.portionLabels.map((portion) => <option key={portion} value={portion}>{portion}</option>)}
              </select>
            </label>
            <label className="select-field">
              <span>Meal</span>
              <select value={meal} onChange={(event) => setMeal(event.target.value as MealSlot)}>
                {MEAL_SLOTS.map((slot) => <option key={slot}>{slot}</option>)}
              </select>
            </label>
            <label className="select-field">
              <span>Notes</span>
              <textarea rows={4} value={notes} placeholder="Optional preparation or portion note" onChange={(event) => {
                setNotes(event.target.value)
                setRecord(null)
              }} />
            </label>
            {error && <div className="notice error"><AlertCircle size={17} /><span>{error}</span></div>}
            <button className="primary-button wide" disabled={!selectedFood || !selectedPortionLabel || validating} onClick={() => void validateRecord()}>
              {validating ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
              Validate demo context
              {!validating && <ArrowRight size={17} />}
            </button>
          </section>

          <section className="card limitations-card">
            <span className="section-kicker">Demo limitations</span>
            <ul>{catalogLimitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </aside>
      </div>

      {record && (
        <>
          <section className="card unlabeled-record-card">
            <div className="section-heading">
              <div><span className="section-kicker">Validated record</span><h2>{record.displayName}</h2></div>
              <CheckCircle2 size={20} />
            </div>
            <div className="unlabeled-record-grid">
              <div><span>Portion</span><strong>{record.selectedPortionLabel}</strong></div>
              <div><span>Mode</span><strong>Curated demo only</strong></div>
              <div><span>GI / GL</span><strong>Unavailable</strong></div>
            </div>
            <div className="context-flag-list">
              {record.contextFlags.map((flag) => (
                <div className="context-flag flag-curated_demo" key={flag.id}>
                  <strong>{flag.label}</strong>
                  <span><Tag size={12} /> Curated tag</span>
                  <p>{flag.detail}</p>
                  <small>{flag.evidenceLabels.join(' · ')}</small>
                </div>
              ))}
            </div>
          </section>

          <PairingIdeas insights={insights} />

          <section className="card log-card">
            <div>
              <span className="section-kicker">Context-only log</span>
              <h2>Save the confirmed demo record locally</h2>
              <p>No calories, macros, GI, or GL are added for curated unlabeled foods.</p>
            </div>
            <div className="confirmed-actions">
              <div><CheckCircle2 size={21} /><span><strong>Backend catalog validation passed</strong><small>Food and portion were confirmed before Smart Context.</small></span></div>
              <button className="primary-button" disabled={saving} onClick={() => void logRecord()}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Save to Today</button>
            </div>
          </section>
        </>
      )}

      {cameraOpen && (
        <CameraCapture
          label="Food photo"
          onCapture={(file) => {
            setCameraOpen(false)
            void chooseFoodImage(file)
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  )
}
