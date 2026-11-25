import { describe, expect, test } from 'bun:test'
import { initialsFor } from './account-setup'

describe('initialsFor', () => {
  test('uses the first letter of up to two words', () => {
    expect(initialsFor('Rahmar Mohammed', 'rahmar')).toBe('RM')
    expect(initialsFor('Djibril', 'djibril')).toBe('D')
  })

  test('ignores extra spaces', () => {
    expect(initialsFor('  Camila   Torres  ', 'x')).toBe('CT')
  })

  test('never goes past two letters', () => {
    expect(initialsFor('Anna Maria Lopez Diaz', 'x')).toBe('AM')
  })

  test('falls back to the username when the name is empty', () => {
    expect(initialsFor('', 'marcus-chen')).toBe('M')
    expect(initialsFor('   ', 'zed')).toBe('Z')
  })
})
