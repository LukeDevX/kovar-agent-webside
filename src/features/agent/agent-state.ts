export type GatewayAgent = {
  agent_status: string
  whitelist_status: string
}

export type NormalizedAgentState = 'pending' | 'approved' | 'suspended' | 'revoked'

export function normalizeAgentState(agent: GatewayAgent): NormalizedAgentState {
  if (agent.agent_status === 'REVOKED' || agent.whitelist_status === 'REVOKED') return 'revoked'
  if (agent.agent_status === 'SUSPENDED') return 'suspended'
  if (agent.agent_status === 'ACTIVE' && agent.whitelist_status === 'APPROVED') return 'approved'
  return 'pending'
}
