'use client'

import { CheckCircle2, CircleDashed, Coins, KeyRound, RefreshCw, Shield, WalletCards } from 'lucide-react'

import type { KovarConnectionState } from '@/features/agent/agent-session'

export type AgentState = 'unknown' | 'unregistered' | 'pending' | 'approved' | 'suspended' | 'revoked'

type Props = {
  isConnected: boolean
  address?: string
  agentState: AgentState
  isAgentPending: boolean
  availableQuota?: number
  kovarState: KovarConnectionState
  onAgentAction: () => void
  onLogin: () => void
}

function agentLabel(state: AgentState): string {
  const labels: Record<AgentState, string> = {
    unknown: 'Not checked',
    unregistered: 'Not registered',
    pending: 'Awaiting approval',
    approved: 'Approved',
    suspended: 'Suspended',
    revoked: 'Revoked',
  }
  return labels[state]
}

function agentActionLabel(state: AgentState): string {
  if (state === 'unknown') return 'Check agent status'
  if (state === 'unregistered') return 'Register agent'
  return 'Refresh status'
}

function kovarLabel(state: KovarConnectionState): string {
  if (state === 'unknown') return 'Not checked'
  return state === 'ready' ? 'Ready' : 'Not connected'
}

export function AgentSidebar(props: Props) {
  return (
    <aside className="side-panel">
      <section className="status-section">
        <div className="section-eyebrow">Agent status</div>
        <div className="status-list">
          <div className="status-row">
            <span className="status-icon"><WalletCards size={16} /></span>
            <div><span>Wallet</span><strong>{props.isConnected ? 'Connected' : 'Disconnected'}</strong></div>
            <span className={`status-light ${props.isConnected ? 'is-on' : ''}`} />
          </div>
          <div className="status-row">
            <span className="status-icon"><Shield size={16} /></span>
            <div><span>Agent</span><strong>{agentLabel(props.agentState)}</strong></div>
            {props.agentState === 'approved' ? <CheckCircle2 className="status-check" size={16} /> : <CircleDashed size={16} />}
          </div>
          <div className="status-row">
            <span className="status-icon"><KeyRound size={16} /></span>
            <div><span>Kovar</span><strong>{kovarLabel(props.kovarState)}</strong></div>
            <span className={`status-light ${props.kovarState === 'ready' ? 'is-on' : ''}`} />
          </div>
          <div className="status-row">
            <span className="status-icon"><Coins size={16} /></span>
            <div><span>Available quota</span><strong>{props.availableQuota?.toLocaleString() ?? '—'}</strong></div>
          </div>
        </div>
        {props.isConnected ? (
          <button className="secondary-button full-width" disabled={props.isAgentPending} onClick={props.onAgentAction} type="button">
            <RefreshCw className={props.isAgentPending ? 'spin' : ''} size={14} />
            {agentActionLabel(props.agentState)}
          </button>
        ) : null}
        {props.agentState === 'approved' && props.kovarState === 'not_connected' ? (
          <button className="text-button" onClick={props.onLogin} type="button">Connect Kovar account</button>
        ) : null}
      </section>

      <section className="how-section">
        <div className="section-eyebrow">How it works</div>
        <ol className="steps-list">
          <li><span>1</span><p><strong>Connect wallet</strong>Your address becomes the Agent identity.</p></li>
          <li><span>2</span><p><strong>Chat normally</strong>Everyday chat uses DeepSeek.</p></li>
          <li><span>3</span><p><strong>Use tools</strong>Ask for quota, usage or balances.</p></li>
          <li><span>4</span><p><strong>Say “Use Kovar…”</strong>Explicitly request a Kovar model.</p></li>
          <li><span>5</span><p><strong>Review first</strong>Confirm the request before quota is used.</p></li>
        </ol>
      </section>

      {props.address ? <div className="identity-note">Agent ID · {props.address.slice(0, 8)}…{props.address.slice(-6)}</div> : null}
    </aside>
  )
}
