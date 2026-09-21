import { getServerEnv } from '@/config/env.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXACT_ROUTES = new Set([
  'api/v1/agents/challenge',
  'api/v1/agents/register',
  'api/v1/agents/me',
  'api/v1/kovar/auth/register',
  'api/v1/kovar/auth/login',
  'api/v1/kovar/auth/login/2fa',
  'api/v1/bindings',
  'api/v1/bindings/me',
  'api/v1/agent/token',
  'api/v1/account',
  'api/v1/account/topup/info',
  'api/v1/account/topups',
  'api/v1/account/topup/status',
  'api/v1/account/topup/axone/chains',
  'api/v1/account/topup',
  'api/v1/models',
  'api/v1/pricing',
  'api/v1/tasks',
  'api/v1/usage',
  'api/v1/logs',
  'api/v1/logs/stat',
])

const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'x-agent-id',
  'x-timestamp',
  'x-nonce',
  'x-signature',
  'idempotency-key',
] as const

function isAllowed(path: string): boolean {
  return EXACT_ROUTES.has(path) || /^api\/v1\/tasks\/[A-Za-z0-9_-]{1,128}$/.test(path)
}

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const { path } = await context.params
    const joined = path.join('/')
    if (!isAllowed(joined)) {
      return Response.json({ code: 'NOT_FOUND', message: 'Gateway route is not allowed' }, { status: 404 })
    }

    const requestUrl = new URL(request.url)
    const target = `/${joined}${requestUrl.search}`
    const gatewayBase = getServerEnv().KOVAR_AGENT_GATEWAY_URL.replace(/\/$/, '')
    const headers = new Headers()
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }
    const body = request.method === 'GET' ? undefined : await request.arrayBuffer()
    const upstream = await fetch(`${gatewayBase}${target}`, {
      method: request.method,
      headers,
      ...(body ? { body } : {}),
      signal: request.signal,
      redirect: 'manual',
    })
    const responseHeaders = new Headers()
    for (const name of ['content-type', 'x-request-id', 'x-task-id', 'cache-control']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    responseHeaders.set('Cache-Control', 'no-store')
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    return Response.json(
      { code: 'GATEWAY_PROXY_UNAVAILABLE', message: 'Kovar Gateway is unavailable' },
      { status: 502 },
    )
  }
}

export const GET = proxy
export const POST = proxy
export const DELETE = proxy
