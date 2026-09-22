import { GatewayError } from '@/lib/gateway/errors'

export type AccountResponse = {
  quota: number
  used_quota: number
  available_quota: number
  request_count: number
}

export type KovarConnectionState = 'unknown' | 'not_connected' | 'ready'

type TokenResponse = {
  key_bound?: boolean
  status?: string
  remain_quota?: number
}

type GatewayRequester = {
  request<T>(target: string): Promise<T>
}

const NOT_CONNECTED_CODES = new Set([
  'KOVAR_USER_NOT_BOUND',
  'KOVAR_TOKEN_NOT_BOUND',
  'KOVAR_AUTH_FAILED',
  'NOT_FOUND',
])

export async function readKovarConnection(
  gateway: GatewayRequester,
): Promise<Exclude<KovarConnectionState, 'unknown'>> {
  try {
    const token = await gateway.request<TokenResponse>('/api/v1/agent/token')
    return token.key_bound ? 'ready' : 'not_connected'
  } catch (error) {
    if (error instanceof GatewayError && NOT_CONNECTED_CODES.has(error.code)) {
      return 'not_connected'
    }
    throw error
  }
}
