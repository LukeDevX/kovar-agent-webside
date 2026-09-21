import { isAddress, type Address } from 'viem'

import { GatewayError, toGatewayError } from '@/lib/gateway/errors'
import {
  buildRequestMessage,
  createIdempotencyKey,
  createNonce,
  sha256Hex,
} from '@/lib/gateway/signing'

export type SignMessage = (message: string) => Promise<`0x${string}`>

type GatewayRequest = {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  idempotent?: boolean
  signal?: AbortSignal
}

export class KovarGatewayClient {
  readonly agentId: Address

  constructor(address: string, private readonly signMessage: SignMessage) {
    if (!isAddress(address)) throw new Error('Invalid wallet address')
    this.agentId = address.toLowerCase() as Address
  }

  async request<T>(target: string, options: GatewayRequest = {}): Promise<T> {
    const response = await this.signedFetch(target, options)
    if (!response.ok) throw await toGatewayError(response)
    return (await response.json()) as T
  }

  async signedFetch(target: string, options: GatewayRequest = {}): Promise<Response> {
    if (!target.startsWith('/api/v1/')) throw new Error('Gateway target is not allowed')
    const method = options.method ?? 'GET'
    const body = options.body === undefined ? '' : JSON.stringify(options.body)
    const bodyBytes = new TextEncoder().encode(body)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = createNonce()
    const idempotencyKey = options.idempotent ? createIdempotencyKey() : ''
    const message = buildRequestMessage({
      method,
      requestTarget: target,
      timestamp,
      nonce,
      bodyHash: await sha256Hex(bodyBytes),
      idempotencyKey,
    })
    const signature = await this.signMessage(message)
    const headers = new Headers({
      'X-Agent-Id': this.agentId,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature,
    })
    if (body) headers.set('Content-Type', 'application/json')
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

    return fetch(`/api/gateway${target}`, {
      method,
      headers,
      ...(body ? { body } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  }
}

export async function publicGatewayRequest<T>(
  target: '/api/v1/agents/challenge' | '/api/v1/agents/register',
  body: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const response = await fetch(`/api/gateway${target}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await toGatewayError(response)
  return (await response.json()) as T
}

export function isGatewayError(error: unknown, code: string): error is GatewayError {
  return error instanceof GatewayError && error.code === code
}
