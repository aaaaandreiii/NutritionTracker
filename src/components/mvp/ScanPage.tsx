import { AlertCircle, ArrowRight, Barcode, Check, Database, LoaderCircle, LockKeyhole, RefreshCw, ScanLine, Server, Utensils } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { type AnalysisPanelKind, type PanelKind, type ScanServiceStatus, type ScanSessionState } from '../../domain/scanSession'
import type { LogEntry, Market, OffProductLookupResponse, SmartContextRecordKind } from '../../domain/types'
import { API_BASE, checkBackendHealth, createAnalysis, createBarcodeAnalysis, deleteAnalysis, lookupOffProduct, streamAnalysis, type AnalysisImages, type BackendHealth } from '../../lib/api'
import { decodeBarcode } from '../../lib/barcode'
import { inspectImage } from '../../lib/imageQuality'
import BarcodeScannerModal from './BarcodeScannerModal'
import CameraCapture from './CameraCapture'
import EvidenceReview from './EvidenceReview'
import ImagePanelCard from './ImagePanelCard'
import UnlabeledFoodDemo from './UnlabeledFoodDemo'

const PIPELINE_STAGES = [
  ['image_check', 'Image check'],
  ['barcode_lookup', 'Barcode lookup'],
  ['label_extraction', 'VLM extraction'],
  ['ingredient_classification', 'Ingredient classification'],
  ['evidence_assembly', 'Evidence assembly'],
  ['safety_validation', 'Claim validation'],
] as const

interface Props {
  session: ScanSessionState
  setSession: Dispatch<SetStateAction<ScanSessionState>>
  onLogged: (entry: LogEntry) => void | Promise<void>
}

export default function ScanPage({ session, setSession, onLogged }: Props) {
  const [scanMode, setScanMode] = useState<SmartContextRecordKind>('packaged_label')
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false)
  const {
    images,
    barcodeImage,
    reports,
    checking,
    cameraPanel,
    market,
    barcode,
    barcodeReading,
    barcodeMessage,
    barcodeLookup,
    barcodeLookupLoading,
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
    images.nutrition && reports.nutrition?.canSubmit && !checking && !analyzing,
  )

  useEffect(() => {
    const normalized = barcode.replace(/[^0-9]/g, '')
    if (normalized.length < 6 || market !== 'PH') {
      setSession((previous) => ({ ...previous, barcodeLookup: null, barcodeLookupLoading: false }))
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      setSession((previous) => ({ ...previous, barcodeLookupLoading: true }))
      void lookupOffProduct(normalized, market)
        .then((lookup) => {
          if (!active) return
          setSession((previous) => ({
            ...previous,
            barcodeLookup: lookup,
            barcodeLookupLoading: false,
            error: null,
          }))
        })
        .catch((caught) => {
          if (!active) return
          setSession((previous) => ({
            ...previous,
            barcodeLookup: null,
            barcodeLookupLoading: false,
            barcodeMessage: caught instanceof Error ? caught.message : 'Could not check the local product database.',
          }))
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [barcode, market, setSession])

  const qualitySummary = useMemo(() => {
    const allChecks = [reports.nutrition, reports.ingredients, reports.front].flatMap((report) => report?.checks ?? [])
    return {
      fails: allChecks.filter((check) => check.status === 'fail').length,
      warnings: allChecks.filter((check) => check.status === 'warn').length,
    }
  }, [reports])

  const chooseImage = async (kind: AnalysisPanelKind, file: File) => {
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

  const chooseBarcodeImage = async (file: File) => {
    setSession((previous) => ({
      ...previous,
      barcodeImage: file,
      barcodeReading: true,
      barcodeMessage: null,
      checking: 'barcode',
      error: null,
      reports: { ...previous.reports, barcode: undefined },
    }))
    try {
      const report = await inspectImage(file)
      const decoded = await decodeBarcode(file)
      setSession((previous) => ({
        ...previous,
        barcode: decoded ?? previous.barcode,
        barcodeMessage: decoded
          ? `Barcode detected: ${decoded}.`
          : 'No UPC or EAN barcode was detected. Retake the close-up or type the digits manually.',
        barcodeLookup: decoded ? null : previous.barcodeLookup,
        error: null,
        reports: { ...previous.reports, barcode: report },
      }))
    } catch {
      setSession((previous) => ({
        ...previous,
        barcodeImage: null,
        error: 'This barcode image could not be read. Choose a JPEG, PNG, or WebP photo.',
      }))
    } finally {
      setSession((previous) => ({ ...previous, checking: null, barcodeReading: false }))
    }
  }

  const chooseCaptureImage = (kind: PanelKind, file: File) => {
    if (kind === 'barcode') {
      void chooseBarcodeImage(file)
      return
    }
    void chooseImage(kind, file)
  }

  const removeImage = (kind: AnalysisPanelKind) => {
    setSession((previous) => ({
      ...previous,
      images: { ...previous.images, [kind]: undefined },
      reports: { ...previous.reports, [kind]: undefined },
    }))
  }

  const removeBarcodeImage = () => {
    setSession((previous) => ({
      ...previous,
      barcode: '',
      barcodeImage: null,
      barcodeMessage: null,
      barcodeLookup: null,
      barcodeLookupLoading: false,
      reports: { ...previous.reports, barcode: undefined },
      error: null,
    }))
  }

  const handleLiveBarcodeDetected = useCallback((detected: string) => {
    setSession((previous) => ({
      ...previous,
      barcode: detected,
      barcodeMessage: `Barcode detected: ${detected}.`,
      barcodeLookup: null,
      barcodeLookupLoading: true,
      error: null,
    }))
    setBarcodeScannerOpen(false)
  }, [setSession])

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
      const id = await createAnalysis(images as AnalysisImages, market, barcode || undefined)
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

  const useDatabaseMatch = async () => {
    if (!barcodeLookup?.complete) return
    setSession((previous) => ({
      ...previous,
      analyzing: true,
      error: null,
      stages: {},
    }))
    try {
      const health = await refreshServiceStatus()
      if (!health.ok) {
        setSession((previous) => ({ ...previous, error: health.message }))
        return
      }
      if (analysisId) await deleteAnalysis(analysisId).catch(() => undefined)
      const analysis = await createBarcodeAnalysis(barcodeLookup.barcode, market)
      setSession((previous) => ({
        ...previous,
        analysisId: analysis.analysisId,
        result: analysis,
      }))
    } catch (caught) {
      setSession((previous) => ({
        ...previous,
        error: caught instanceof Error ? caught.message : 'Could not open the database match.',
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

  if (result) {
    return <EvidenceReview result={result} images={images} onBack={() => void returnToScan()} onLogged={onLogged} />
  }

  const heroCopy = scanMode === 'packaged_label'
    ? {
        eyebrow: 'Sugar pAI label scan',
        title: <>Scan label.<br /><em>Validate evidence.</em></>,
        body: 'Photograph the package panels. Sugar pAI separates what can be read, what you confirm, and what cannot be determined before Smart Context appears.',
        steps: ['Label capture', 'Evidence validation', 'Smart Context'],
      }
    : {
        eyebrow: 'Unlabeled Filipino-food demo',
        title: <>Confirm food.<br /><em>Keep limits visible.</em></>,
        body: 'Use a curated demo catalog for unlabeled foods. Photo suggestions are optional hints; the food and portion must be selected before Smart Context appears.',
        steps: ['Photo or manual choice', 'Catalog confirmation', 'Smart Context'],
      }

  return (
    <div className="page scan-page">
      <section className="scan-hero">
        <div>
          <span className="eyebrow"><ScanLine size={14} /> {heroCopy.eyebrow}</span>
          <h1>{heroCopy.title}</h1>
          <p>{heroCopy.body}</p>
        </div>
        <div className="hero-proof">
          {heroCopy.steps.map((step, index) => <div key={step}><strong>{String(index + 1).padStart(2, '0')}</strong><span>{step}</span></div>)}
        </div>
      </section>

      <div className="segmented-control scan-mode-tabs" aria-label="Sugar pAI scan mode">
        <button type="button" className={scanMode === 'packaged_label' ? 'active' : ''} onClick={() => setScanMode('packaged_label')}><ScanLine size={15} /><span>Packaged label</span></button>
        <button type="button" className={scanMode === 'curated_unlabeled_demo' ? 'active' : ''} onClick={() => setScanMode('curated_unlabeled_demo')}><Utensils size={15} /><span>Unlabeled demo</span></button>
      </div>

      {scanMode === 'curated_unlabeled_demo' ? <UnlabeledFoodDemo onLogged={onLogged} /> : (
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
            title="Front label"
            description="Improves product identification and gives the review page a clearer package identity."
            recommended
            file={images.front}
            report={reports.front}
            checking={checking === 'front'}
            onChoose={(file) => void chooseImage('front', file)}
            onCamera={() => setSession((previous) => ({ ...previous, cameraPanel: 'front' }))}
            onRemove={() => removeImage('front')}
          />
          <ImagePanelCard
            number={4}
            title="Barcode scanner"
            description="Capture a close-up UPC or EAN barcode. It is decoded on this device into the barcode field."
            recommended
            file={barcodeImage ?? undefined}
            report={reports.barcode}
            checking={checking === 'barcode' || barcodeReading}
            onChoose={(file) => void chooseBarcodeImage(file)}
            onCamera={() => setBarcodeScannerOpen(true)}
            onRemove={removeBarcodeImage}
          />
        </div>

        <aside className="scan-sidebar">
          <section className="card analysis-card">
            <div className="section-heading"><div><span className="section-kicker">Analysis setup</span><h2>Before upload</h2></div><LockKeyhole size={19} /></div>
            <label className="select-field"><span>Label market</span><select value={market} onChange={(event) => setSession((previous) => ({ ...previous, market: event.target.value as Market }))}><option value="PH">Philippines</option><option value="US">United States</option></select></label>
            <label className="select-field"><span><Barcode size={15} /> Barcode {barcodeReading && '(reading…)'} </span><input value={barcode} inputMode="numeric" placeholder="Optional UPC / EAN" onChange={(event) => setSession((previous) => ({ ...previous, barcode: event.target.value.replace(/[^0-9]/g, ''), barcodeMessage: null, barcodeLookup: null, barcodeLookupLoading: false }))} /></label>
            {barcodeMessage && <div className={`notice ${barcodeMessage.startsWith('No ') ? 'warning' : 'neutral'}`}><Barcode size={17} /><span>{barcodeMessage}</span></div>}
            {barcodeLookupLoading && <div className="notice neutral"><LoaderCircle className="spin" size={17} /><span>Checking the local Open Food Facts database...</span></div>}
            {barcodeLookup && !barcodeLookupLoading && (
              <BarcodeLookupPanel lookup={barcodeLookup} busy={analyzing} onUse={() => void useDatabaseMatch()} />
            )}
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
                    <span>{event?.status === 'complete' || event?.status === 'skipped' ? <Check size={14} /> : event?.status === 'running' ? <LoaderCircle className="spin" size={14} /> : event?.status === 'failed' ? <AlertCircle size={14} /> : null}</span>
                    <div><strong>{label}</strong><small>{event?.label ?? 'Waiting'}</small></div>
                  </div>
                })}
              </div>
          </section>
        )}
      </aside>
      </div>
      )}

      {cameraPanel && (
        <CameraCapture
          label={`${cameraPanel[0].toUpperCase()}${cameraPanel.slice(1)} panel`}
          onCapture={(file) => chooseCaptureImage(cameraPanel, file)}
          onClose={() => setSession((previous) => ({ ...previous, cameraPanel: null }))}
        />
      )}
      {barcodeScannerOpen && <BarcodeScannerModal onDetected={handleLiveBarcodeDetected} onClose={() => setBarcodeScannerOpen(false)} />}
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

function BarcodeLookupPanel({ lookup, busy, onUse }: { lookup: OffProductLookupResponse; busy: boolean; onUse: () => void }) {
  const product = lookup.product
  const nutrients = product?.nutrients
  const nutrientSummary = nutrients
    ? [
        ['Carb', nutrients.totalCarbohydrate],
        ['Sugar', nutrients.totalSugars],
        ['Fiber', nutrients.fiber],
        ['Protein', nutrients.protein],
        ['Fat', nutrients.fat],
      ].map(([label, value]) => `${label} ${typeof value === 'number' ? `${value} g` : 'unknown'}`).join(' · ')
    : null
  const context = lookup.qualitativeMarkers
  const contextBits = [
    context?.novaGroup ? `NOVA: ${context.novaGroup}` : null,
    context?.nutriscoreGrade ? `Nutri-Score: ${context.nutriscoreGrade}` : null,
    context?.allergensTags ? `Allergens: ${context.allergensTags}` : null,
  ].filter(Boolean)

  return (
    <div className={`off-lookup-card off-lookup-${lookup.complete ? 'complete' : lookup.status}`}>
      <div className="off-lookup-title">
        <Database size={17} />
        <div>
          <strong>{product?.productName ?? lookup.barcode}</strong>
          <span>{lookup.message}</span>
        </div>
      </div>
      {product && (
        <div className="off-lookup-details">
          <span>{product.brand ?? 'Brand unknown'}</span>
          <span>{product.servingSize != null ? `${product.servingSize} ${product.servingUnit ?? ''}`.trim() : 'Serving unknown'}</span>
          {nutrientSummary && <span>{nutrientSummary}</span>}
          {contextBits.length > 0 && <span>{contextBits.join(' · ')}</span>}
        </div>
      )}
      {lookup.missingFields.length > 0 && (
        <div className="off-missing-fields">
          <strong>Capture label photos for</strong>
          <span>{lookup.missingFields.join(', ')}</span>
        </div>
      )}
      {lookup.complete && (
        <button className="secondary-button wide" disabled={busy} onClick={onUse}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
          Use database match
        </button>
      )}
    </div>
  )
}
