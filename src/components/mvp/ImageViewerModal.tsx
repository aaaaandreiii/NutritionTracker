import { X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  src: string
  title: string
  alt: string
  onClose: () => void
}

export default function ImageViewerModal({ src, title, alt, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="image-viewer-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="image-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="image-viewer-header">
          <strong>{title}</strong>
          <button type="button" onClick={onClose} aria-label="Close image viewer"><X size={18} /></button>
        </div>
        <div className="image-viewer-frame">
          <img src={src} alt={alt} />
        </div>
      </div>
    </div>
  )
}
