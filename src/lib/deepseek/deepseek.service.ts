import 'server-only'

import { z } from 'zod'

import type { ServerEnv } from '@/config/env.server'

const SYSTEM_PROMPT = `You are the default AI assistant inside Kovar Agent Web.

Reply in the user's language.

Be concise and practical.

Only provide essential information, important results, and key recommendations.

Do not over-explain unless the user asks for more detail.

You may use Kovar and wallet tools only when the user's request actually requires them.

Never claim a Kovar action succeeded unless the corresponding tool returned success.

Never claim a blockchain transaction succeeded unless the chain result confirms it.`

const responseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }),
    }),
  ),
})

export type DeepSeekMessage = {
  role: 'user' | 'assistant'
  content: string
}

export class DeepSeekService {
  constructor(private readonly env: ServerEnv) {}

  async chat(messages: DeepSeekMessage[], signal?: AbortSignal): Promise<string> {
    const baseUrl = this.env.DEEPSEEK_BASE_URL.endsWith('/')
      ? this.env.DEEPSEEK_BASE_URL
      : `${this.env.DEEPSEEK_BASE_URL}/`
    const response = await fetch(new URL('chat/completions', baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.env.DEEPSEEK_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: false,
      }),
      ...(signal ? { signal } : {}),
    })
    if (!response.ok) throw new Error(`DeepSeek request failed (${response.status})`)
    const payload: unknown = await response.json()
    const parsed = responseSchema.parse(payload)
    const content = parsed.choices[0]?.message.content.trim()
    if (!content) throw new Error('DeepSeek returned an empty response')
    return content
  }
}
