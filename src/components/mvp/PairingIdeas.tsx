import {
  ExternalLink,
  Footprints,
  Info,
  Leaf,
  ListOrdered,
  Tag,
  Utensils,
} from 'lucide-react'
import { PAIRING_SOURCES, type PairingInsight, type PairingInsightCategory } from '../../domain/pairing'

interface Props {
  insights: PairingInsight[]
  variant?: 'card' | 'drawer'
}

const CATEGORY_LABELS: Record<PairingInsightCategory, string> = {
  fiber: 'Fiber',
  protein_fat: 'Protein/fat',
  food_order: 'Food order',
  ingredients: 'Ingredients',
  movement: 'Movement',
  data_quality: 'Evidence',
}

const CATEGORY_ICONS = {
  fiber: Leaf,
  protein_fat: Utensils,
  food_order: ListOrdered,
  ingredients: Tag,
  movement: Footprints,
  data_quality: Info,
} satisfies Record<PairingInsightCategory, typeof Info>

export default function PairingIdeas({ insights, variant = 'card' }: Props) {
  const heading = (
    <div>
      <span className="section-kicker">Smart Context</span>
      {variant === 'drawer' ? <h3>Based on the label you confirmed</h3> : <h2>Based on the label you confirmed</h2>}
    </div>
  )

  return (
    <section className={variant === 'drawer' ? 'drawer-section pairing-card pairing-drawer-section' : 'card pairing-card'}>
      <div className="section-heading">
        {heading}
        <Info size={18} />
      </div>

      <div className="pairing-list">
        {insights.map((insight) => {
          const Icon = CATEGORY_ICONS[insight.category]
          return (
            <article className={`pairing-insight pairing-${insight.category}`} key={insight.id}>
              <div className="pairing-icon"><Icon size={16} /></div>
              <div className="pairing-content">
                <div className="pairing-title-row">
                  <strong>{insight.title}</strong>
                  <span>{CATEGORY_LABELS[insight.category]}</span>
                </div>
                <p>{insight.body}</p>
                {insight.evidenceLabels.length > 0 && (
                  <div className="pairing-evidence">
                    {insight.evidenceLabels.map((label) => <span key={label}>{label}</span>)}
                  </div>
                )}
                {insight.actionChips?.length ? (
                  <div className="action-chip-row">
                    {insight.actionChips.map((chip) => <span key={chip}>{chip}</span>)}
                  </div>
                ) : null}
                {insight.sourceIds?.length ? (
                  <div className="pairing-sources">
                    {insight.sourceIds.map((sourceId) => {
                      const source = PAIRING_SOURCES[sourceId]
                      return (
                        <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={source.summary}>
                          {source.title}<ExternalLink size={12} />
                        </a>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      <p className="pairing-disclaimer">Educational Smart Context only. It is not medical advice and does not predict or guarantee glucose response.</p>
    </section>
  )
}
