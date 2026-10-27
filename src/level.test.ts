import { describe, expect, it } from 'vitest'
import { hitDieAverage, hpGain } from './level'

describe('level up hit die', () => {
  it('uses the fixed average (d8 → 5) and then Constitution', () => {
    expect(hitDieAverage(6)).toBe(4)
    expect(hitDieAverage(8)).toBe(5)
    expect(hitDieAverage(10)).toBe(6)
    expect(hitDieAverage(12)).toBe(7)
    expect(hpGain(5, 14)).toBe(7)
    expect(hpGain(1, 8)).toBe(1)
  })
})