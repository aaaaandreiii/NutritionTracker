import { Camera, CameraOff, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  onCapture: (file: File) => void
  onClose: () => void
}

export default function CameraCapture({ label, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices?.getUserMedia({
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
    }
  }, [])

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
        <div className="modal-header">
          <div><strong>{label}</strong><small>Fill the guide and keep every row visible.</small></div>
          <button className="icon-button" onClick={onClose} aria-label="Close camera"><X size={20} /></button>
        </div>
        <div className="camera-frame">
          {error ? (
            <div className="camera-error"><CameraOff size={34} /><p>{error}</p></div>
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
