'use client'

import { ArrowUpRight, Check, ExternalLink, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import type { Hash } from 'viem'

import type { PendingWalletTransaction } from '@/features/chat/types'
import { transactionUrl } from '@/lib/web3/explorer'

type Props = {
  transaction: PendingWalletTransaction
  hash?: Hash
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function TransactionPreview({ transaction, hash, isPending, onCancel, onConfirm }: Props) {
  return (
    <section className="request-card transaction-card" aria-label="Transaction preview">
      <div className="request-card__header">
        <span className="request-card__icon"><ShieldCheck size={15} /></span>
        <div><strong>Transaction preview</strong><p>Review every field before signing.</p></div>
        {!hash ? (
          <button aria-label="Cancel transaction" className="icon-button" onClick={onCancel} type="button">
            <X size={16} />
          </button>
        ) : null}
      </div>
      <div className="transaction-grid">
        <span>Network</span><strong>Ethereum Sepolia</strong>
        <span>Action</span><strong>{transaction.action}</strong>
        <span>Asset</span><strong>{transaction.asset}</strong>
        <span>Amount</span><strong>{transaction.unlimited ? 'Unlimited' : transaction.amount}</strong>
        <span>{transaction.action === 'approve' ? 'Spender' : 'To'}</span>
        <code>{transaction.to}</code>
      </div>
      {hash ? (
        <a className="transaction-link" href={transactionUrl(hash)} rel="noreferrer" target="_blank">
          <Check size={15} /> Confirmed on Sepolia <ExternalLink size={13} />
        </a>
      ) : (
        <button className="primary-button full-width" disabled={isPending} onClick={onConfirm} type="button">
          {isPending ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />}
          {isPending ? 'Waiting for confirmation…' : 'Confirm in wallet'}
        </button>
      )}
    </section>
  )
}
