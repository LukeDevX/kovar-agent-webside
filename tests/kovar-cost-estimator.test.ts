import { describe, expect, it } from 'vitest'

import { KovarCostEstimator } from '@/services/kovar-cost-estimator'

describe('KovarCostEstimator', () => {
  const estimator = new KovarCostEstimator()

  it('rounds verified deepseek-v4-pro estimates up to integer quota', () => {
    const estimate = estimator.estimateChat({
      model: 'deepseek-v4-pro',
      prompt: 'hello',
      pricing: [{ model_name: 'deepseek-v4-pro', model_ratio: '0.0135' }],
      maxCompletionTokens: 128,
    })
    expect(estimate).toBeTypeOf('bigint')
    expect(estimate).toBeGreaterThan(0n)
  })

  it('fails closed instead of guessing an unverified model price', () => {
    expect(
      estimator.estimateChat({
        model: 'another-model',
        prompt: 'hello',
        pricing: [{ model_name: 'another-model', model_ratio: 1 }],
      }),
    ).toBeUndefined()
  })
})
