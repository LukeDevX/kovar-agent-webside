import { describe, expect, it } from 'vitest'

import { AgentController } from '@/services/agent-controller.service'

describe('AgentController', () => {
  const controller = new AgentController()

  it.each([
    '帮我查 NVIDIA',
    '用 deepseek-v4-pro 查 NVIDIA',
    'Explain ERC4626 with deepseek-v4-pro',
  ])('routes ordinary chat to DeepSeek: %s', (input) => {
    expect(controller.decide(input)).toEqual({ type: 'normal_chat' })
  })

  it('requires explicit Kovar intent', () => {
    const decision = controller.decide('使用 Kovar 查 NVIDIA')
    expect(decision.type).toBe('kovar_model')
    if (decision.type === 'kovar_model') expect(decision.model).toBeUndefined()
  })

  it('preserves an explicitly requested model ID', () => {
    expect(controller.decide('使用 Kovar 的 deepseek-v4-pro 帮我查 NVIDIA')).toMatchObject({
      type: 'kovar_model',
      model: 'deepseek-v4-pro',
    })
  })

  it('routes Kovar account lookup as a tool, not a model request', () => {
    expect(controller.decide('查看我的 Kovar 额度')).toMatchObject({
      type: 'kovar_tool',
      tool: 'account.get',
    })
  })

  it.each([
    ['给我的 Kovar 账户充值4万', '40000'],
    ['Kovar topup 2.5k', '2500'],
    ['Kovar 充值 40,000', '40000'],
  ])('keeps a normalized requested topup amount: %s', (input, amount) => {
    expect(controller.decide(input)).toMatchObject({
      type: 'kovar_tool',
      tool: 'topup.info',
      args: { amount },
    })
  })

  it('extracts the trade number from a friendly topup status request', () => {
    expect(controller.decide('查询 Kovar 充值状态 AXONE-7-test')).toMatchObject({
      type: 'kovar_tool',
      tool: 'topup.status',
      args: { tradeNumber: 'AXONE-7-test' },
    })
  })

  it('routes AXUSD lookup to the wallet', () => {
    expect(controller.decide('查看我的 AXUSD')).toMatchObject({
      type: 'wallet_tool',
      tool: 'wallet.getTokenBalance',
    })
  })

  it('allows unlimited approval only when explicitly requested', () => {
    const spender = '0x1111111111111111111111111111111111111111'
    expect(controller.decide(`无限授权 AXUSD 给 ${spender}`)).toMatchObject({
      type: 'wallet_tool',
      tool: 'wallet.approve',
      args: { unlimited: true, spender },
    })
    expect(controller.decide(`授权 10 AXUSD 给 ${spender}`)).toMatchObject({
      args: { unlimited: false },
    })
  })
})
