import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AgentSidebar } from '@/features/chat/components/agent-sidebar'

describe('Agent sidebar', () => {
  it('does not report an unchecked wallet as unregistered or disconnected', () => {
    render(
      <AgentSidebar
        agentState="unknown"
        isAgentPending={false}
        isConnected
        kovarState="unknown"
        onAgentAction={vi.fn()}
        onLogin={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Not checked')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Check agent status' })).toBeEnabled()
    expect(screen.queryByText('Not registered')).not.toBeInTheDocument()
    expect(screen.queryByText('Not connected')).not.toBeInTheDocument()
  })

  it('shows restored Kovar and account state', () => {
    render(
      <AgentSidebar
        agentState="approved"
        availableQuota={1200}
        isAgentPending={false}
        isConnected
        kovarState="ready"
        onAgentAction={vi.fn()}
        onLogin={vi.fn()}
      />,
    )

    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('1,200')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh status' })).toBeEnabled()
  })
})
