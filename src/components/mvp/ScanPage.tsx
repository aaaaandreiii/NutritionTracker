import { AlertCircle, ArrowRight, Barcode, Check, Columns2, Eye, FileText, LoaderCircle, LockKeyhole, RefreshCw, ScanLine, Server } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { type PanelKind, type ScanServiceStatus, type ScanSessionState } from '../../domain/scanSession'
import type { Market } from '../../domain/types'
import { API_BASE, checkBackendHealth, createAnalysis, deleteAnalysis, streamAnalysis, type AnalysisImages, type BackendHealth } from '../../lib/api'
import { decodeBarcode } from '../../lib/barcode'
import { inspectImage } from '../../lib/imageQuality'
import CameraCapture from './CameraCapture'
import EvidenceReview from './EvidenceReview'
import ImagePanelCard from './ImagePanelCard'

const PIPELINE_STAGES = [
  ['image_check', 'Image check'],
  ['barcode_lookup', 'Barcode lookup'],
  ['label_extraction', 'Label extraction'],
  ['ingredient_classification', 'Ingredient classification'],
  ['evidence_comparison', 'Database comparison'],
  ['safety_validation', 'Safety validation'],
] as const

const EXTRACTION_MODES = [
  { value: 'both' as const, label: 'Both', icon: Columns2 },
  { value: 'ocr_llm' as const, label: 'OCR+LLM', icon: FileText },
  { value: 'vlm' as const, label: 'VLM', icon: Eye },
]

interface Props {
  session: ScanSessionState
  setSession: Dispatch<SetStateAction<ScanSessionState>>
  onLogged: () => void | Promise<void>
}

export default function ScanPage({ session, setSession, onLogged }: Props) {
  const {
    images,
    reports,
    checking,
    cameraPanel,
    market,
    extractionMode,
    barcode,
    barcodeReading,
    consented,
    analysisId,
    result,
    stages,
    analyzing,
    error,
    serviceStatus,
  } = session

  useEffect(() => {
    if (serviceStatus.state !== 'unknown') return
    setSession((previous) => ({
      ...previous,
      serviceStatus: {
        state: 'checking',
        message: `Checking backend at ${API_BASE}...`,
        checkedAt: null,
      },
    }))
    void checkBackendHealth().then((health) => {
      setSession((previous) => ({
        ...previous,
        serviceStatus: statusFromHealth(health),
      }))
    })
  }, [serviceStatus.state, setSession])

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
    setSession((previous) => ({
      ...previous,
      error: null,
      images: { ...previous.images, [kind]: file },
      checking: kind,
      reports: { ...previous.reports, [kind]: undefined },
    }))
    try {
      const report = await inspectImage(file)
      setSession((previous) => ({
        ...previous,
        reports: { ...previous.reports, [kind]: report },
      }))
      if (kind === 'front' || (!images.front && kind === 'nutrition')) {
        setSession((previous) => ({ ...previous, barcodeReading: true }))
        const decoded = await decodeBarcode(file)
        if (decoded) setSession((previous) => ({ ...previous, barcode: decoded }))
        setSession((previous) => ({ ...previous, barcodeReading: false }))
      }
    } catch {
      setSession((previous) => ({
        ...previous,
        images: { ...previous.images, [kind]: undefined },
        error: 'This image could not be read. Choose a JPEG, PNG, or WebP photo.',
      }))
    } finally {
      setSession((previous) => ({ ...previous, checking: null, barcodeReading: false }))
    }
  }

  const removeImage = (kind: PanelKind) => {
    setSession((previous) => ({
      ...previous,
      images: { ...previous.images, [kind]: undefined },
      reports: { ...previous.reports, [kind]: undefined },
      barcode: kind === 'front' ? '' : previous.barcode,
    }))
  }

  const refreshServiceStatus = async (): Promise<BackendHealth> => {
    setSession((previous) => ({
      ...previous,
      serviceStatus: {
        state: 'checking',
        message: `Checking backend at ${API_BASE}...`,
        checkedAt: null,
      },
    }))
    const health = await checkBackendHealth()
    setSession((previous) => ({
      ...previous,
      serviceStatus: statusFromHealth(health),
    }))
    return health
  }

  const analyze = async () => {
    if (!images.nutrition || !canAnalyze) return
    setSession((previous) => ({
      ...previous,
      analyzing: true,
      error: null,
      stages: {},
    }))
    try {
      const health = await refreshServiceStatus()
      if (!health.ok) {
        setSession((previous) => ({
          ...previous,
          error: health.message,
        }))
        return
      }
      if (analysisId) await deleteAnalysis(analysisId).catch(() => undefined)
      const id = await createAnalysis(images as AnalysisImages, market, extractionMode, barcode || undefined)
      setSession((previous) => ({ ...previous, analysisId: id }))
      const analysis = await streamAnalysis(id, (event) => {
        if (event.type === 'stage' && event.stage) {
          setSession((previous) => ({
            ...previous,
            stages: { ...previous.stages, [event.stage as string]: event },
          }))
        }
      })
      setSession((previous) => ({ ...previous, result: analysis }))
    } catch (caught) {
      setSession((previous) => ({
        ...previous,
        error: caught instanceof Error ? caught.message : 'Analysis failed. No sample result was substituted.',
      }))
    } finally {
      setSession((previous) => ({ ...previous, analyzing: false }))
    }
  }

  const returnToScan = async () => {
    if (analysisId) await deleteAnalysis(analysisId).catch(() => undefined)
    setSession((previous) => ({
      ...previous,
      analysisId: null,
      result: null,
      stages: {},
      analyzing: false,
      error: null,
    }))
  }

  if (result && images.nutrition) {
    return <EvidenceReview result={result} images={images as AnalysisImages} onBack={() => void returnToScan()} onLogged={onLogged} />
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
            onCamera={() => setSession((previous) => ({ ...previous, cameraPanel: 'nutrition' }))}
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
            onCamera={() => setSession((previous) => ({ ...previous, cameraPanel: 'ingredients' }))}
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
            onCamera={() => setSession((previous) => ({ ...previous, cameraPanel: 'front' }))}
            onRemove={() => removeImage('front')}
          />
        </div>

        <aside className="scan-sidebar">
          <section className="card analysis-card">
            <div className="section-heading"><div><span className="section-kicker">Analysis setup</span><h2>Before upload</h2></div><LockKeyhole size={19} /></div>
            <label className="select-field"><span>Label market</span><select value={market} onChange={(event) => setSession((previous) => ({ ...previous, market: event.target.value as Market }))}><option value="PH">Philippines</option><option value="US">United States</option></select></label>
            <div className="select-field">
              <span>Extraction mode</span>
              <div className="segmented-control" role="radiogroup" aria-label="Extraction mode">
                {EXTRACTION_MODES.map((mode) => {
                  const Icon = mode.icon
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      role="radio"
                      aria-checked={extractionMode === mode.value}
                      className={extractionMode === mode.value ? 'active' : ''}
                      onClick={() => setSession((previous) => ({ ...previous, extractionMode: mode.value }))}
                    >
                      <Icon size={14} />
                      <span>{mode.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="select-field"><span><Barcode size={15} /> Barcode {barcodeReading && '(reading…)'} </span><input value={barcode} inputMode="numeric" placeholder="Optional UPC / EAN" onChange={(event) => setSession((previous) => ({ ...previous, barcode: event.target.value.replace(/[^0-9]/g, '') }))} /></label>
            <div className="quality-summary">
              <div><strong>{qualitySummary.fails}</strong><span>blocking issues</span></div>
              <div><strong>{qualitySummary.warnings}</strong><span>review notes</span></div>
            </div>
            <div className={`service-status service-${serviceStatus.state}`}>
              <Server size={17} />
              <div>
                <strong>Analysis service</strong>
                <small>{serviceStatus.message}</small>
              </div>
              <button type="button" onClick={() => void refreshServiceStatus()} aria-label="Check analysis service">
                {serviceStatus.state === 'checking' ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
              </button>
            </div>
            {!images.ingredients && <div className="notice warning"><AlertCircle size={17} /><span>No ingredients image: sugar-variant analysis will be unavailable unless you transcribe it during review.</span></div>}
            <label className="checkbox-row consent-row">
              <input type="checkbox" checked={consented} onChange={(event) => setSession((previous) => ({ ...previous, consented: event.target.checked }))} />
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
          onClose={() => setSession((previous) => ({ ...previous, cameraPanel: null }))}
        />
      )}
    </div>
  )
}

function statusFromHealth(health: BackendHealth): ScanServiceStatus {
  return {
    state: health.ok ? 'online' : 'offline',
    message: health.message,
    checkedAt: new Date().toISOString(),
  }
}
