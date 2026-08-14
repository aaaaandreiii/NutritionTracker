import { Barcode, CheckCircle2, LoaderCircle, RefreshCw, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'

interface Props {
  onDetected: (barcode: string) => void
  onUpload: (file: File) => void
  onClose: () => void
}

type ScannerState = 'starting' | 'scanning' | 'detected' | 'not-detected' | 'error'

export default function BarcodeScannerModal({ onDetected, onUpload, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [scannerState, setScannerState] = useState<ScannerState>('starting')
  const [message, setMessage] = useState('Starting camera...')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let controls: IScannerControls | null = null

    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          videoRef.current ?? undefined,
          (result, _error, activeControls) => {
            if (!result || cancelled) {
              setScannerState((state) => state === 'detected' ? state : 'not-detected')
              setMessage('No UPC or EAN barcode detected yet.')
              return
            }
            const value = result.getText().replace(/[^0-9]/g, '')
            if (value.length < 6) return
            cancelled = true
            setScannerState('detected')
            setMessage(`Detected ${value}.`)
            activeControls.stop()
            onDetected(value)
          },
        )
        if (cancelled) {
          controls.stop()
          return
        }
        setScannerState('scanning')
        setMessage('Point the camera at the barcode.')
      } catch {
        setScannerState('error')
        setMessage('Camera access was denied or no camera is available.')
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void startScanner()

    return () => {
      cancelled = true
      controls?.stop()
      document.body.style.overflow = previousOverflow
    }
  }, [attempt, onDetected])

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Scan barcode">
      <div className="camera-modal barcode-live-modal">
        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) { onUpload(file); onClose() }
          event.target.value = ''
        }} />
        <div className="modal-header">
          <div><strong>Barcode scanner</strong><small>Align a UPC or EAN code inside the guide.</small></div>
          <button className="icon-button" onClick={onClose} aria-label="Close scanner"><X size={20} /></button>
        </div>
        <div className={`camera-frame barcode-live-frame scanner-${scannerState}`}>
          <video ref={videoRef} playsInline muted />
          <div className="barcode-guide" />
          {scannerState === 'error' && <div className="camera-error"><Barcode size={34} /><p>{message}</p></div>}
        </div>
        <div className={`scanner-state scanner-state-${scannerState}`} aria-live="polite">
          {scannerState === 'detected' ? <CheckCircle2 size={18} /> : scannerState === 'starting' ? <LoaderCircle className="spin" size={18} /> : <Barcode size={18} />}
          <span>{message}</span>
        </div>
        {scannerState === 'error' && <div className="camera-recovery-actions"><button className="secondary-button" onClick={() => { setScannerState('starting'); setAttempt((value) => value + 1) }}><RefreshCw size={17} /> Retry camera</button><button className="secondary-button" onClick={() => uploadRef.current?.click()}><Upload size={17} /> Upload barcode photo</button></div>}
      </div>
    </div>
  )
}
