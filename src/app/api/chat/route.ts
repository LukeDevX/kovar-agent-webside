import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { z } from 'zod'

import { getServerEnv } from '@/config/env.server'
import { DeepSeekService } from '@/lib/deepseek/deepseek.service'

export const runtime = 'nodejs'

const requestSchema = z.object({
  walletAddress: z.string().refine(isAddress, 'A connected wallet is required'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(32_000),
      }),
    )
    .min(1)
    .max(40),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const payload: unknown = await request.json()
    const input = requestSchema.parse(payload)
    const service = new DeepSeekService(getServerEnv())
    const content = await service.chat(input.messages, request.signal)
    return NextResponse.json({ content, source: 'deepseek' })
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Invalid chat request' : 'DeepSeek is unavailable'
    return NextResponse.json({ code: 'CHAT_FAILED', message }, { status: 502 })
  }
}
