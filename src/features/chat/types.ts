export type MessageSource = 'deepseek' | 'kovar' | 'tool'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  source?: MessageSource
  model?: string
  isStreaming?: boolean
}

export type PendingKovarRequest = {
  prompt: string
  model?: string
  availableModels: string[]
  estimatedQuota?: bigint
  pricingChecked: boolean
}

export type PendingWalletTransaction = {
  action: 'transfer' | 'approve' | 'contractWrite'
  asset: 'ETH' | 'AXUSD' | 'Contract'
  amount: string
  to: `0x${string}`
  calldata?: `0x${string}`
  unlimited?: boolean
}
