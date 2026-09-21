'use client'

import { ArrowRight, Check, Coins, LoaderCircle, Sparkles, X } from 'lucide-react'

import type { PendingKovarRequest } from '@/features/chat/types'

type Props = {
  request: PendingKovarRequest
  isPending: boolean
  onCancel: () => void
  onChooseModel: (model: string) => void
  onConfirm: () => void
}

export function KovarRequestCard({ request, isPending, onCancel, onChooseModel, onConfirm }: Props) {
  return (
    <section className="request-card" aria-label="Kovar request confirmation">
      <div className="request-card__header">
        <span className="request-card__icon"><Sparkles size={15} /></span>
        <div>
          <strong>Kovar request</strong>
          <p>Review before quota can be used.</p>
        </div>
        <button aria-label="Cancel Kovar request" className="icon-button" onClick={onCancel} type="button">
          <X size={16} />
        </button>
      </div>
      {!request.model ? (
        <div className="model-choice">
          <span>Choose a Kovar model for this request</span>
          <div className="model-choice__list">
            {request.availableModels.map((model) => (
              <button disabled={isPending} key={model} onClick={() => onChooseModel(model)} type="button">
                {model}<ArrowRight size={13} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="request-facts">
            <div><span>Model</span><strong>{request.model}</strong></div>
            <div>
              <span>Estimated cost</span>
              <strong>
                <Coins size={14} />
                {request.estimatedQuota === undefined
                  ? 'Unavailable'
                  : `≈ ${request.estimatedQuota.toLocaleString()} quota`}
              </strong>
            </div>
          </div>
          {request.estimatedQuota === undefined ? (
            <p className="request-note">
              Gateway has no preflight endpoint and the current price cannot be safely derived. No cost is guessed.
            </p>
          ) : null}
          <button className="primary-button full-width" disabled={isPending} onClick={onConfirm} type="button">
            {isPending ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
            Send with Kovar
          </button>
        </>
      )}
    </section>
  )
}
