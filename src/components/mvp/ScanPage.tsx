import { AlertCircle, ArrowRight, Barcode, Check, LoaderCircle, LockKeyhole, ScanLine } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AnalysisResult, AnalysisStageEvent, ImageQualityReport, Market } from '../../domain/types'
import { createAnalysis, deleteAnalysis, streamAnalysis, type AnalysisImages } from '../../lib/api'
import { decodeBarcode } from '../../lib/barcode'
import { inspectImage } from '../../lib/imageQuality'
import CameraCapture from './CameraCapture'
import EvidenceReview from './EvidenceReview'
import ImagePanelCard from './ImagePanelCard'

type PanelKind = 'nutrition' | 'ingredients' | 'front'

const PIPELINE_STAGES = [
  ['image_check', 'Image check'],
  ['barcode_lookup', 'Barcode lookup'],
  ['label_extraction', 'Label extraction'],
  ['ingredient_classification', 'Ingredient classification'],
  ['evidence_comparison', 'Database comparison'],
  ['safety_validation', 'Safety validation'],
] as const

interface Props {
  onLogged: () => void
}

export default function ScanPage({ onLogged }: Props) {
  const [images, setImages] = useState<Partial<AnalysisImages>>({})
  const [reports, setReports] = useState<Partial<Record<PanelKind, ImageQualityReport>>>({})
  const [checking, setChecking] = useState<PanelKind | null>(null)
  const [cameraPanel, setCameraPanel] = useState<PanelKind | null>(null)
  const [market, setMarket] = useState<Market>('PH')
  const [barcode, setBarcode] = useState<string>('')
  const [barcodeReading, setBarcodeReading] = useState(false)
  const [consented, setConsented] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [stages, setStages] = useState<Record<string, AnalysisStageEvent>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    if (analysisId) void deleteAnalysis(analysisId)
  }, [analysisId])

  const canAnalyze = Boolean(
    images.nutrition && reports.nutrition?.canSubmit && consented && !checking && !analyzing,
  )

  const qualitySummary = useMemo(() => {
    const allChecks = Object.values(reports).flatMap((report) => report?.checks ?? [])
    return {
      fails: allChecks.filter((check) => check.status === 'fail').length,
      warnings: allChecks.filter((check) => check.status === 'warn').length,
    }
  }, [reports])

  const chooseImage = async (kind: PanelKind, file: File) => {
    setError(null)
    setImages((previous) => ({ ...previous, [kind]: file }))
    setChecking(kind)
    setReports((previous) => ({ ...previous, [kind]: undefined }))
    try {
      const report = await inspectImage(file)
      setReports((previous) => ({ ...previous, [kind]: report }))
      if (kind === 'front' || (!images.front && kind === 'nutrition')) {
        setBarcodeReading(true)
        const decoded = await decodeBarcode(file)
        if (decoded) setBarcode(decoded)
        setBarcodeReading(false)
      }
    } catch {
      setImages((previous) => ({ ...previous, [kind]: undefined }))
      setError('This image could not be read. Choose a JPEG, PNG, or WebP photo.')
    } finally {
      setChecking(null)
      setBarcodeReading(false)
    }
  }

  const removeImage = (kind: PanelKind) => {
    setImages((previous) => ({ ...previous, [kind]: undefined }))
    setReports((previous) => ({ ...previous, [kind]: undefined }))
    if (kind === 'front') setBarcode('')
  }

  const analyze = async () => {
    if (!images.nutrition || !canAnalyze) return
    setAnalyzing(true)
    setError(null)
    setStages({})
    try {
      const id = await createAnalysis(images as AnalysisImages, market, barcode || undefined)
      setAnalysisId(id)
      const analysis = await streamAnalysis(id, (event) => {
        if (event.type === 'stage' && event.stage) {
          setStages((previous) => ({ ...previous, [event.stage as string]: event }))
        }
      })
      setResult(analysis)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analysis failed. No sample result was substituted.')
    } finally {
      setAnalyzing(false)
    }
  }

  const reset = async () => {
    if (analysisId) await deleteAnalysis(analysisId)
    setAnalysisId(null)
    setResult(null)
    setStages({})
  }

  if (result && images.nutrition) {
    return <EvidenceReview result={result} images={images as AnalysisImages} onBack={() => void reset()} onLogged={onLogged} />
  }

  return (
    <div className="page scan-page">
      <section className="scan-hero">
        <div>
          <span className="eyebrow"><ScanLine size={14} /> Packaged-food scanner</span>
          <h1>Read the label.<br /><em>See the evidence.</em></h1>
          <p>Photograph the panels below. Sugar pAI separates what can be read, what you confirm, and what cannot be determined.</p>
        </div>
        <div className="hero-proof">
          <div><strong>01</strong><span>Nutrition panel</span></div>
          <div><strong>02</strong><span>Ingredient panel</span></div>
          <div><strong>03</strong><span>Evidence review</span></div>
        </div>
      </section>

      <div className="scan-layout">
        <div className="capture-stack">
          <ImagePanelCard
            number={1}
            title="Nutrition Facts panel"
            description="Capture the serving line and all carbohydrate, sugar, fiber, protein, and fat rows."
            required
            file={images.nutrition}
            report={reports.nutrition}
            checking={checking === 'nutrition'}
            onChoose={(file) => void chooseImage('nutrition', file)}
            onCamera={() => setCameraPanel('nutrition')}
            onRemove={() => removeImage('nutrition')}
          />
          <ImagePanelCard
            number={2}
            title="Ingredients panel"
            description="Needed to identify named sugar-related ingredients and their printed rank. Skip for a partial result."
            file={images.ingredients}
            report={reports.ingredients}
            checking={checking === 'ingredients'}
            onChoose={(file) => void chooseImage('ingredients', file)}
            onCamera={() => setCameraPanel('ingredients')}
            onRemove={() => removeImage('ingredients')}
          />
          <ImagePanelCard
            number={3}
            title="Front label or barcode"
            description="Improves product identification. UPC and EAN barcodes are decoded on this device first."
            recommended
            file={images.front}
            report={reports.front}
            checking={checking === 'front'}
            onChoose={(file) => void chooseImage('front', file)}
            onCamera={() => setCameraPanel('front')}
            onRemove={() => removeImage('front')}
          />
        </div>

        <aside className="scan-sidebar">
          <section className="card analysis-card">
            <div className="section-heading"><div><span className="section-kicker">Analysis setup</span><h2>Before upload</h2></div><LockKeyhole size={19} /></div>
            <label className="select-field"><span>Label market</span><select value={market} onChange={(event) => setMarket(event.target.value as Market)}><option value="PH">Philippines</option><option value="US">United States</option></select></label>
            <label className="select-field"><span><Barcode size={15} /> Barcode {barcodeReading && '(reading…)'} </span><input value={barcode} inputMode="numeric" placeholder="Optional UPC / EAN" onChange={(event) => setBarcode(event.target.value.replace(/[^0-9]/g, ''))} /></label>
            <div className="quality-summary">
              <div><strong>{qualitySummary.fails}</strong><span>blocking issues</span></div>
              <div><strong>{qualitySummary.warnings}</strong><span>review notes</span></div>
            </div>
            {!images.ingredients && <div className="notice warning"><AlertCircle size={17} /><span>No ingredients image: sugar-variant analysis will be unavailable unless you transcribe it during review.</span></div>}
            <label className="checkbox-row consent-row">
              <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
              <span><strong>I consent to research processing</strong><small>Images go to the temporary analysis service and any configured processors disclosed in About. Server copies expire after 15 minutes.</small></span>
            </label>
            {error && <div className="notice error"><AlertCircle size={17} /><span>{error}</span></div>}
            <button className="primary-button wide" disabled={!canAnalyze} onClick={() => void analyze()}>
              {analyzing ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />}
              {analyzing ? 'Analyzing label…' : 'Analyze label'}
              {!analyzing && <ArrowRight size={17} />}
            </button>
            {!images.nutrition && <small className="button-helper">Add a readable Nutrition Facts panel to continue.</small>}
          </section>

          {analyzing && (
            <section className="card pipeline-card" aria-live="polite">
              <span className="section-kicker">Live pipeline</span>
              <div className="pipeline-list">
                {PIPELINE_STAGES.map(([id, label]) => {
                  const event = stages[id]
                  return <div key={id} className={`pipeline-row pipeline-${event?.status ?? 'waiting'}`}>
                    <span>{event?.status === 'complete' || event?.status === 'skipped' ? <Check size={14} /> : event?.status === 'running' ? <LoaderCircle className="spin" size={14} /> : null}</span>
                    <div><strong>{label}</strong><small>{event?.label ?? 'Waiting'}</small></div>
                  </div>
                })}
              </div>
            </section>
          )}
        </aside>
      </div>

      {cameraPanel && (
        <CameraCapture
          label={`${cameraPanel[0].toUpperCase()}${cameraPanel.slice(1)} panel`}
          onCapture={(file) => void chooseImage(cameraPanel, file)}
          onClose={() => setCameraPanel(null)}
        />
      )}
    </div>
  )
}
