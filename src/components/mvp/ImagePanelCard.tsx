import { Camera, Check, FileImage, RotateCcw, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { ImageQualityReport } from '../../domain/types'

interface Props {
  number: number
  title: string
  description: string
  required?: boolean
  recommended?: boolean
  file?: File
  report?: ImageQualityReport
  checking?: boolean
  onChoose: (file: File) => void
  onCamera: () => void
  onRemove: () => void
}

export default function ImagePanelCard(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => props.file ? URL.createObjectURL(props.file) : null, [props.file])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  return (
    <section className={`panel-card ${props.file ? 'has-image' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) props.onChoose(file)
          event.target.value = ''
        }}
      />
      <div className="step-number">{props.file ? <Check size={16} /> : props.number}</div>
      <div className="panel-copy">
        <div className="panel-title-line">
          <h2>{props.title}</h2>
          {props.required && <span className="required-pill">Required</span>}
          {props.recommended && <span className="optional-pill">Recommended</span>}
        </div>
        <p>{props.description}</p>

        {!props.file ? (
          <div className="panel-actions">
            <button className="secondary-button" onClick={props.onCamera}><Camera size={16} /> Use camera</button>
            <button className="text-button" onClick={() => inputRef.current?.click()}><Upload size={16} /> Choose image</button>
          </div>
        ) : (
          <div className="image-review">
            {preview ? <img src={preview} alt={`${props.title} preview`} /> : <FileImage size={26} />}
            <div className="quality-list">
              <strong>{props.file.name}</strong>
              {props.checking && <small>Checking image…</small>}
              {props.report?.checks.map((check) => (
                <span key={check.code} className={`quality-${check.status}`} title={check.detail}>
                  <i /> {check.label}
                </span>
              ))}
            </div>
            <div className="image-actions">
              <button onClick={() => inputRef.current?.click()} aria-label={`Replace ${props.title}`}><RotateCcw size={16} /></button>
              <button onClick={props.onRemove} aria-label={`Remove ${props.title}`}><X size={17} /></button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
