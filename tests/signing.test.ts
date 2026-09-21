import { describe, expect, it } from 'vitest'

import {
  buildRegistrationMessage,
  buildRequestMessage,
  sha256Hex,
} from '@/lib/gateway/signing'

describe('Gateway EIP-191 canonical messages', () => {
  it('builds the exact registration message without a trailing newline', () => {
    expect(buildRegistrationMessage('0xABC', 'nonce', 1700000000)).toBe(
      'Kovar Agent Gateway\n\nAction: Register\nAddress: 0xabc\nNonce: nonce\nTimestamp: 1700000000',
    )
  })

  it('binds method, raw target, body hash and idempotency key', () => {
    expect(
      buildRequestMessage({
        method: 'post',
        requestTarget: '/api/v1/tasks?page=1&page_size=20',
        timestamp: '1700000000',
        nonce: 'a'.repeat(64),
        bodyHash: 'b'.repeat(64),
        idempotencyKey: 'task-1',
      }),
    ).toBe(
      `Kovar Agent Gateway\nAction: Request\nPOST\n/api/v1/tasks?page=1&page_size=20\n1700000000\n${'a'.repeat(64)}\n${'b'.repeat(64)}\ntask-1`,
    )
  })

  it('ends after the body hash newline when no idempotency key exists', () => {
    expect(
      buildRequestMessage({
        method: 'GET',
        requestTarget: '/api/v1/account',
        timestamp: '1',
        nonce: 'a'.repeat(64),
        bodyHash: 'b'.repeat(64),
      }),
    ).toMatch(/\n$/)
  })

  it('hashes the exact request bytes', async () => {
    await expect(sha256Hex(new TextEncoder().encode('{}'))).resolves.toBe(
      '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    )
  })
})
