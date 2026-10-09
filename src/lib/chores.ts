// Fair division of indivisible chores with additive costs (minutes).
// costs[i][c] = minutes person i needs for chore c. A bundle is a list of chore indices.
// Allocation A is EF1 if for every pair (i, j) person i, after dropping one chore from their own
// bundle, does not prefer j's bundle.

const EPS = 1e-9

export const bundleCost = (costs: number[][], i: number, bundle: number[]) => bundle.reduce((s, c) => s + costs[i][c], 0)

/** Round-robin: people take turns picking the chore that is cheapest for them. EF1 for any turn order. */
export function roundRobin(costs: number[][], order?: number[]): number[][] {
  const n = costs.length
  const m = n ? costs[0].length : 0
  const turn = order ?? Array.from({ length: n }, (_, i) => i)
  const bundles: number[][] = costs.map(() => [])
  const left = new Set(Array.from({ length: m }, (_, c) => c))
  for (let t = 0; left.size > 0; t++) {
    const i = turn[t % n]
    let pick = -1
    for (const c of left) if (pick < 0 || costs[i][c] < costs[i][pick] - EPS) pick = c
    bundles[i].push(pick)
    left.delete(pick)
  }
  return bundles
}

/**
 * Envy-cycle elimination for chores (Bhaskar, Sricharan, Vaish 2021): hand the next chore to someone who
 * envies nobody; if everybody envies somebody there is an envy cycle, so trade bundles along it so each member gets their favourite.
 */
export function envyCycle(costs: number[][]): number[][] {
  const n = costs.length
  const m = n ? costs[0].length : 0
  const bundles: number[][] = costs.map(() => [])
  const order = Array.from({ length: m }, (_, c) => c).sort((a, b) => Math.max(...costs.map((r) => r[b])) - Math.max(...costs.map((r) => r[a])))
  const envies = (i: number, j: number) => bundleCost(costs, i, bundles[j]) < bundleCost(costs, i, bundles[i]) - EPS
  for (const c of order) {
    for (;;) {
      const sink = Array.from({ length: n }, (_, i) => i).find((i) => Array.from({ length: n }, (_, j) => j).every((j) => j === i || !envies(i, j)))
      if (sink !== undefined) {
        bundles[sink].push(c)
        break
      }
      // everybody envies somebody, so following favourite bundles must hit a cycle
      // top trading: point at the bundle i likes best
      const next = (i: number) =>
        Array.from({ length: n }, (_, j) => j).reduce((best, j) => (bundleCost(costs, i, bundles[j]) < bundleCost(costs, i, bundles[best]) - EPS ? j : best), i)
      const path: number[] = []
      let cur = 0
      while (!path.includes(cur)) {
        path.push(cur)
        cur = next(cur)
      }
      const cycle = path.slice(path.indexOf(cur))
      const succ = cycle.map((i) => next(i))
      const old = bundles.map((b) => b.slice())
      cycle.forEach((i, k) => (bundles[i] = old[succ[k]]))
    }
  }
  return bundles
}

export interface Ef1Report {
  ef1: boolean
  /** envyFree[i][j]: i does not envy j outright */
  envyFree: boolean[][]
  /** ef1Pairs[i][j]: i does not envy j after dropping one of i's own chores */
  ef1Pairs: boolean[][]
  /** the chore i would drop to stop envying j (-1 if none needed / possible) */
  drop: number[][]
}

export function checkEF1(costs: number[][], bundles: number[][]): Ef1Report {
  const n = costs.length
  const envyFree = costs.map(() => new Array<boolean>(n).fill(true))
  const ef1Pairs = costs.map(() => new Array<boolean>(n).fill(true))
  const drop = costs.map(() => new Array<number>(n).fill(-1))
  for (let i = 0; i < n; i++) {
    const own = bundleCost(costs, i, bundles[i])
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const other = bundleCost(costs, i, bundles[j])
      if (own <= other + EPS) continue
      envyFree[i][j] = false
      const cheapest = bundles[i].reduce((best, c) => (best < 0 || costs[i][c] > costs[i][best] ? c : best), -1)
      if (cheapest >= 0 && own - costs[i][cheapest] <= other + EPS) {
        drop[i][j] = cheapest
      } else ef1Pairs[i][j] = false
    }
  }
  return { ef1: ef1Pairs.every((r) => r.every(Boolean)), envyFree, ef1Pairs, drop }
}

export const totalCost = (costs: number[][], bundles: number[][]) => bundles.reduce((s, b, i) => s + bundleCost(costs, i, b), 0)

/** Hill-climb on moves and swaps that cut the total time while the allocation stays EF1. */
export function improve(costs: number[][], start: number[][]): number[][] {
  let cur = start.map((b) => b.slice())
  let best = totalCost(costs, cur)
  const n = costs.length
  for (let guard = 0; guard < 10000; guard++) {
    let found: number[][] | null = null
    let foundCost = best - 1e-9
    const consider = (cand: number[][]) => {
      const t = totalCost(costs, cand)
      if (t < foundCost && checkEF1(costs, cand).ef1) {
        found = cand
        foundCost = t
      }
    }
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        if (a === b) continue
        for (const c of cur[a]) {
          const cand = cur.map((x) => x.slice())
          cand[a] = cand[a].filter((x) => x !== c)
          cand[b].push(c)
          consider(cand)
          if (a < b) {
            for (const d of cur[b]) {
              const sw = cur.map((x) => x.slice())
              sw[a] = sw[a].map((x) => (x === c ? d : x))
              sw[b] = sw[b].map((x) => (x === d ? c : x))
              consider(sw)
            }
          }
        }
      }
    }
    if (!found) break
    cur = found
    best = foundCost
  }
  return cur
}

export interface ScheduleWeek {
  /** owner[c] = person doing chore c this week */
  owner: number[]
}

/** Weekly schedule: either the same bundles every week, or bundles passed one person along each week. */
export function rotationSchedule(bundles: number[][], weeks: number, rotate: boolean): ScheduleWeek[] {
  const n = bundles.length
  const m = bundles.reduce((s, b) => s + b.length, 0)
  return Array.from({ length: weeks }, (_, w) => {
    const owner = new Array<number>(m).fill(0)
    bundles.forEach((b, k) => b.forEach((c) => (owner[c] = rotate ? (k + w) % n : k)))
    return { owner }
  })
}
