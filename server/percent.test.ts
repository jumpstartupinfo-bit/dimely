import { describe, expect, test } from 'bun:test'
import { percentOrDefault } from './percent'

describe('percentOrDefault', () => {
  test('uses a valid stored value', () => {
    expect(percentOrDefault('15', 20)).toBe(15)
    expect(percentOrDefault('0', 20)).toBe(0)
    expect(percentOrDefault('100', 20)).toBe(100)
    expect(percentOrDefault('12.5', 20)).toBe(12.5)
  })

  test('falls back when nothing is stored', () => {
    expect(percentOrDefault(null, 20)).toBe(20)
  })

  test('ignores nonsense, negative and out-of-range values', () => {
    expect(percentOrDefault('abc', 20)).toBe(20)
    expect(percentOrDefault('', 20)).toBe(20)
    expect(percentOrDefault('-5', 20)).toBe(20)
    expect(percentOrDefault('101', 20)).toBe(20)
    expect(percentOrDefault('NaN', 20)).toBe(20)
    expect(percentOrDefault('Infinity', 20)).toBe(20)
  })
})

import { numberInRange } from './percent'

describe('numberInRange', () => {
  test('accepts values inside the range, including the edges', () => {
    expect(numberInRange('5', 0, 100, 9)).toBe(5)
    expect(numberInRange('0', 0, 100, 9)).toBe(0)
    expect(numberInRange('100', 0, 100, 9)).toBe(100)
    expect(numberInRange('365', 1, 3650, 1)).toBe(365)
  })

  test('uses the fallback for missing, invalid or out-of-range values', () => {
    expect(numberInRange(null, 0, 100, 9)).toBe(9)
    expect(numberInRange('abc', 0, 100, 9)).toBe(9)
    expect(numberInRange('-1', 0, 100, 9)).toBe(9)
    expect(numberInRange('101', 0, 100, 9)).toBe(9)
    expect(numberInRange('Infinity', 0, 100, 9)).toBe(9)
  })
})
