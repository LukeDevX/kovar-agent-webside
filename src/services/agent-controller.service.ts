import { z } from 'zod'

const argsSchema = z.record(z.string(), z.unknown())

export const agentDecisionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('normal_chat') }),
  z.object({
    type: z.literal('kovar_tool'),
    tool: z.enum([
      'account.get',
      'models.list',
      'pricing.get',
      'usage.list',
      'logs.list',
      'logs.stats',
      'topup.info',
      'topup.chains',
      'topup.create',
      'topup.status',
      'tasks.list',
    ]),
    args: argsSchema,
  }),
  z.object({
    type: z.literal('kovar_model'),
    model: z.string().min(1).optional(),
    prompt: z.string().min(1),
  }),
  z.object({
    type: z.literal('wallet_tool'),
    tool: z.enum([
      'wallet.getNativeBalance',
      'wallet.getTokenBalance',
      'wallet.transfer',
      'wallet.approve',
      'wallet.contractWrite',
    ]),
    args: argsSchema,
  }),
  z.object({ type: z.literal('request_kovar_login') }),
])

export type AgentDecision = z.infer<typeof agentDecisionSchema>

const addressPattern = /0x[a-fA-F0-9]{40}/g
const amountPattern = /(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$|\s*(?:AXUSD|ETH))/i

function extractModel(input: string): string | undefined {
  const patterns = [
    /Kovar\s*(?:中|里的|的)\s*([A-Za-z0-9][A-Za-z0-9._:/-]*)(?=\s*(?:模型|帮|来|生成|分析|查询|查|$))/i,
    /Kovar(?:'s)?\s+model\s+([A-Za-z0-9][A-Za-z0-9._:/-]*)/i,
    /use\s+([A-Za-z0-9][A-Za-z0-9._:/-]*)\s+(?:model\s+)?(?:with|via|through)\s+Kovar/i,
  ]
  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match?.[1]) return match[1]
  }
  return undefined
}

function isExplicitKovarModelRequest(input: string): boolean {
  return (
    /(?:使用|用|通过|调用)\s*Kovar\b/i.test(input) ||
    /\b(?:use|using|via|call)\s+Kovar\b/i.test(input) ||
    /Kovar\s*(?:中|里的|的).{0,80}模型/i.test(input) ||
    /(?:with|via|through)\s+Kovar\b/i.test(input)
  )
}

function cleanKovarPrompt(input: string, model?: string): string {
  let prompt = input
    .replace(/(?:请)?(?:使用|用|通过|调用)\s*Kovar\s*(?:中|里的|的)?/gi, '')
    .replace(/\b(?:please\s+)?(?:use|using|call)\s+Kovar(?:'s)?(?:\s+model)?\b/gi, '')
  if (model) prompt = prompt.replace(model, '').replace(/^\s*(?:模型)?\s*/i, '')
  return prompt.replace(/^\s*(?:帮我|来|to)\s*/i, '').trim() || input.trim()
}

function extractTopupAmount(input: string): string | undefined {
  const match = input.match(/(?:充值|topup|amount)[^\d]{0,20}([\d,]+(?:\.\d+)?)\s*(万|千|[kw])?/i)
  if (!match?.[1]) return undefined

  const numeric = Number(match[1].replaceAll(',', ''))
  const unit = match[2]?.toLowerCase()
  const multiplier = unit === '万' || unit === 'w' ? 10_000 : unit === '千' || unit === 'k' ? 1_000 : 1
  const amount = numeric * multiplier
  return Number.isSafeInteger(amount) && amount > 0 ? String(amount) : undefined
}

function kovarTool(input: string): AgentDecision | undefined {
  if (!/Kovar/i.test(input)) return undefined
  if (/(?:登录|登入|log\s*in|login)/i.test(input)) return { type: 'request_kovar_login' }

  const tradeNumber = input.match(/(?:trade(?:_no)?|订单号|充值状态)[：:\s]+([A-Za-z0-9_-]+)/i)?.[1]
  const topupAmount = extractTopupAmount(input)
  const currency = input.match(/\b(USDC|USDT|USD|AXUSD)\b/i)?.[1]?.toUpperCase()
  const chainId = input.match(/(?:chain(?:_id)?|链)[：:\s]+([A-Za-z0-9_-]+)/i)?.[1]
  const paymentWallet = input.match(addressPattern)?.[0]
  if (/(?:创建|新建|create).{0,20}(?:充值|topup)|(?:充值|topup).{0,20}(?:订单|order)/i.test(input)) {
    return agentDecisionSchema.parse({
      type: 'kovar_tool',
      tool: 'topup.create',
      args: {
        ...(topupAmount ? { amount: topupAmount } : {}),
        ...(currency ? { currency } : {}),
        ...(chainId ? { chainId } : {}),
        ...(paymentWallet ? { paymentWallet } : {}),
      },
    })
  }
  if (/(?:充值状态|topup\s*status)/i.test(input)) {
    return agentDecisionSchema.parse({
      type: 'kovar_tool',
      tool: 'topup.status',
      args: { ...(tradeNumber ? { tradeNumber } : {}) },
    })
  }

  type KovarTool = Extract<AgentDecision, { type: 'kovar_tool' }>['tool']
  const definitions: Array<[RegExp, KovarTool]> = [
    [/(?:额度|余额|quota|account)/i, 'account.get'],
    [/(?:可用模型|模型列表|models?)/i, 'models.list'],
    [/(?:价格|费用表|pricing)/i, 'pricing.get'],
    [/(?:使用量|usage)/i, 'usage.list'],
    [/(?:调用记录|日志统计|log\s*stat)/i, 'logs.stats'],
    [/(?:日志|logs?)/i, 'logs.list'],
    [/(?:充值链|topup\s*chains?)/i, 'topup.chains'],
    [/(?:充值信息|充值|topup)/i, 'topup.info'],
    [/(?:任务|tasks?)/i, 'tasks.list'],
  ]
  for (const [pattern, tool] of definitions) {
    if (pattern.test(input)) {
      return agentDecisionSchema.parse({
        type: 'kovar_tool',
        tool,
        args: tool === 'topup.info' && topupAmount ? { amount: topupAmount } : {},
      })
    }
  }
  return undefined
}

function walletTool(input: string): AgentDecision | undefined {
  const addresses = input.match(addressPattern) ?? []
  const amount = input.match(amountPattern)?.[1]
  const isAxusd = /AXUSD/i.test(input)
  const isEth = /(?:^|\s)ETH(?:\s|$)/i.test(input)

  if (/(?:授权|approve)/i.test(input)) {
    return {
      type: 'wallet_tool',
      tool: 'wallet.approve',
      args: {
        ...(addresses[0] ? { spender: addresses[0] } : {}),
        ...(amount ? { amount } : {}),
        unlimited: /(?:无限|unlimited|max)/i.test(input),
      },
    }
  }
  if (/(?:合约调用|contract\s*write|calldata)/i.test(input)) {
    const calldata = input.match(/0x[a-fA-F0-9]{8,}/g)?.find((value) => value.length !== 42)
    return {
      type: 'wallet_tool',
      tool: 'wallet.contractWrite',
      args: {
        ...(addresses[0] ? { to: addresses[0] } : {}),
        ...(calldata ? { calldata } : {}),
        ...(amount ? { amount } : {}),
      },
    }
  }
  if (/(?:转账|发送|transfer|send)/i.test(input) && (isAxusd || isEth)) {
    return {
      type: 'wallet_tool',
      tool: 'wallet.transfer',
      args: {
        asset: isAxusd ? 'AXUSD' : 'ETH',
        ...(addresses[0] ? { to: addresses[0] } : {}),
        ...(amount ? { amount } : {}),
      },
    }
  }
  if (isAxusd && /(?:余额|持有|balance|查看|查询)/i.test(input)) {
    return { type: 'wallet_tool', tool: 'wallet.getTokenBalance', args: {} }
  }
  if (isEth && /(?:余额|持有|balance|查看|查询)/i.test(input)) {
    return { type: 'wallet_tool', tool: 'wallet.getNativeBalance', args: {} }
  }
  return undefined
}

export class AgentController {
  decide(rawInput: string): AgentDecision {
    const input = rawInput.trim()
    if (!input) throw new Error('Message is required')

    const tool = kovarTool(input)
    if (tool) return agentDecisionSchema.parse(tool)

    if (isExplicitKovarModelRequest(input)) {
      const model = extractModel(input)
      return agentDecisionSchema.parse({
        type: 'kovar_model',
        ...(model ? { model } : {}),
        prompt: cleanKovarPrompt(input, model),
      })
    }

    const wallet = walletTool(input)
    if (wallet) return agentDecisionSchema.parse(wallet)
    return { type: 'normal_chat' }
  }
}
