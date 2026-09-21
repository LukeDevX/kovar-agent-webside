'use client'

import {
  ArrowUp,
  Bot,
  CircleDollarSign,
  Database,
  LoaderCircle,
  Menu,
  PanelRightClose,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  maxUint256,
  parseEther,
  parseUnits,
  type Hash,
  type Hex,
} from 'viem'
import { useAccount, usePublicClient, useSignMessage, useWalletClient } from 'wagmi'

import { appConfig } from '@/config/app'
import { erc20Abi } from '@/contracts/abi/erc20'
import { normalizeAgentState } from '@/features/agent/agent-state'
import { AgentSidebar, type AgentState } from '@/features/chat/components/agent-sidebar'
import { KovarRequestCard } from '@/features/chat/components/kovar-request-card'
import { MessageList } from '@/features/chat/components/message-list'
import { TransactionPreview } from '@/features/chat/components/transaction-preview'
import type {
  ChatMessage,
  PendingKovarRequest,
  PendingWalletTransaction,
} from '@/features/chat/types'
import { KovarLoginDialog } from '@/features/kovar/components/kovar-login-dialog'
import { ConnectWalletButton } from '@/features/wallet/components/connect-wallet-button'
import { WrongNetworkBanner } from '@/features/wallet/components/wrong-network-banner'
import {
  isGatewayError,
  KovarGatewayClient,
  publicGatewayRequest,
} from '@/lib/gateway/client'
import { friendlyGatewayError, GatewayError, toGatewayError } from '@/lib/gateway/errors'
import {
  buildRegistrationMessage,
  createIdempotencyKey,
} from '@/lib/gateway/signing'
import { ethereumSepolia } from '@/lib/web3/chains'
import { transactionUrl } from '@/lib/web3/explorer'
import { AgentController, type AgentDecision } from '@/services/agent-controller.service'
import { KovarCostEstimator } from '@/services/kovar-cost-estimator'

type AgentResponse = {
  agent_id: string
  agent_status: string
  whitelist_status: string
}

type ChallengeResponse = {
  address: string
  nonce: string
  expires_at: string
}

type AccountResponse = {
  quota: number
  used_quota: number
  available_quota: number
  request_count: number
}

type ModelsResponse = { data: Array<{ id: string }> }
type LoginResponse = { authentication_complete?: boolean; continuation_required?: boolean }
type TokenResponse = { key_bound?: boolean; status?: string; remain_quota?: number }
type TaskResponse = {
  task_id: string
  status: string
  model: string
  result_payload?: unknown
  error_message?: string
}

const controller = new AgentController()
const costEstimator = new KovarCostEstimator()
const QUICK_ACTIONS = [
  { icon: CircleDollarSign, label: 'Check Kovar quota', prompt: '查看我的 Kovar 额度' },
  { icon: Sparkles, label: 'Kovar models', prompt: '查看 Kovar 可用模型' },
  { icon: WalletCards, label: 'AXUSD balance', prompt: '查看我的 AXUSD 余额' },
  { icon: Database, label: 'Recent Kovar usage', prompt: '查看最近 Kovar 使用量' },
] as const

function messageId(): string {
  return crypto.randomUUID()
}

function compactAmount(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.')
  const trimmed = fraction.slice(0, 6).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function modelIds(response: ModelsResponse): string[] {
  return response.data.map((model) => model.id).filter(Boolean)
}

function contentFromTaskResult(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined
  const choices = (result as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return undefined
  const first = choices[0]
  if (!first || typeof first !== 'object') return undefined
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== 'object') return undefined
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : undefined
}

function safeSummary(value: unknown): string {
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > 1800 ? `${text.slice(0, 1800)}\n…` : text
  } catch {
    return 'Result received.'
  }
}

function restoreMessages(address: string): ChatMessage[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`kovar-chat:${address}`) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is ChatMessage =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as ChatMessage).id === 'string' &&
          ((item as ChatMessage).role === 'user' || (item as ChatMessage).role === 'assistant') &&
          typeof (item as ChatMessage).content === 'string',
      )
      .slice(-60)
  } catch {
    return []
  }
}

export function AgentWorkspace() {
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const publicClient = usePublicClient({ chainId: ethereumSepolia.id })
  const { data: walletClient } = useWalletClient({ chainId: ethereumSepolia.id })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [agentState, setAgentState] = useState<AgentState>('unknown')
  const [isAgentPending, setIsAgentPending] = useState(false)
  const [isKovarReady, setIsKovarReady] = useState(false)
  const [account, setAccount] = useState<AccountResponse>()
  const [pendingKovar, setPendingKovar] = useState<PendingKovarRequest>()
  const [pendingTransaction, setPendingTransaction] = useState<PendingWalletTransaction>()
  const [lastTransactionHash, setLastTransactionHash] = useState<Hash>()
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState<string>()
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const gateway = useMemo(() => {
    if (!address) return undefined
    return new KovarGatewayClient(address, (message) => signMessageAsync({ message }))
  }, [address, signMessageAsync])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPendingKovar(undefined)
      setPendingTransaction(undefined)
      setLastTransactionHash(undefined)
      setAccount(undefined)
      setLoginOpen(false)
      setNeedsTwoFactor(false)
      if (!address) {
        setMessages([])
        setAgentState('unknown')
        setIsKovarReady(false)
        return
      }
      const agent = localStorage.getItem(`kovar-agent:${address.toLowerCase()}`)
      const kovar = localStorage.getItem(`kovar-ready:${address.toLowerCase()}`)
      setAgentState(agent === 'approved' ? 'approved' : agent === 'pending' ? 'pending' : 'unregistered')
      setIsKovarReady(kovar === 'true')
      setMessages(restoreMessages(address.toLowerCase()))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [address])

  const commitMessages = useCallback(
    (update: (previous: ChatMessage[]) => ChatMessage[]) => {
      setMessages((previous) => {
        const next = update(previous).slice(-60)
        if (address) localStorage.setItem(`kovar-chat:${address.toLowerCase()}`, JSON.stringify(next))
        return next
      })
    },
    [address],
  )

  const addAssistant = useCallback(
    (content: string, source: ChatMessage['source'] = 'tool', model?: string) => {
      commitMessages((previous) => [
        ...previous,
        { id: messageId(), role: 'assistant', content, source, ...(model ? { model } : {}) },
      ])
    },
    [commitMessages],
  )

  const updateMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      commitMessages((previous) =>
        previous.map((message) => (message.id === id ? { ...message, ...patch } : message)),
      )
    },
    [commitMessages],
  )

  function rememberAgent(state: AgentState) {
    setAgentState(state)
    if (address && (state === 'approved' || state === 'pending')) {
      localStorage.setItem(`kovar-agent:${address.toLowerCase()}`, state)
    }
  }

  function rememberKovar(ready: boolean) {
    setIsKovarReady(ready)
    if (address) localStorage.setItem(`kovar-ready:${address.toLowerCase()}`, String(ready))
  }

  async function refreshOrRegisterAgent() {
    if (!gateway || !address) return
    setIsAgentPending(true)
    try {
      const agent = await gateway.request<AgentResponse>('/api/v1/agents/me')
      rememberAgent(normalizeAgentState(agent))
    } catch (error) {
      if (isGatewayError(error, 'AGENT_NOT_FOUND')) {
        try {
          const challenge = await publicGatewayRequest<ChallengeResponse>(
            '/api/v1/agents/challenge',
            { address: address.toLowerCase() },
          )
          const timestamp = Math.floor(Date.now() / 1000)
          const signature = await signMessageAsync({
            message: buildRegistrationMessage(challenge.address, challenge.nonce, timestamp),
          })
          const agent = await publicGatewayRequest<AgentResponse>(
            '/api/v1/agents/register',
            { address: challenge.address, nonce: challenge.nonce, timestamp, signature },
            createIdempotencyKey(),
          )
          rememberAgent(normalizeAgentState(agent))
          addAssistant(
            agent.whitelist_status === 'APPROVED'
              ? 'Agent is approved and ready.'
              : 'Agent registration submitted. Waiting for administrator approval.',
          )
        } catch (registerError) {
          addAssistant(friendlyGatewayError(registerError))
        }
      } else if (isGatewayError(error, 'AGENT_NOT_WHITELISTED')) {
        rememberAgent('pending')
      } else if (isGatewayError(error, 'AGENT_SUSPENDED')) {
        rememberAgent('suspended')
      } else if (isGatewayError(error, 'AGENT_REVOKED')) {
        rememberAgent('revoked')
      } else {
        addAssistant(friendlyGatewayError(error))
      }
    } finally {
      setIsAgentPending(false)
    }
  }

  async function ensureAgentToken(client = gateway) {
    if (!client) return
    try {
      const token = await client.request<TokenResponse>('/api/v1/agent/token')
      if (token.key_bound) {
        rememberKovar(true)
        return
      }
    } catch (error) {
      if (!(error instanceof GatewayError) || !['KOVAR_TOKEN_NOT_BOUND', 'NOT_FOUND'].includes(error.code)) {
        throw error
      }
    }
    await client.request<TokenResponse>('/api/v1/agent/token', {
      method: 'POST',
      body: {},
      idempotent: true,
    })
    rememberKovar(true)
  }

  async function login(username: string, password: string) {
    if (!gateway) return
    setLoginPending(true)
    setLoginError(undefined)
    try {
      const result = await gateway.request<LoginResponse>('/api/v1/kovar/auth/login', {
        method: 'POST',
        body: { username, password },
        idempotent: true,
      })
      if (result.continuation_required) {
        setNeedsTwoFactor(true)
        return
      }
      await ensureAgentToken(gateway)
      setLoginOpen(false)
      addAssistant('Kovar account connected. The Agent Key is ready.')
    } catch (error) {
      setLoginError(friendlyGatewayError(error))
    } finally {
      setLoginPending(false)
    }
  }

  async function submitTwoFactor(code: string) {
    if (!gateway) return
    setLoginPending(true)
    setLoginError(undefined)
    try {
      await gateway.request('/api/v1/kovar/auth/login/2fa', {
        method: 'POST',
        body: { code },
        idempotent: true,
      })
      await ensureAgentToken(gateway)
      setNeedsTwoFactor(false)
      setLoginOpen(false)
      addAssistant('Kovar account connected. The Agent Key is ready.')
    } catch (error) {
      setLoginError(friendlyGatewayError(error))
    } finally {
      setLoginPending(false)
    }
  }

  async function normalChat(userContent: string, history: ChatMessage[]) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: address,
        messages: [
          ...history.slice(-18).map(({ role, content }) => ({ role, content })),
          { role: 'user', content: userContent },
        ],
      }),
    })
    const payload: unknown = await response.json()
    if (!response.ok || !payload || typeof payload !== 'object' || !('content' in payload)) {
      throw new Error('DeepSeek is unavailable right now.')
    }
    addAssistant(String((payload as { content: unknown }).content), 'deepseek')
  }

  async function prepareKovarRequest(decision: Extract<AgentDecision, { type: 'kovar_model' }>) {
    if (!gateway) return
    if (agentState !== 'approved') {
      addAssistant('Register the Agent and wait for approval before using a Kovar model.')
      return
    }
    try {
      const response = await gateway.request<ModelsResponse>('/api/v1/models')
      const models = modelIds(response)
      if (decision.model && !models.includes(decision.model)) {
        addAssistant(
          `Kovar 当前不可用该模型：${decision.model}\n\n可用模型：\n${models.slice(0, 12).map((model) => `• ${model}`).join('\n')}`,
        )
        return
      }
      if (!decision.model) {
        setPendingKovar({
          prompt: decision.prompt,
          availableModels: models,
          pricingChecked: false,
        })
        return
      }
      await priceKovarRequest(decision.prompt, decision.model, models)
    } catch (error) {
      if (isGatewayError(error, 'KOVAR_USER_NOT_BOUND')) {
        rememberKovar(false)
        setLoginOpen(true)
      }
      addAssistant(friendlyGatewayError(error))
    }
  }

  async function priceKovarRequest(prompt: string, model: string, availableModels: string[]) {
    if (!gateway) return
    setIsBusy(true)
    try {
      const pricing = await gateway.request<unknown>('/api/v1/pricing')
      const estimate = costEstimator.estimateChat({ model, prompt, pricing })
      setPendingKovar({
        prompt,
        model,
        availableModels,
        ...(estimate === undefined ? {} : { estimatedQuota: estimate }),
        pricingChecked: true,
      })
    } catch (error) {
      addAssistant(friendlyGatewayError(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function readKovarStream(response: Response, messageIdToUpdate: string): Promise<void> {
    if (!response.body) throw new Error('Kovar stream is unavailable')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let doneEvent = false
    for (;;) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          doneEvent = true
          continue
        }
        if (!data) continue
        const event: unknown = JSON.parse(data)
        if (event && typeof event === 'object' && 'code' in event && 'message' in event) {
          throw new Error(String((event as { message: unknown }).message))
        }
        const choices = event && typeof event === 'object' ? (event as { choices?: unknown }).choices : undefined
        if (!Array.isArray(choices)) continue
        const first = choices[0]
        if (!first || typeof first !== 'object') continue
        const delta = (first as { delta?: unknown }).delta
        const message = (first as { message?: unknown }).message
        const chunk =
          delta && typeof delta === 'object' && typeof (delta as { content?: unknown }).content === 'string'
            ? String((delta as { content: string }).content)
            : message && typeof message === 'object' && typeof (message as { content?: unknown }).content === 'string'
              ? String((message as { content: string }).content)
              : ''
        if (chunk) {
          content += chunk
          updateMessage(messageIdToUpdate, { content })
        }
      }
      if (done) break
    }
    if (!doneEvent) throw new Error('Kovar stream ended before completion')
    updateMessage(messageIdToUpdate, {
      content: content || 'Kovar completed the request.',
      isStreaming: false,
    })
  }

  async function recoverTask(taskId: string, assistantId: string) {
    if (!gateway) return
    try {
      const task = await gateway.request<TaskResponse>(`/api/v1/tasks/${taskId}`)
      const content = contentFromTaskResult(task.result_payload)
      updateMessage(assistantId, {
        content:
          content ??
          (task.status === 'FAILED'
            ? `Kovar task failed: ${task.error_message ?? 'Unknown model error'}`
            : `Kovar task ${task.task_id} is ${task.status}.`),
        isStreaming: false,
      })
    } catch {
      updateMessage(assistantId, {
        content: `The stream was interrupted. Existing task: ${taskId}. Use “recent Kovar tasks” to check it; the paid request was not replayed.`,
        isStreaming: false,
      })
    }
  }

  async function confirmKovarRequest() {
    if (!gateway || !pendingKovar || !pendingKovar.pricingChecked) return
    const model = pendingKovar.model
    if (!model) return
    const request = pendingKovar
    const assistantId = messageId()
    setIsBusy(true)
    setPendingKovar(undefined)
    commitMessages((previous) => [
      ...previous,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        source: 'kovar',
        model,
        isStreaming: true,
      },
    ])
    let taskId: string | null = null
    try {
      const response = await gateway.signedFetch('/api/v1/tasks', {
        method: 'POST',
        idempotent: true,
        body: {
          task_type: 'chat',
          model,
          payload: {
            messages: [{ role: 'user', content: request.prompt }],
            max_completion_tokens: 512,
            stream: true,
          },
        },
      })
      taskId = response.headers.get('X-Task-Id')
      if (!response.ok) throw await toGatewayError(response)
      await readKovarStream(response, assistantId)
    } catch (error) {
      if (taskId) await recoverTask(taskId, assistantId)
      else updateMessage(assistantId, { content: friendlyGatewayError(error), isStreaming: false })
    } finally {
      setIsBusy(false)
    }
  }

  async function executeKovarTool(decision: Extract<AgentDecision, { type: 'kovar_tool' }>) {
    if (!gateway) return
    const routes: Record<typeof decision.tool, string> = {
      'account.get': '/api/v1/account',
      'models.list': '/api/v1/models',
      'pricing.get': '/api/v1/pricing',
      'usage.list': '/api/v1/usage?page=1&page_size=5',
      'logs.list': '/api/v1/logs?page=1&page_size=5',
      'logs.stats': '/api/v1/logs/stat?page=1&page_size=20',
      'topup.info': '/api/v1/account/topup/info?page=1&page_size=20',
      'topup.chains': '/api/v1/account/topup/axone/chains',
      'topup.create': '/api/v1/account/topup',
      'topup.status': '/api/v1/account/topup/status',
      'tasks.list': '/api/v1/tasks?page=1&page_size=5',
    }
    try {
      let result: unknown
      if (decision.tool === 'topup.create') {
        const amountText = asString(decision.args.amount)
        const currency = asString(decision.args.currency)
        const chain = asString(decision.args.chainId)
        const paymentWallet = asString(decision.args.paymentWallet)
        if (!amountText || !/^\d+$/.test(amountText) || !currency || !chain || !paymentWallet || !isAddress(paymentWallet)) {
          addAssistant('创建 Axone 充值订单需要正整数 amount、currency、chain_id 和 payment wallet address。')
          return
        }
        result = await gateway.request<unknown>('/api/v1/account/topup', {
          method: 'POST',
          idempotent: true,
          body: {
            provider: 'axone',
            payload: {
              amount: Number.parseInt(amountText, 10),
              currency,
              chain_id: chain,
              payment_wallet_address: getAddress(paymentWallet),
            },
          },
        })
        const order = result as { status?: unknown; trade_no?: unknown; address?: unknown }
        addAssistant(
          `充值订单已创建。\nStatus: ${typeof order.status === 'string' ? order.status : 'Pending'}\nTrade no: ${typeof order.trade_no === 'string' ? order.trade_no : '—'}\nPayment address: ${typeof order.address === 'string' ? order.address : '—'}\n\n订单创建不代表支付成功。`,
        )
        return
      }
      if (decision.tool === 'topup.status') {
        const tradeNumber = asString(decision.args.tradeNumber)
        if (!tradeNumber) {
          addAssistant('请提供要查询的充值订单 trade number。')
          return
        }
        result = await gateway.request<unknown>(
          `/api/v1/account/topup/status?trade_no=${encodeURIComponent(tradeNumber)}`,
        )
      } else {
        result = await gateway.request<unknown>(routes[decision.tool])
      }
      rememberKovar(true)
      if (decision.tool === 'account.get') {
        const value = result as AccountResponse
        setAccount(value)
        addAssistant(
          `可用：${value.available_quota.toLocaleString()} quota\n已使用：${value.used_quota.toLocaleString()} quota\n请求数：${value.request_count.toLocaleString()}`,
        )
      } else if (decision.tool === 'models.list') {
        const ids = modelIds(result as ModelsResponse)
        addAssistant(`Kovar 可用模型：\n${ids.map((model) => `• ${model}`).join('\n')}`)
      } else {
        addAssistant(safeSummary(result))
      }
    } catch (error) {
      if (isGatewayError(error, 'KOVAR_USER_NOT_BOUND')) {
        rememberKovar(false)
        setLoginOpen(true)
      }
      addAssistant(friendlyGatewayError(error))
    }
  }

  async function executeWalletRead(tool: 'wallet.getNativeBalance' | 'wallet.getTokenBalance') {
    if (!publicClient || !address) throw new Error('Sepolia RPC is unavailable.')
    if (tool === 'wallet.getNativeBalance') {
      const balance = await publicClient.getBalance({ address })
      addAssistant(`ETH：${compactAmount(formatEther(balance))}`)
      return
    }
    const [symbol, decimals, balance] = await Promise.all([
      publicClient.readContract({ address: appConfig.axusdAddress, abi: erc20Abi, functionName: 'symbol' }),
      publicClient.readContract({ address: appConfig.axusdAddress, abi: erc20Abi, functionName: 'decimals' }),
      publicClient.readContract({
        address: appConfig.axusdAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
    ])
    addAssistant(`${symbol}：${compactAmount(formatUnits(balance, decimals))}`)
  }

  function prepareWalletTransaction(decision: Extract<AgentDecision, { type: 'wallet_tool' }>) {
    const args = decision.args
    if (decision.tool === 'wallet.transfer') {
      const asset = args.asset === 'AXUSD' ? 'AXUSD' : 'ETH'
      const to = asString(args.to)
      const amount = asString(args.amount)
      if (!to || !isAddress(to) || !amount) {
        addAssistant('转账需要明确的资产、金额和有效收款地址。')
        return
      }
      setPendingTransaction({ action: 'transfer', asset, amount, to: getAddress(to) })
      return
    }
    if (decision.tool === 'wallet.approve') {
      const spender = asString(args.spender)
      const unlimited = args.unlimited === true
      const amount = asString(args.amount)
      if (!spender || !isAddress(spender) || (!unlimited && !amount)) {
        addAssistant('授权需要明确的 spender 地址和金额；无限授权必须明确说 unlimited、max 或“无限授权”。')
        return
      }
      setPendingTransaction({
        action: 'approve',
        asset: 'AXUSD',
        amount: amount ?? '0',
        to: getAddress(spender),
        ...(unlimited ? { unlimited: true } : {}),
      })
      return
    }
    if (decision.tool === 'wallet.contractWrite') {
      const to = asString(args.to)
      const calldata = asString(args.calldata)
      if (!to || !isAddress(to) || !calldata || !/^0x[a-fA-F0-9]+$/.test(calldata)) {
        addAssistant('合约写入需要明确的合约地址和有效 calldata。')
        return
      }
      setPendingTransaction({
        action: 'contractWrite',
        asset: 'Contract',
        amount: asString(args.amount) ?? '0',
        to: getAddress(to),
        calldata: calldata as Hex,
      })
    }
  }

  async function executeWalletTool(decision: Extract<AgentDecision, { type: 'wallet_tool' }>) {
    if (decision.tool === 'wallet.getNativeBalance' || decision.tool === 'wallet.getTokenBalance') {
      await executeWalletRead(decision.tool)
      return
    }
    prepareWalletTransaction(decision)
  }

  async function confirmTransaction() {
    if (!pendingTransaction || !walletClient || !publicClient || !address) return
    if (chainId !== ethereumSepolia.id) {
      addAssistant('请先切换到 Ethereum Sepolia。')
      return
    }
    setIsBusy(true)
    setLastTransactionHash(undefined)
    try {
      let hash: Hash
      if (pendingTransaction.action === 'transfer' && pendingTransaction.asset === 'ETH') {
        hash = await walletClient.sendTransaction({
          account: address,
          chain: ethereumSepolia,
          to: pendingTransaction.to,
          value: parseEther(pendingTransaction.amount),
        })
      } else if (pendingTransaction.action === 'transfer') {
        const decimals = await publicClient.readContract({
          address: appConfig.axusdAddress,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        hash = await walletClient.writeContract({
          account: address,
          chain: ethereumSepolia,
          address: appConfig.axusdAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [pendingTransaction.to, parseUnits(pendingTransaction.amount, decimals)],
        })
      } else if (pendingTransaction.action === 'approve') {
        const decimals = await publicClient.readContract({
          address: appConfig.axusdAddress,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        const amount = pendingTransaction.unlimited
          ? maxUint256
          : parseUnits(pendingTransaction.amount, decimals)
        hash = await walletClient.writeContract({
          account: address,
          chain: ethereumSepolia,
          address: appConfig.axusdAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [pendingTransaction.to, amount],
        })
      } else {
        hash = await walletClient.sendTransaction({
          account: address,
          chain: ethereumSepolia,
          to: pendingTransaction.to,
          data: pendingTransaction.calldata,
          value: parseEther(pendingTransaction.amount),
        })
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted')
      setLastTransactionHash(hash)
      addAssistant(`交易已确认：${transactionUrl(hash)}`)
    } catch (error) {
      const message = error instanceof Error && /reject|denied|cancel/i.test(error.message)
        ? 'Transaction cancelled.'
        : error instanceof Error
          ? error.message
          : 'Transaction failed.'
      addAssistant(message)
    } finally {
      setIsBusy(false)
    }
  }

  async function routeMessage(content: string, history: ChatMessage[]) {
    const decision = controller.decide(content)
    switch (decision.type) {
      case 'normal_chat':
        await normalChat(content, history)
        break
      case 'kovar_model':
        await prepareKovarRequest(decision)
        break
      case 'kovar_tool':
        await executeKovarTool(decision)
        break
      case 'wallet_tool':
        await executeWalletTool(decision)
        break
      case 'request_kovar_login':
        setLoginOpen(true)
        break
    }
  }

  async function send(contentOverride?: string) {
    const content = (contentOverride ?? input).trim()
    if (!content || !address || isBusy || chainId !== ethereumSepolia.id) return
    const history = messages
    setInput('')
    commitMessages((previous) => [...previous, { id: messageId(), role: 'user', content }])
    setIsBusy(true)
    try {
      await routeMessage(content, history)
    } catch (error) {
      addAssistant(error instanceof Error ? error.message : 'Request failed.')
    } finally {
      setIsBusy(false)
      textareaRef.current?.focus()
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void send()
  }

  const canChat = Boolean(address && chainId === ethereumSepolia.id)
  const isEmpty = messages.length === 0

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Bot size={19} /></span>
          <span>Kovar Agent</span>
          <span className="demo-pill">Sepolia demo</span>
        </div>
        <div className="topbar-actions">
          <ConnectWalletButton />
          <button
            aria-label="Toggle agent details"
            className="mobile-panel-button"
            onClick={() => setSidePanelOpen((open) => !open)}
            type="button"
          >
            {sidePanelOpen ? <PanelRightClose size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>
      <WrongNetworkBanner />

      <div className="workspace">
        <section className="chat-panel">
          <div className="chat-surface">
            {isEmpty ? (
              <div className="empty-state">
                <div className="empty-orbit"><span><Sparkles size={23} /></span></div>
                <p className="empty-kicker">DeepSeek by default · Kovar on request</p>
                <h1>What can I help you with?</h1>
                <p>Connect your wallet, then chat normally or ask the Agent to work with Kovar and Sepolia.</p>
                <div className="quick-grid">
                  {QUICK_ACTIONS.map((action) => (
                    <button disabled={!canChat || isBusy} key={action.label} onClick={() => void send(action.prompt)} type="button">
                      <action.icon size={17} /><span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <MessageList messages={messages} />
            )}
          </div>

          <div className="composer-zone">
            {pendingKovar ? (
              <KovarRequestCard
                isPending={isBusy}
                onCancel={() => setPendingKovar(undefined)}
                onChooseModel={(model) => void priceKovarRequest(pendingKovar.prompt, model, pendingKovar.availableModels)}
                onConfirm={() => void confirmKovarRequest()}
                request={pendingKovar}
              />
            ) : null}
            {pendingTransaction ? (
              <TransactionPreview
                {...(lastTransactionHash ? { hash: lastTransactionHash } : {})}
                isPending={isBusy}
                onCancel={() => setPendingTransaction(undefined)}
                onConfirm={() => void confirmTransaction()}
                transaction={pendingTransaction}
              />
            ) : null}
            <form className="composer" onSubmit={submit}>
              <textarea
                aria-label="Message Kovar Agent"
                disabled={!canChat || isBusy}
                maxLength={32_000}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (input.trim()) void send()
                  }
                }}
                placeholder={isConnected ? (canChat ? 'Ask anything…' : 'Switch to Sepolia to continue') : 'Connect wallet to start'}
                ref={textareaRef}
                rows={1}
                value={input}
              />
              <button aria-label="Send message" disabled={!canChat || !input.trim() || isBusy} type="submit">
                {isBusy ? <LoaderCircle className="spin" size={18} /> : <ArrowUp size={18} />}
              </button>
            </form>
            <p className="composer-hint">Default chat uses DeepSeek. Say “Use Kovar…” to call a Kovar model.</p>
          </div>
        </section>

        <div className={sidePanelOpen ? 'sidebar-wrap is-open' : 'sidebar-wrap'}>
          <AgentSidebar
            {...(address ? { address } : {})}
            agentState={agentState}
            {...(account ? { availableQuota: account.available_quota } : {})}
            isAgentPending={isAgentPending}
            isConnected={isConnected}
            isKovarReady={isKovarReady}
            onAgentAction={() => void refreshOrRegisterAgent()}
            onLogin={() => setLoginOpen(true)}
          />
        </div>
      </div>

      <KovarLoginDialog
        {...(loginError ? { error: loginError } : {})}
        isPending={loginPending}
        needsTwoFactor={needsTwoFactor}
        onLogin={login}
        onOpenChange={(open) => {
          setLoginOpen(open)
          if (!open) {
            setLoginError(undefined)
            setNeedsTwoFactor(false)
          }
        }}
        onTwoFactor={submitTwoFactor}
        open={loginOpen}
      />
    </main>
  )
}
