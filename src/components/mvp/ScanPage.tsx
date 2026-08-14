import { AlertCircle, ArrowRight, Barcode, Camera, Check, Database, Info, LoaderCircle, RefreshCw, RotateCcw, ScanLine, Upload, Utensils, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { type AnalysisPanelKind, type PanelKind, type ScanServiceStatus, type ScanSessionState } from '../../domain/scanSession'
import type { ImageQualityReport, LogEntry, Market, OffProductLookupResponse, OffProductPreview, SmartContextRecordKind } from '../../domain/types'
import { API_BASE_LABEL, checkBackendHealth, createAnalysis, createBarcodeAnalysis, deleteAnalysis, lookupOffProduct, streamAnalysis, type AnalysisImages, type BackendHealth } from '../../lib/api'
import { decodeBarcode } from '../../lib/barcode'
import { inspectImage } from '../../lib/imageQuality'
import BarcodeScannerModal from './BarcodeScannerModal'
import CameraCapture from './CameraCapture'
import EvidenceReview from './EvidenceReview'
import ImagePreviewButton from './ImagePreviewButton'
import ImagePanelCard from './ImagePanelCard'
import UnlabeledFoodDemo from './UnlabeledFoodDemo'
import {
  QualitySummaryInline,
  TechnicalDetails,
} from './uiHelpers'
import {
  consumerPipelineStageLabel,
  consumerStageStatus,
  scanSetupState,
} from './uiDisplay'

const PIPELINE_STAGES = [
  'image_check',
  'barcode_lookup',
  'label_extraction',
  'ingredient_classification',
  'evidence_assembly',
  'safety_validation',
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
        message: 'Checking analysis service...',
        detail: null,
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
    const failed = allChecks.filter((check) => check.status === 'fail')
    const warned = allChecks.filter((check) => check.status === 'warn')
    return {
      fails: failed.length,
      warnings: warned.length,
      blockingDetails: failed.map((check) => check.detail || check.label),
      warningDetails: warned.map((check) => check.detail || check.label),
    }
  }, [reports])

  const setupState = scanSetupState({
    hasEvidence: Boolean(barcode || barcodeImage || images.nutrition || images.ingredients || images.front),
    canAnalyze,
    analyzing,
    fails: qualitySummary.fails,
    warnings: qualitySummary.warnings,
    resultStatus: result?.status,
  })
  const hasNutritionPhoto = Boolean(images.nutrition)
  const sidebarTitle = analyzing
    ? 'Analyzing label'
    : qualitySummary.fails > 0
      ? 'Photo needs attention'
      : canAnalyze
        ? 'Ready to analyze'
        : hasNutritionPhoto
          ? 'Nutrition photo added'
          : 'Ready for evidence'
  const sidebarCopy = analyzing
    ? 'Reading the label evidence and preparing review fields.'
    : qualitySummary.fails > 0
      ? 'Replace the flagged photo before continuing.'
      : canAnalyze
        ? 'Your Nutrition Facts photo is readable enough to continue.'
        : hasNutritionPhoto
          ? 'Wait for the photo quality check to finish before analyzing.'
          : 'Add a readable Nutrition Facts photo to continue.'
  const sidebarNext = !images.ingredients
    ? 'Adding the ingredients panel improves sugar-source analysis.'
    : 'All supporting panels added. Review the analysis before saving.'

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
        message: 'Checking analysis service...',
        detail: null,
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
      window.scrollTo({ top: 0, behavior: 'auto' })
    } catch (caught) {
      setSession((previous) => ({
        ...previous,
        error: caught instanceof Error ? caught.message : 'Analysis failed. No sample result was substituted.',
      }))
    } finally {
      setSession((previous) => ({ ...previous, analyzing: false }))
    }
  }

  const selectDatabaseMatch = async () => {
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
    return (
      <EvidenceReview
        result={result}
        images={images}
        onBack={() => void returnToScan()}
        onLogged={onLogged}
        onValidated={(validated) => setSession((previous) => ({ ...previous, result: validated }))}
        onReviewing={(reviewing) => setSession((previous) => ({ ...previous, result: reviewing }))}
      />
    )
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
      {scanMode === 'packaged_label' ? (
        <BarcodeFirstPanel
          market={market}
          barcode={barcode}
          barcodeImage={barcodeImage}
          barcodeReading={barcodeReading}
          barcodeMessage={barcodeMessage}
          barcodeLookup={barcodeLookup}
          barcodeLookupLoading={barcodeLookupLoading}
          barcodeReport={reports.barcode}
          busy={analyzing}
          onOpenScanner={() => setBarcodeScannerOpen(true)}
          onChooseBarcodeImage={(file) => void chooseBarcodeImage(file)}
          onRemoveBarcodeImage={removeBarcodeImage}
          onUseDatabaseMatch={() => void selectDatabaseMatch()}
          onMarketChange={(nextMarket) => setSession((previous) => ({ ...previous, market: nextMarket }))}
          onBarcodeChange={(nextBarcode) => setSession((previous) => ({
            ...previous,
            barcode: nextBarcode.replace(/[^0-9]/g, ''),
            barcodeMessage: null,
            barcodeLookup: null,
            barcodeLookupLoading: false,
          }))}
        />
      ) : (
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
      )}

      <div className="segmented-control scan-mode-tabs" aria-label="Sugar pAI scan mode">
        <button type="button" className={scanMode === 'packaged_label' ? 'active' : ''} onClick={() => setScanMode('packaged_label')}><ScanLine size={15} /><span>Packaged label</span></button>
        <button type="button" className={scanMode === 'estimated_unlabeled_meal' ? 'active' : ''} onClick={() => setScanMode('estimated_unlabeled_meal')}><Utensils size={15} /><span>Estimated meal</span></button>
      </div>

      {scanMode === 'estimated_unlabeled_meal' ? <UnlabeledFoodDemo onLogged={onLogged} /> : (
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
        </div>

        <aside className="scan-sidebar">
          <section className="card analysis-card">
            <div className="section-heading scan-sidebar-heading">
              <div><span className="section-kicker">Next step</span><h2>{sidebarTitle}</h2></div>
              <span className={`scan-state-pill state-${setupState.tone}`}>{setupState.label}</span>
            </div>
            <p className="scan-sidebar-copy">{sidebarCopy}</p>
            <div className="scan-readiness-note"><Info size={16} /><span>{sidebarNext}</span></div>
            {qualitySummary.fails > 0 && (
              <div className="notice error"><AlertCircle size={17} /><span>{qualitySummary.blockingDetails[0] ?? 'Retake or replace the photo before analysis.'}</span></div>
            )}
            {qualitySummary.fails === 0 && qualitySummary.warnings > 0 && (
              <div className="notice warning"><AlertCircle size={17} /><span>{qualitySummary.warningDetails[0] ?? 'One photo may need careful review after analysis.'}</span></div>
            )}
            {serviceStatus.state === 'offline' && <div className="notice error"><AlertCircle size={17} /><span>{serviceStatus.message}</span></div>}
            {error && <div className="notice error"><AlertCircle size={17} /><span>{error}</span></div>}
            <button className="primary-button wide" disabled={!canAnalyze} onClick={() => void analyze()}>
              {analyzing ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />}
              {analyzing ? 'Analyzing label...' : 'Analyze label'}
              {!analyzing && <ArrowRight size={17} />}
            </button>
            {!images.nutrition && <small className="button-helper">Add a readable Nutrition Facts panel to continue.</small>}
            <TechnicalDetails>
              <div className={`service-status service-${serviceStatus.state}`}>
                <div>
                  <strong>Analysis service</strong>
                  <small>{serviceStatus.message}</small>
                </div>
                <button type="button" onClick={() => void refreshServiceStatus()} aria-label="Check analysis service">
                  {serviceStatus.state === 'checking' ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
                </button>
              </div>
              <div className="diagnostic-row"><strong>Service endpoint</strong><span>{API_BASE_LABEL}</span></div>
              <div className="diagnostic-row"><strong>Service state</strong><span>{serviceStatus.state}</span></div>
              {serviceStatus.detail && <div className="diagnostic-row"><strong>Last response</strong><span>{serviceStatus.detail}</span></div>}
              {serviceStatus.checkedAt && <div className="diagnostic-row"><strong>Checked</strong><span>{new Date(serviceStatus.checkedAt).toLocaleString()}</span></div>}
            </TechnicalDetails>
          </section>

          {analyzing && (
            <section className="card pipeline-card" aria-live="polite">
              <span className="section-kicker">Analysis progress</span>
              <div className="pipeline-list">
                {PIPELINE_STAGES.map((id) => {
                  const event = stages[id]
                  return <div key={id} className={`pipeline-row pipeline-${event?.status ?? 'waiting'}`}>
                    <span>{event?.status === 'complete' || event?.status === 'skipped' ? <Check size={14} /> : event?.status === 'running' ? <LoaderCircle className="spin" size={14} /> : event?.status === 'failed' ? <AlertCircle size={14} /> : null}</span>
                    <div><strong>{consumerPipelineStageLabel(id)}</strong><small>{consumerStageStatus(event)}</small></div>
                  </div>
                })}
              </div>
              <details className="pipeline-raw-details">
                <summary>Technical details</summary>
                {PIPELINE_STAGES.map((id) => {
                  const event = stages[id]
                  return <small key={id}>{id}: {event?.label ?? 'waiting'} ({event?.status ?? 'waiting'})</small>
                })}
              </details>
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
      {barcodeScannerOpen && <BarcodeScannerModal onDetected={handleLiveBarcodeDetected} onUpload={(file) => void chooseBarcodeImage(file)} onClose={() => setBarcodeScannerOpen(false)} />}
    </div>
  )
}

function statusFromHealth(health: BackendHealth): ScanServiceStatus {
  return {
    state: health.ok ? 'online' : 'offline',
    message: health.ok ? 'Ready to analyze labels.' : 'Analysis service unavailable. Check the local service and retry.',
    detail: health.message,
    checkedAt: new Date().toISOString(),
  }
}

function BarcodeFirstPanel({
  market,
  barcode,
  barcodeImage,
  barcodeReading,
  barcodeMessage,
  barcodeLookup,
  barcodeLookupLoading,
  barcodeReport,
  busy,
  onOpenScanner,
  onChooseBarcodeImage,
  onRemoveBarcodeImage,
  onUseDatabaseMatch,
  onMarketChange,
  onBarcodeChange,
}: {
  market: Market
  barcode: string
  barcodeImage: File | null
  barcodeReading: boolean
  barcodeMessage: string | null
  barcodeLookup: OffProductLookupResponse | null
  barcodeLookupLoading: boolean
  barcodeReport?: ImageQualityReport
  busy: boolean
  onOpenScanner: () => void
  onChooseBarcodeImage: (file: File) => void
  onRemoveBarcodeImage: () => void
  onUseDatabaseMatch: () => void
  onMarketChange: (market: Market) => void
  onBarcodeChange: (barcode: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const product = barcodeLookup?.product
  const productDisplayName = formatOffProductDisplayName(product, barcodeLookup?.barcode ?? barcode)
  const productMeta = [
    product?.brand ? formatNameText(product.brand) : null,
    product?.barcode ? `Barcode ${product.barcode}` : null,
  ].filter(Boolean).join(' · ')
  const stateLabel = barcodeLookupLoading
    ? 'Checking database'
    : barcodeLookup?.complete
      ? 'Database match'
      : barcode
        ? 'Barcode ready'
        : 'Ready to scan'
  const warningMessage = barcodeMessage?.startsWith('No ')

  return (
    <section className={`barcode-first-card ${barcodeLookup?.complete ? 'has-database-match' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onChooseBarcodeImage(file)
          event.target.value = ''
        }}
      />
      <div className="barcode-first-copy">
        <span className="eyebrow"><Barcode size={14} /> Barcode lookup</span>
        <h1>Scan the barcode</h1>
        <p>Start with UPC or EAN. A complete local match opens review immediately; otherwise add label photos below.</p>
        <div className="barcode-first-actions">
          <button type="button" className="primary-button barcode-open-button" onClick={onOpenScanner}>
            <Camera size={19} />
            Open live scanner
          </button>
          <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
            <Upload size={17} />
            Upload barcode photo
          </button>
        </div>
      </div>

      {barcodeLookup?.complete && barcodeLookup.product ? (
        <div className="product-found-summary">
          <span className="eyebrow"><Check size={14} /> Product found</span>
          <h2>{productDisplayName}</h2>
          <p>{productMeta || 'Brand and serving details unavailable'}</p>
          <div className="found-nutrient-grid">
            <span><small>Carbohydrate</small><strong>{barcodeLookup.product.nutrients.totalCarbohydrate == null ? 'Not declared' : `${barcodeLookup.product.nutrients.totalCarbohydrate} g`}</strong></span>
            <span><small>Total sugars</small><strong>{barcodeLookup.product.nutrients.totalSugars == null ? 'Not declared' : `${barcodeLookup.product.nutrients.totalSugars} g`}</strong></span>
            <span><small>Fiber</small><strong>{barcodeLookup.product.nutrients.fiber == null ? 'Not declared' : `${barcodeLookup.product.nutrients.fiber} g`}</strong></span>
          </div>
          {barcodeLookup.qualitativeMarkers?.novaGroup && (
            <div className="nova-context">
              <div><Info size={14} /><strong>{formatNovaGroup(barcodeLookup.qualitativeMarkers.novaGroup)}</strong></div>
              <small>Processing category from the local Open Food Facts record. NOVA is context, not a health score.</small>
            </div>
          )}
          <div className="product-found-actions"><button className="primary-button" disabled={busy} onClick={onUseDatabaseMatch}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Use this product</button><button className="text-button" onClick={onRemoveBarcodeImage}>Not this product</button></div>
        </div>
      ) : (
        <button type="button" className="barcode-camera-tile" onClick={onOpenScanner}>
          <span className="barcode-tile-icon"><ScanLine size={40} /></span>
          <span>{stateLabel}</span>
          <strong>{barcode || 'UPC / EAN'}</strong>
        </button>
      )}

      <div className="barcode-first-controls">
        <label className="select-field"><span>Label market</span><select value={market} onChange={(event) => onMarketChange(event.target.value as Market)}><option value="PH">Philippines</option><option value="US">United States</option></select></label>
        <label className="select-field"><span><Barcode size={15} /> Barcode {barcodeReading && '(reading...)'}</span><input value={barcode} inputMode="numeric" placeholder="UPC / EAN digits" onChange={(event) => onBarcodeChange(event.target.value)} /></label>

        {barcodeImage && (
          <div className="image-review barcode-photo-review">
            <ImagePreviewButton file={barcodeImage} label="Barcode photo" />
            <div className="quality-list">
              <strong>{barcodeImage.name}</strong>
              {barcodeReading && <small>Reading barcode...</small>}
              <QualitySummaryInline report={barcodeReport} checking={barcodeReading && !barcodeReport} />
            </div>
            <div className="image-actions">
              <button type="button" onClick={() => inputRef.current?.click()} aria-label="Retake or replace barcode photo"><RotateCcw size={16} /></button>
              <button type="button" onClick={onRemoveBarcodeImage} aria-label="Remove barcode photo"><X size={17} /></button>
            </div>
          </div>
        )}

        {barcodeMessage && <div className={`notice ${warningMessage ? 'warning' : 'neutral'}`}><Barcode size={17} /><span>{barcodeMessage}</span></div>}
        {barcodeLookupLoading && <div className="notice neutral"><LoaderCircle className="spin" size={17} /><span>Checking the local Open Food Facts database...</span></div>}
        {barcodeLookup && !barcodeLookupLoading && (
          <BarcodeLookupPanel lookup={barcodeLookup} productDisplayName={productDisplayName} />
        )}
      </div>
    </section>
  )
}

function BarcodeLookupPanel({ lookup, productDisplayName }: { lookup: OffProductLookupResponse; productDisplayName: string }) {
  const product = lookup.product
  const nutrients = product?.nutrients
  const nutrientSummary = nutrients
    ? [
        ['Carb', nutrients.totalCarbohydrate],
        ['Sugar', nutrients.totalSugars],
        ['Fiber', nutrients.fiber],
        ['Protein', nutrients.protein],
        ['Fat', nutrients.fat],
      ].map(([label, value]) => `${label} ${typeof value === 'number' ? `${value} g` : 'Not declared / unavailable'}`).join(' · ')
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
        {lookup.complete ? <Check size={17} /> : <Database size={17} />}
        <div>
          <strong>{lookup.complete ? `${productDisplayName} found` : product?.productName ? formatNameText(product.productName) : lookup.barcode}</strong>
          <span>{lookup.message}</span>
        </div>
      </div>
      {product && !lookup.complete && (
        <div className="off-lookup-details">
          <span>{product.brand ? formatNameText(product.brand) : 'Brand unknown'}</span>
          <span>{formatServingLabel(product) ?? 'Serving unknown'}</span>
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
    </div>
  )
}

function formatOffProductDisplayName(product: OffProductPreview | null | undefined, fallback: string): string {
  const base = formatNameText(product?.productName || fallback || 'Product')
  const serving = formatServingLabel(product)
  if (!serving) return base
  const compactServing = serving.replace(/\s+/g, '')
  const normalizedBase = base.toLowerCase()
  if (normalizedBase.includes(serving.toLowerCase()) || normalizedBase.includes(compactServing.toLowerCase())) {
    return base
  }
  return `${base} ${serving}`
}

function formatServingLabel(product: OffProductPreview | null | undefined): string | null {
  if (product?.servingSize == null) return null
  const unit = product.servingUnit?.trim() || 'g'
  return `${product.servingSize} ${unit}`.replace(/\s+/g, ' ').trim()
}

function formatNameText(value: string): string {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*(g|kg|mg|ml|l)\b/gi, (_, amount: string, unit: string) => `${amount} ${unit.toLowerCase()}`)
    .replace(/\bsky\s*flakes\b/gi, 'SkyFlakes')
    .trim()
  if (/[a-z]/.test(cleaned) && /[A-Z]/.test(cleaned.replace(/\b(SkyFlakes)\b/g, ''))) return cleaned
  return cleaned.replace(/\b([a-z])([a-z'’-]*)/gi, (word) => {
    if (/^(g|kg|mg|ml|l)$/i.test(word)) return word.toLowerCase()
    if (/^SkyFlakes$/i.test(word)) return 'SkyFlakes'
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}

function formatNovaGroup(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/^(\d)\s*-\s*(.+)$/)
  if (!match) return `NOVA · ${cleaned}`
  return `NOVA ${match[1]} · ${formatNameText(match[2])}`
}
