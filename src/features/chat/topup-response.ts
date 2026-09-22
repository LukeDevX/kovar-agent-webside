import { z } from 'zod'

const numberLikeSchema = z.union([z.number(), z.string()]).transform((value, context) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    context.addIssue({ code: 'custom', message: 'Expected a non-negative number' })
    return z.NEVER
  }
  return parsed
})

const paymentMethodSchema = z.object({
  min_topup: numberLikeSchema.optional(),
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
})

const topupInfoSchema = z.object({
  alipay_min_topup: numberLikeSchema.optional(),
  amount_options: z.array(numberLikeSchema).optional(),
  axone_currencies: z.array(z.string().trim().min(1)).optional(),
  enable_alipay_topup: z.boolean().optional(),
  enable_axone_topup: z.boolean().optional(),
  enable_stripe_topup: z.boolean().optional(),
  min_topup: numberLikeSchema.optional(),
  pay_methods: z.array(paymentMethodSchema).optional(),
  payment_compliance_confirmed: z.boolean().optional(),
  payment_compliance_terms_version: z.string().optional(),
  stripe_min_topup: numberLikeSchema.optional(),
  topup_link: z.string().optional(),
})

const axoneChainSchema = z.object({
  chain_id: z.string().trim().min(1),
  chain_name: z.string().trim().min(1),
  symbol: z.string().trim().min(1).optional(),
})

const topupOrderSchema = z.object({
  address: z.string().trim().min(1),
  amount: numberLikeSchema.optional(),
  chain_id: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).optional(),
  display_payment_money: z.string().trim().min(1).optional(),
  expires_at: numberLikeSchema.optional(),
  payment_money: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1),
  trade_no: z.string().trim().min(1),
})

const topupStatusSchema = z.object({
  amount: numberLikeSchema.optional(),
  complete_time: numberLikeSchema.optional(),
  money: numberLikeSchema.optional(),
  status: z.string().trim().min(1),
  trade_no: z.string().trim().min(1),
})

function formatAmount(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 8 }).format(value)
}

function formatTimestamp(value: number): string {
  const milliseconds = value < 10_000_000_000 ? value * 1000 : value
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
}

function paymentMinimum(
  type: string,
  methodMinimum: number | undefined,
  info: z.infer<typeof topupInfoSchema>,
): number | undefined {
  if (methodMinimum !== undefined) return methodMinimum
  if (/alipay/i.test(type)) return info.alipay_min_topup
  if (/stripe/i.test(type)) return info.stripe_min_topup
  return info.min_topup
}

export function describeTopupInfo(value: unknown, requestedAmount?: string): string {
  const parsed = topupInfoSchema.safeParse(value)
  if (!parsed.success) {
    return '已收到充值配置，但返回格式暂时无法识别。请稍后重试，或联系 Kovar 管理员确认充值方式。'
  }

  const info = parsed.data
  const requested = requestedAmount ? Number(requestedAmount) : undefined
  const exampleAmount = requested !== undefined && Number.isSafeInteger(requested) && requested > 0
    ? String(requested)
    : '<amount>'
  const lines: string[] = ['充值配置已查询。']

  if (requested !== undefined && Number.isSafeInteger(requested) && requested > 0) {
    lines.push(`目标充值金额：${formatAmount(requested)}（最终支付金额以订单为准）`)
  }

  if (info.payment_compliance_confirmed === false) {
    const version = info.payment_compliance_terms_version
      ? `（条款版本 ${info.payment_compliance_terms_version}）`
      : ''
    lines.push('', `下一步：请先在 Kovar 账户中完成付款合规确认${version}，然后重新发起充值。`)
    return lines.join('\n')
  }

  if (info.enable_axone_topup) {
    const currencies = [...new Set(info.axone_currencies ?? [])]
    const minimum = info.min_topup
    lines.push(
      '',
      '可在当前 Agent 中继续：Axone 稳定币充值',
      `• 可用币种：${currencies.length > 0 ? currencies.join('、') : '请查询 Kovar 当前配置'}`,
      `• 最低金额：${minimum === undefined ? '以创建订单时校验为准' : formatAmount(minimum)}`,
      '',
      '下一步：',
      '1. 发送“查看 Kovar 充值链”并选择链。',
      '2. 告诉我币种、链 ID，以及你将使用的付款钱包地址。',
      '3. 我会创建待支付订单；你确认订单信息后再转账。',
      '',
      `示例：“创建 Kovar 充值订单 ${exampleAmount} USDC，链：<chain_id>，付款钱包：0x...”`,
    )

    if (requested !== undefined && minimum !== undefined && requested < minimum) {
      lines.push(`注意：目标金额低于 Axone 最低充值金额 ${formatAmount(minimum)}。`)
    }
  } else {
    lines.push('', '当前 Agent 暂无可直接创建的充值方式。')
  }

  const dashboardMethods = (info.pay_methods ?? []).filter((method) =>
    /alipay|stripe/i.test(method.type),
  )
  if (dashboardMethods.length > 0) {
    lines.push('', 'Kovar 充值页面另外支持：')
    for (const method of dashboardMethods) {
      const minimum = paymentMinimum(method.type, method.min_topup, info)
      lines.push(`• ${method.name}${minimum === undefined ? '' : `（最低 ${formatAmount(minimum)}）`}`)
    }
    lines.push('当前 Agent 不会代你创建这些网页支付订单。')
  }

  const topupLink = info.topup_link?.trim()
  if (topupLink && /^https?:\/\//i.test(topupLink)) lines.push(`充值页面：${topupLink}`)

  const options = [...new Set(info.amount_options ?? [])]
  if (options.length > 0) lines.push(`参考金额：${options.map(formatAmount).join('、')}`)

  return lines.join('\n')
}

export function describeTopupChains(value: unknown): string {
  const parsed = z.array(axoneChainSchema).safeParse(value)
  if (!parsed.success || parsed.data.length === 0) {
    return '暂未获取到可用的 Axone 充值链。请稍后重试。'
  }

  return [
    'Axone 支持的充值链：',
    ...parsed.data.map(
      (chain) => `• ${chain.chain_name}${chain.symbol ? `（${chain.symbol}）` : ''} — chain_id: ${chain.chain_id}`,
    ),
    '',
    '下一步：选择币种和链，再提供你实际付款的钱包地址。请确保该钱包支持所选链。',
  ].join('\n')
}

export function describeTopupOrder(value: unknown): string {
  const parsed = topupOrderSchema.safeParse(value)
  if (!parsed.success) {
    return '充值订单已返回，但缺少转账所需的完整信息。请不要转账，先联系 Kovar 管理员核对。'
  }

  const order = parsed.data
  const paymentAmount = order.display_payment_money ?? order.payment_money
  const lines = [
    '充值订单已创建，当前等待付款。',
    `订单号：${order.trade_no}`,
    `状态：${topupStatusLabel(order.status)}`,
    `收款地址：${order.address}`,
  ]
  if (paymentAmount) lines.push(`应付金额：${paymentAmount}${order.currency ? ` ${order.currency}` : ''}`)
  else if (order.amount !== undefined) lines.push(`充值金额：${formatAmount(order.amount)}`)
  if (order.chain_id) lines.push(`充值链：${order.chain_id}`)
  if (order.expires_at) lines.push(`有效至：${formatTimestamp(order.expires_at)}`)

  lines.push(
    '',
    '请下一步这样做：',
    '1. 核对币种和充值链。',
    `2. 从你提供的付款钱包向上述地址转入${paymentAmount ? '精确的应付金额' : '订单要求的金额'}。`,
    '3. 转账后发送：“查询 Kovar 充值状态 ' + order.trade_no + '”。',
    '',
    '重要：创建订单不代表充值成功，不要换币种、换链或随意修改应付金额。',
  )
  return lines.join('\n')
}

function topupStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    expired: '已过期',
    failed: '失败',
    pending: '等待支付或确认',
    success: '充值成功',
  }
  return labels[status.toLowerCase()] ?? status
}

export function describeTopupStatus(value: unknown): string {
  const parsed = topupStatusSchema.safeParse(value)
  if (!parsed.success) {
    return '已收到充值状态，但返回格式暂时无法识别。请稍后重试。'
  }

  const status = parsed.data
  const normalized = status.status.toLowerCase()
  const lines = [
    `充值订单：${status.trade_no}`,
    `当前状态：${topupStatusLabel(status.status)}`,
  ]
  if (status.amount !== undefined) lines.push(`入账金额：${formatAmount(status.amount)}`)
  if (status.money !== undefined) lines.push(`支付金额：${formatAmount(status.money)}`)
  if (status.complete_time) lines.push(`完成时间：${formatTimestamp(status.complete_time)}`)

  if (normalized === 'pending') lines.push('', '订单仍在等待支付或链上确认，请勿重复创建或重复付款。')
  if (normalized === 'success') lines.push('', '充值已成功。如果账户余额尚未刷新，可稍后查询 Kovar 额度。')
  if (normalized === 'failed') lines.push('', '订单充值失败。请不要再向原地址转账，联系 Kovar 管理员核对。')
  if (normalized === 'expired') lines.push('', '订单已过期。请不要再向原地址转账，需要时请重新创建订单。')
  return lines.join('\n')
}
