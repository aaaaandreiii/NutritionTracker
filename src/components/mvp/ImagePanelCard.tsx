import { Camera, Check, RotateCcw, Upload, X } from 'lucide-react'
import { useRef } from 'react'
import type { ImageQualityReport } from '../../domain/types'
import ImagePreviewButton from './ImagePreviewButton'
import { QualitySummaryInline } from './uiHelpers'

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
  const statusLabel = props.required ? 'Required' : props.recommended ? 'Recommended' : 'Optional'
  const statusClass = props.required ? 'required-pill' : props.recommended ? 'recommended-pill' : 'optional-pill'
  const cardClass = props.required ? 'panel-required' : props.recommended ? 'panel-recommended' : 'panel-optional'

  return (
    <section className={`panel-card ${props.file ? 'has-image' : ''} ${cardClass}`}>
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
          <span className={statusClass}>{statusLabel}</span>
        </div>
        <p>{props.description}</p>

        {!props.file ? (
          <div className="panel-actions">
            <button type="button" className="secondary-button" onClick={props.onCamera}><Camera size={16} /> Use camera</button>
            <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={16} /> Choose image</button>
          </div>
        ) : (
          <div className="image-review">
            <ImagePreviewButton file={props.file} label={props.title} />
            <div className="quality-list">
              <strong>{props.file.name}</strong>
              <QualitySummaryInline report={props.report} checking={props.checking} />
            </div>
            <div className="image-actions">
              <button onClick={() => inputRef.current?.click()} aria-label={`Retake or replace ${props.title}`}><RotateCcw size={16} /></button>
              <button onClick={props.onRemove} aria-label={`Remove ${props.title}`}><X size={17} /></button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
