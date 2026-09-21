const REQUEST_PREFIX = 'Kovar Agent Gateway\nAction: Request\n'

export function buildRegistrationMessage(
  address: string,
  nonce: string,
  timestamp: number,
): string {
  return `Kovar Agent Gateway\n\nAction: Register\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nTimestamp: ${timestamp}`
}

export function buildRequestMessage(input: {
  method: string
  requestTarget: string
  timestamp: string
  nonce: string
  bodyHash: string
  idempotencyKey?: string
}): string {
  return `${REQUEST_PREFIX}${input.method.toUpperCase()}\n${input.requestTarget}\n${input.timestamp}\n${input.nonce}\n${input.bodyHash}\n${input.idempotencyKey ?? ''}`
}

export async function sha256Hex(body: Uint8Array): Promise<string> {
  const normalized = new Uint8Array(body)
  const digest = await crypto.subtle.digest('SHA-256', normalized.buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID()
}
