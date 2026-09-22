import { describe, expect, it, vi } from 'vitest'

import { readKovarConnection } from '@/features/agent/agent-session'
import { GatewayError } from '@/lib/gateway/errors'

describe('Kovar agent session', () => {
  it('restores an existing active Agent token', async () => {
    const request = vi.fn().mockResolvedValue({ key_bound: true, status: 'ACTIVE' })

    await expect(readKovarConnection({ request })).resolves.toBe('ready')
    expect(request).toHaveBeenCalledWith('/api/v1/agent/token')
  })

  it('reports an Agent without a bound token as not connected', async () => {
    const request = vi.fn().mockResolvedValue({ key_bound: false, status: 'UNKNOWN' })

    await expect(readKovarConnection({ request })).resolves.toBe('not_connected')
  })

  it.each(['KOVAR_USER_NOT_BOUND', 'KOVAR_TOKEN_NOT_BOUND', 'KOVAR_AUTH_FAILED', 'NOT_FOUND'])(
    'maps %s to a disconnected Kovar session',
    async (code) => {
      const request = vi.fn().mockRejectedValue(new GatewayError(code, 'fixture', 401))

      await expect(readKovarConnection({ request })).resolves.toBe('not_connected')
    },
  )

  it('preserves unexpected Gateway failures', async () => {
    const error = new GatewayError('UPSTREAM_ERROR', 'unavailable', 502)
    const request = vi.fn().mockRejectedValue(error)

    await expect(readKovarConnection({ request })).rejects.toBe(error)
  })
})
