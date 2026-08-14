import { Camera, CameraOff, RefreshCw, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  onCapture: (file: File) => void
  onClose: () => void
}

export default function CameraCapture({ label, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setError('Camera access is unavailable in this browser. Choose an image from your device instead.'))
      return () => { document.body.style.overflow = previousOverflow }
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        void videoRef.current.play()
      }
    }).catch(() => setError('Camera access was denied or no camera is available. You can choose an image instead.'))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      document.body.style.overflow = previousOverflow
    }
  }, [attempt])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      onCapture(new File([blob], `${label.toLowerCase().replaceAll(' ', '-')}.jpg`, { type: 'image/jpeg' }))
      onClose()
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Capture ${label}`}>
      <div className="camera-modal">
        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) { onCapture(file); onClose() }
          event.target.value = ''
        }} />
        <div className="modal-header">
          <div><strong>{label}</strong><small>Fill the guide and keep every row visible.</small></div>
          <button className="icon-button" onClick={onClose} aria-label="Close camera"><X size={20} /></button>
        </div>
        <div className="camera-frame">
          {error ? (
            <div className="camera-error"><CameraOff size={34} /><p>{error}</p><div className="camera-recovery-actions"><button className="secondary-button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}><RefreshCw size={17} /> Retry camera</button><button className="secondary-button" onClick={() => uploadRef.current?.click()}><Upload size={17} /> Choose image</button></div></div>
          ) : (
            <><video ref={videoRef} playsInline muted /><div className="camera-guide" /></>
          )}
        </div>
        <button className="primary-button" onClick={capture} disabled={Boolean(error)}>
          <Camera size={18} /> Capture photo
        </button>
      </div>
    </div>
  )
}
