import { describe, expect, it } from 'vitest'
import { carrierOf, meshFor, ownerOf, priceOf, runHarmony, simulateHarmony, vkey } from './harmony.ts'
import { maxEnvy, normalizeBids } from './rent.ts'

let seed = 99
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)

describe('rental harmony (Sperner)', () => {
  it('finds a fully labelled simplex for random Sperner labellings', () => {
    for (let t = 0; t < 60; t++) {
      const n = 2 + (t % 3)
      const N = n === 4 ? 5 : 8
      const answers = new Map<string, number>()
      for (;;) {
        const st = runHarmony(n, N, 100, answers)
        if (st.kind === 'ask') {
          const c = carrierOf(st.x)
          answers.set(vkey(st.x), c[Math.floor(rnd() * c.length)])
          continue
        }
        expect(st.kind).toBe('done')
        if (st.kind === 'done') {
          expect(new Set(st.labels).size).toBe(n)
          expect(new Set(st.owners).size).toBe(n)
          expect(st.assignment.every((r) => r >= 0)).toBe(true)
          for (const v of st.vertices) expect(v.reduce((a, b) => a + b, 0)).toBe(N)
        }
        break
      }
    }
  })

  it('gives owners 0..n-1 on every lattice neighbour step', () => {
    expect(ownerOf([2, 1, 0])).not.toBe(ownerOf([3, 0, 0]))
  })

  it('prices sum to the rent', () => {
    expect(priceOf([3, 3, 3], 9, 900).reduce((a, b) => a + b, 0)).toBeCloseTo(900)
  })

  it('is approximately envy-free for quasi-linear people (envy <= 2 grid steps)', () => {
    for (let t = 0; t < 40; t++) {
      const n = 2 + (t % 3)
      const rent = 1000 + Math.round(rnd() * 2000)
      const v = normalizeBids(Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() + 0.05)), rent)
      const N = meshFor(n, 1)
      const { state, order } = simulateHarmony(v, rent, N)
      expect(state.kind).toBe('done')
      if (state.kind !== 'done') continue
      expect(state.prices.reduce((a, b) => a + b, 0)).toBeCloseTo(rent, 6)
      expect(maxEnvy(v, state.prices, state.assignment)).toBeLessThanOrEqual(2 * state.step + 1e-6)
      expect(order.length).toBeLessThan(2000)
    }
  })
})
