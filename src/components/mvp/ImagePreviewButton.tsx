import { FileImage, ZoomIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import ImageViewerModal from './ImageViewerModal'

interface Props {
  file?: Blob
  fileName?: string
  label: string
  className?: string
}

export default function ImagePreviewButton({ file, fileName, label, className = 'image-preview-button' }: Props) {
  const [open, setOpen] = useState(false)
  const [dataUrl, setDataUrl] = useState<{ file: Blob; src: string } | null>(null)
  const src = dataUrl && dataUrl.file === file ? dataUrl.src : null

  useEffect(() => {
    if (!file) return undefined

    const reader = new FileReader()
    let cancelled = false
    reader.onload = () => {
      if (!cancelled && typeof reader.result === 'string') setDataUrl({ file, src: reader.result })
    }
    reader.onerror = () => {
      if (!cancelled) setDataUrl(null)
    }
    reader.readAsDataURL(file)

    return () => {
      cancelled = true
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }, [file])

  if (!file || !src) return <FileImage size={26} />

  const title = `${label}: ${fileName ?? (file instanceof File ? file.name : 'retained image')}`

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={`Open ${label} image`}>
        <img src={src} alt={`${label} preview`} />
        <span className="image-preview-zoom" aria-hidden="true"><ZoomIn size={14} /></span>
      </button>
      {open && <ImageViewerModal src={src} title={title} alt={label} onClose={() => setOpen(false)} />}
    </>
  )
}
