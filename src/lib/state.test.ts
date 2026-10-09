import { expect, it } from 'vitest'
import { toCsv } from './csv.ts'
import { PRESETS, decodeState, defaultState, encodeState, sanitize, withPeople } from './state.ts'

it('round-trips state through the URL hash, including non-ASCII names', () => {
  const s = { ...defaultState(), mode: 'chores' as const, people: ['Оксана', 'Zoë "Z"', 'Jo'] }
  expect(decodeState('#s=' + encodeState(s))).toEqual(s)
})
it('rejects garbage and fixes bad shapes', () => {
  expect(decodeState('#s=!!!')).toBeNull()
  expect(decodeState('#nothing')).toBeNull()
  expect(sanitize({ people: ['a'] })).toBeNull()
  const s = sanitize({ people: ['a', 'b'], bids: [[1]], rent: -5, chores: [] })!
  expect(s.bids).toEqual([[1, 0], [0, 0]])
  expect(s.rent).toBe(0)
})
it('presets are valid and resizing keeps matrices square', () => {
  for (const p of Object.values(PRESETS)) expect(sanitize({ ...p })).toEqual({ mode: 'rent', ...p })
  const s = withPeople(defaultState(), 5)
  expect(s.bids.length).toBe(5)
  expect(s.bids.every((r) => r.length === 5)).toBe(true)
  expect(s.minutes.every((r) => r.length === s.chores.length)).toBe(true)
})
it('escapes CSV', () => {
  expect(toCsv([['a,b', 'c"d', 1]])).toBe('"a,b","c""d",1\r\n')
})
