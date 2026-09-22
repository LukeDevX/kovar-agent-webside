import { describe, expect, it } from 'vitest'

import {
  describeTopupChains,
  describeTopupInfo,
  describeTopupOrder,
  describeTopupStatus,
} from '@/features/chat/topup-response'

describe('Kovar topup responses', () => {
  it('turns topup configuration into instructions instead of raw JSON', () => {
    const content = describeTopupInfo(
      {
        alipay_min_topup: 1,
        amount_options: [10, 20, 50, 100, 200, 500],
        axone_currencies: ['USDT', 'USDC', 'AXBHD', 'AXUSD'],
        enable_alipay_topup: true,
        enable_axone_topup: true,
        enable_stripe_topup: true,
        min_topup: 1,
        pay_methods: [
          { min_topup: '1', name: 'Stripe', type: 'stripe' },
          { min_topup: '1', name: 'Alipay', type: 'alipay_gateway' },
        ],
        payment_compliance_confirmed: true,
        stripe_min_topup: 1,
        topup_link: '',
      },
      '40000',
    )

    expect(content).toContain('目标充值金额：40,000')
    expect(content).toContain('Axone 稳定币充值')
    expect(content).toContain('USDT、USDC、AXBHD、AXUSD')
    expect(content).toContain('查看 Kovar 充值链')
    expect(content).toContain('付款钱包地址')
    expect(content).toContain('Stripe（最低 1）')
    expect(content).not.toContain('"enable_axone_topup"')
  })

  it('stops and explains compliance requirements', () => {
    expect(
      describeTopupInfo({
        payment_compliance_confirmed: false,
        payment_compliance_terms_version: 'v1',
      }),
    ).toContain('先在 Kovar 账户中完成付款合规确认（条款版本 v1）')
  })

  it('lists chains with the exact chain id needed for order creation', () => {
    const content = describeTopupChains([
      { chain_id: 'ethereum', chain_name: 'Ethereum', symbol: 'ETH' },
      { chain_id: 'base', chain_name: 'Base', symbol: 'ETH' },
    ])

    expect(content).toContain('Ethereum（ETH） — chain_id: ethereum')
    expect(content).toContain('Base（ETH） — chain_id: base')
    expect(content).toContain('实际付款的钱包地址')
  })

  it('explains exactly how to pay a newly created order', () => {
    const content = describeTopupOrder({
      address: '0x2222222222222222222222222222222222222222',
      chain_id: 'base',
      currency: 'USDC',
      display_payment_money: '81.25',
      status: 'pending',
      trade_no: 'AXONE-7-test',
    })

    expect(content).toContain('应付金额：81.25 USDC')
    expect(content).toContain('充值链：base')
    expect(content).toContain('精确的应付金额')
    expect(content).toContain('查询 Kovar 充值状态 AXONE-7-test')
    expect(content).toContain('创建订单不代表充值成功')
  })

  it('gives an actionable explanation for each known order state', () => {
    expect(describeTopupStatus({ trade_no: 'one', status: 'pending' })).toContain('请勿重复创建或重复付款')
    expect(describeTopupStatus({ trade_no: 'two', status: 'success' })).toContain('充值已成功')
    expect(describeTopupStatus({ trade_no: 'three', status: 'failed' })).toContain('请不要再向原地址转账')
    expect(describeTopupStatus({ trade_no: 'four', status: 'expired' })).toContain('订单已过期')
  })
})
