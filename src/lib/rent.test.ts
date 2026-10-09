import { describe, expect, it } from 'vitest'
import { maxAssignment } from './hungarian.ts'
import { maxEnvy, normalizeBids, roundPrices, solveRent } from './rent.ts'

let seed = 12345
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)

function perms(n: number): number[][] {
  if (n === 1) return [[0]]
  return perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, k) => [...p.slice(0, k), n - 1, ...p.slice(k)]))
}
function randomValues(n: number, rent: number) {
  return normalizeBids(Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() ** 2 * 10 + 0.01)), rent)
}

describe('Hungarian', () => {
  it('matches brute force on random matrices (n <= 6)', () => {
    for (let t = 0; t < 200; t++) {
      const n = 1 + (t % 6)
      const M = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.round(rnd() * 100 - 30)))
      const a = maxAssignment(M)
      expect(new Set(a).size).toBe(n)
      const got = a.reduce((s, j, i) => s + M[i][j], 0)
      const best = Math.max(...perms(n).map((p) => p.reduce((s, j, i) => s + M[i][j], 0)))
      expect(got).toBe(best)
    }
  })
})

describe('solveRent', () => {
  it('is envy-free with prices summing to the rent on random instances', () => {
    for (let t = 0; t < 200; t++) {
      const n = 2 + (t % 6)
      const rent = 500 + Math.round(rnd() * 3000)
      const v = randomValues(n, rent)
      const sol = solveRent(v, rent)
      expect(sol.prices.reduce((a, b) => a + b, 0)).toBeCloseTo(rent, 6)
      expect(maxEnvy(v, sol.prices, sol.assignment)).toBeLessThan(1e-6)
      // welfare equals the brute-force optimum
      const best = Math.max(...perms(n).map((p) => p.reduce((s, j, i) => s + v[i][j], 0)))
      expect(sol.welfare).toBeCloseTo(best, 6)
    }
  })

  it('maximises the minimum utility: two people, two rooms by hand', () => {
    // values 70/30 and 60/40 (rent 100). Person 0 gets room 0. EF: p0-p1 in [10,30]... utilities equal at the optimum.
    const sol = solveRent([[70, 30], [60, 40]], 100)
    expect(sol.assignment).toEqual([0, 1])
    // p0 + p1 = 100; u0 = 70-p0, u1 = 40-p1 = p0-60. Equal when p0 = 65 -> both 5.
    expect(sol.prices[0]).toBeCloseTo(65)
    expect(sol.minUtility).toBeCloseTo(5)
  })

  it('identical tastes give an equal-utility split', () => {
    const sol = solveRent([[50, 30, 20], [50, 30, 20], [50, 30, 20]], 100)
    expect(sol.utilities.every((u) => Math.abs(u - sol.utilities[0]) < 1e-6)).toBe(true)
  })
})

it('rounds prices to cents while keeping the sum', () => {
  const r = roundPrices([100 / 3, 100 / 3, 100 / 3], 100)
  expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9)
  expect(r.map((x) => x * 100 - Math.round(x * 100)).every((d) => Math.abs(d) < 1e-6)).toBe(true)
})

it('normalizes bids', () => {
  expect(normalizeBids([[1, 3], [0, 0], [-1, 1]], 100)).toEqual([[25, 75], [50, 50], [0, 100]])
})
