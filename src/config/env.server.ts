import 'server-only'

import { z } from 'zod'

const serverEnvSchema = z.object({
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com/v1'),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-v4-pro'),
  KOVAR_AGENT_GATEWAY_URL: z.url(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    KOVAR_AGENT_GATEWAY_URL: process.env.KOVAR_AGENT_GATEWAY_URL,
  })
}
