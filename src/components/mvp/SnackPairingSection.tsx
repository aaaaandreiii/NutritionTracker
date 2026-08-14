import { ExternalLink, Info } from 'lucide-react'
import { useState } from 'react'
import { PAIRING_SOURCES, type SnackPairingResult } from '../../domain/pairing'

interface Props {
  pairing: SnackPairingResult
  productDisplayName: string
}

function strengthLabel(strength: SnackPairingResult['evidence'][number]['strength']): string {
  return strength === 'strong' ? 'Strong' : 'Moderate'
}

export default function SnackPairingSection({ pairing, productDisplayName }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (pairing.ideas.length === 0) return null

  return (
    <section className="card snack-pairing-card" aria-labelledby="snack-pairing-heading">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Pair with this snack</span>
          <h2 id="snack-pairing-heading">A few ideas to have alongside it</h2>
          <p>General pairing ideas based on the confirmed product context and supporting nutrition evidence.</p>
        </div>
        <Info size={18} />
      </div>

      <div className="snack-pairing-grid">
        {pairing.ideas.map((idea) => (
          <article className="snack-pairing-item" key={idea.id}>
            <div className="snack-pairing-title-row">
              <h3>{idea.label}</h3>
              <span>{idea.tag}</span>
            </div>
            <p>{idea.rationale}</p>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="text-button snack-pairing-evidence-toggle"
        aria-expanded={expanded}
        aria-controls="snack-pairing-evidence"
        onClick={() => setExpanded((value) => !value)}
      >
        Why these suggestions?
      </button>

      {expanded && (
        <div className="snack-pairing-evidence-panel" id="snack-pairing-evidence">
          <div className="snack-pairing-context-row">
            <strong>Product evidence · Strong</strong>
            <p>{productDisplayName} remains the confirmed scanned product. Pairings are separate foods and do not change its nutrition values.</p>
            <span>{pairing.productKindLabel}</span>
          </div>
          <div className="snack-pairing-evidence-list" aria-label="Supporting evidence for snack pairings">
            {pairing.evidence.filter((record) => record.relationship === 'supporting').map((record) => (
              <article key={record.id}>
                <div>
                  <strong>{record.title}</strong>
                  <span>Supporting evidence · {strengthLabel(record.strength)}</span>
                </div>
                <p>{record.summary}</p>
                <div className="snack-pairing-source-links">
                  {record.sourceIds.map((sourceId) => {
                    const source = PAIRING_SOURCES[sourceId]
                    return (
                      <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={source.summary}>
                        {source.title}<ExternalLink size={12} />
                      </a>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="snack-pairing-note">
        These suggestions are general food pairings, not product-specific clinical recommendations. They do not change the nutrition values of {productDisplayName}.
      </p>
    </section>
  )
}
