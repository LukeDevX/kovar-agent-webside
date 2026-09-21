import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ServerEnv } from '@/config/env.server'
import { DeepSeekService } from '@/lib/deepseek/deepseek.service'

const env: ServerEnv = {
  DEEPSEEK_API_KEY: 'server-secret',
  DEEPSEEK_BASE_URL: 'https://deepseek.example/v1',
  DEEPSEEK_MODEL: 'deepseek-v4-pro',
  KOVAR_AGENT_GATEWAY_URL: 'https://gateway.example',
}

describe('DeepSeekService', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('always sends normal chat to the configured default model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Answer' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(new DeepSeekService(env).chat([{ role: 'user', content: 'Hello' }])).resolves.toBe(
      'Answer',
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'deepseek-v4-pro' })
    expect(init.headers).toMatchObject({ Authorization: 'Bearer server-secret' })
  })
})
