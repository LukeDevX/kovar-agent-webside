import { z } from 'zod'

const gatewayErrorSchema = z.object({
  code: z.string().default('UNKNOWN_GATEWAY_ERROR'),
  message: z.string().default('Kovar Gateway request failed'),
  request_id: z.string().optional(),
})

export class GatewayError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export async function toGatewayError(response: Response): Promise<GatewayError> {
  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = gatewayErrorSchema.parse(payload)
  return new GatewayError(parsed.code, parsed.message, response.status, parsed.request_id)
}

export function friendlyGatewayError(error: unknown): string {
  if (!(error instanceof GatewayError)) {
    return error instanceof Error ? error.message : 'Kovar 请求失败。'
  }

  const messages: Record<string, string> = {
    AGENT_NOT_FOUND: '这个钱包尚未注册为 Kovar Agent。',
    AGENT_NOT_WHITELISTED: 'Agent 正在等待管理员批准。',
    AGENT_SUSPENDED: 'Agent 已暂停。',
    AGENT_REVOKED: 'Agent 已撤销。',
    KOVAR_USER_NOT_BOUND: '请先登录并绑定 Kovar 账户。',
    KOVAR_TOKEN_NOT_BOUND: 'Agent 尚未创建 Kovar Key。',
    MODEL_NOT_AVAILABLE: 'Kovar 当前不可用该模型。',
    USER_REJECTED: '操作已取消。',
  }
  const base = messages[error.code] ?? error.message
  return error.requestId ? `${base} Request ID: ${error.requestId}` : base
}
