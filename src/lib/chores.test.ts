import { describe, expect, it } from 'vitest'
import { bundleCost, checkEF1, envyCycle, improve, roundRobin, rotationSchedule, totalCost } from './chores.ts'

let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const inst = (n: number, m: number) => Array.from({ length: n }, () => Array.from({ length: m }, () => Math.round(rnd() * 60) + 1))
const partition = (b: number[][], m: number) => expect(b.flat().sort((x, y) => x - y)).toEqual(Array.from({ length: m }, (_, i) => i))

describe('EF1 for chores', () => {
  it('round-robin is EF1 on random instances, for random turn orders', () => {
    for (let t = 0; t < 300; t++) {
      const n = 2 + (t % 5), m = 1 + Math.floor(rnd() * 15)
      const costs = inst(n, m)
      const order = Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5)
      const b = roundRobin(costs, order)
      partition(b, m)
      expect(checkEF1(costs, b).ef1).toBe(true)
    }
  })
  it('envy-cycle elimination is EF1 on random instances', () => {
    for (let t = 0; t < 300; t++) {
      const n = 2 + (t % 5), m = 1 + Math.floor(rnd() * 15)
      const costs = inst(n, m)
      const b = envyCycle(costs)
      partition(b, m)
      expect(checkEF1(costs, b).ef1).toBe(true)
    }
  })
  it('improve keeps EF1 and never increases total time', () => {
    for (let t = 0; t < 60; t++) {
      const n = 2 + (t % 4), m = 2 + Math.floor(rnd() * 8)
      const costs = inst(n, m)
      const b = roundRobin(costs)
      const better = improve(costs, b)
      partition(better, m)
      expect(checkEF1(costs, better).ef1).toBe(true)
      expect(totalCost(costs, better)).toBeLessThanOrEqual(totalCost(costs, b) + 1e-9)
    }
  })
  it('the checker rejects an allocation that is not EF1', () => {
    // person 0 does all three equal chores, person 1 does none: dropping one still leaves envy
    const costs = [[10, 10, 10], [10, 10, 10]]
    expect(checkEF1(costs, [[0, 1, 2], []]).ef1).toBe(false)
    expect(checkEF1(costs, [[0, 1], [2]]).ef1).toBe(true)
  })
})

it('schedules rotate bundles weekly and every person covers every bundle over n weeks', () => {
  const bundles = [[0, 1], [2], [3]]
  const s = rotationSchedule(bundles, 3, true)
  expect(s[0].owner).toEqual([0, 0, 1, 2])
  expect(s[1].owner).toEqual([1, 1, 2, 0])
  const costs = inst(3, 4)
  const per = [0, 1, 2].map((p) => s.reduce((sum, w) => sum + bundleCost(costs, p, w.owner.flatMap((o, c) => (o === p ? [c] : []))), 0))
  const all = [0, 1, 2].map((p) => bundleCost(costs, p, [0, 1, 2, 3]))
  expect(per).toEqual(all)
  expect(rotationSchedule(bundles, 2, false)[1].owner).toEqual(s[0].owner)
})
