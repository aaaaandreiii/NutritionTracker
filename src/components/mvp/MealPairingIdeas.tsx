import { CheckCircle2, Info, Plus, X } from 'lucide-react'
import type { MealPairingComponent } from '../../domain/types'
import type { PairingSuggestion } from '../../domain/pairing'

interface Props {
  suggestions: PairingSuggestion[]
  selectedComponents: MealPairingComponent[]
  catalogReady: boolean
  catalogWarning?: string | null
  onAddSuggestion: (suggestion: PairingSuggestion) => void
  onRemoveComponent: (componentId: string) => void
}

export default function MealPairingIdeas({
  suggestions,
  selectedComponents,
  catalogReady,
  catalogWarning,
  onAddSuggestion,
  onRemoveComponent,
}: Props) {
  if (!catalogReady && suggestions.length === 0 && selectedComponents.length === 0) return null

  return (
    <section className="card meal-pairing-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Meal pairing ideas</span>
          <h2>Pair with</h2>
          <p>Suggestions based on the label values you confirmed.</p>
        </div>
        <Info size={18} />
      </div>

      {suggestions.length > 0 ? (
        <div className="meal-pairing-list">
          {suggestions.map((suggestion) => {
            const selected = selectedComponents.some((component) => component.foodId === suggestion.foodId)
            return (
              <article className="meal-pairing-item" key={suggestion.foodId}>
                <div>
                  <div className="meal-pairing-title-row">
                    <strong>{suggestion.displayName}</strong>
                    <span>{suggestion.label}</span>
                  </div>
                  <p>{suggestion.reason}</p>
                  <div className="pairing-evidence">
                    {suggestion.evidenceLabels.map((label) => <span key={label}>{label}</span>)}
                  </div>
                  <small>Food reference: {suggestion.source.name}</small>
                </div>
                <button
                  type="button"
                  className={selected ? 'secondary-button pairing-added-button' : 'secondary-button'}
                  disabled={selected}
                  onClick={() => onAddSuggestion(suggestion)}
                >
                  {selected ? <CheckCircle2 size={15} /> : <Plus size={15} />}
                  {selected ? 'Added' : 'Add to meal'}
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="meal-pairing-empty">
          {catalogWarning ?? 'No specific pairings suggested. Sugar pAI only shows pairings when there is enough confirmed food context.'}
        </p>
      )}

      {selectedComponents.length > 0 && (
        <div className="selected-pairing-components">
          <strong>Meal context</strong>
          {selectedComponents.map((component) => (
            <span key={component.componentId}>
              {component.displayName}
              <button type="button" onClick={() => onRemoveComponent(component.componentId)} aria-label={`Remove ${component.displayName}`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="meal-pairing-disclosure">
        Pairings are separate foods suggested from confirmed product context. They do not change or fill in the scanned product's nutrition values.
      </p>
    </section>
  )
}
