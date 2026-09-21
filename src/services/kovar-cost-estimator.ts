type PricingEntry = {
  model_name?: unknown
  model_ratio?: unknown
}

const VERIFIED_CHAT_RULES: Record<
  string,
  { quotaMultiplier: string; maxOutputTokens: number }
> = {
  // Mirrored from the inspected Gateway router. A mismatch fails closed because
  // only this exact model is estimated by the web client.
  'deepseek-v4-pro': { quotaMultiplier: '2', maxOutputTokens: 4469 },
}

function decimalParts(value: unknown): { numerator: bigint; denominator: bigint } | undefined {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : ''
  const match = text.match(/^(\d+)(?:\.(\d+))?$/)
  if (!match?.[1]) return undefined
  const fraction = match[2] ?? ''
  return {
    numerator: BigInt(`${match[1]}${fraction}`),
    denominator: 10n ** BigInt(fraction.length),
  }
}

function pricingEntries(pricing: unknown): PricingEntry[] {
  if (Array.isArray(pricing)) return pricing as PricingEntry[]
  if (pricing && typeof pricing === 'object' && 'data' in pricing) {
    const data = (pricing as { data?: unknown }).data
    if (Array.isArray(data)) return data as PricingEntry[]
  }
  return []
}

export class KovarCostEstimator {
  estimateChat(input: {
    model: string
    prompt: string
    pricing: unknown
    maxCompletionTokens?: number
  }): bigint | undefined {
    const rule = VERIFIED_CHAT_RULES[input.model]
    if (!rule) return undefined
    const entry = pricingEntries(input.pricing).find(
      (candidate) => candidate.model_name === input.model,
    )
    const rate = decimalParts(entry?.model_ratio)
    const multiplier = decimalParts(rule.quotaMultiplier)
    if (!rate || !multiplier) return undefined

    const maxOutput = Math.min(
      input.maxCompletionTokens ?? 512,
      rule.maxOutputTokens,
    )
    const payload = {
      messages: [{ role: 'user', content: input.prompt }],
      max_completion_tokens: maxOutput,
      stream: true,
    }
    const units = BigInt(new TextEncoder().encode(JSON.stringify(payload)).byteLength + maxOutput)
    const numerator = rate.numerator * multiplier.numerator * units
    const denominator = rate.denominator * multiplier.denominator
    return (numerator + denominator - 1n) / denominator
  }
}
