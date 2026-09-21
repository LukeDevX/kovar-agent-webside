import { describe, expect, it } from 'vitest'

import { normalizeAgentState } from '@/features/agent/agent-state'

describe('Agent state', () => {
  it.each([
    [{ agent_status: 'REGISTERED', whitelist_status: 'PENDING' }, 'pending'],
    [{ agent_status: 'ACTIVE', whitelist_status: 'APPROVED' }, 'approved'],
    [{ agent_status: 'SUSPENDED', whitelist_status: 'APPROVED' }, 'suspended'],
    [{ agent_status: 'REVOKED', whitelist_status: 'REVOKED' }, 'revoked'],
  ] as const)('normalizes %o as %s', (agent, state) => {
    expect(normalizeAgentState(agent)).toBe(state)
  })
})
