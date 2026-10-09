// Envy-free rent division with maximin utility (Gal, Mash, Procaccia, Shah 2016).
import { maxAssignment } from './hungarian.ts'
import { solveLP } from './lp.ts'

/** Scale each person's bids so they sum to the rent (negative bids count as 0; an all-zero row becomes an even split). */
export function normalizeBids(bids: number[][], rent: number): number[][] {
  return bids.map((row) => {
    const pos = row.map((x) => (Number.isFinite(x) && x > 0 ? x : 0))
    const sum = pos.reduce((a, b) => a + b, 0)
    return sum > 0 ? pos.map((x) => (x * rent) / sum) : pos.map(() => rent / pos.length)
  })
}

export interface RentSolution {
  /** assignment[person] = room */
  assignment: number[]
  /** price per room; sums to the rent, may be negative */
  prices: number[]
  /** utility per person: value of own room minus its price */
  utilities: number[]
  welfare: number
  minUtility: number
}

export function solveRent(values: number[][], rent: number): RentSolution {
  const n = values.length
  const assignment = maxAssignment(values)
  // Work in units of the rent so the LP is well scaled.
  const s = rent > 0 ? rent : 1
  const v = values.map((r) => r.map((x) => x / s))
  // variables: p_0..p_{n-1} (free), t (free)
  const A: number[][] = []
  const b: number[] = []
  const rel: ('<=' | '=')[] = []
  const row = () => new Array<number>(n + 1).fill(0)
  const sum = row()
  for (let j = 0; j < n; j++) sum[j] = 1
  A.push(sum)
  b.push(rent / s)
  rel.push('=')
  for (let i = 0; i < n; i++) {
    const own = assignment[i]
    for (let j = 0; j < n; j++) {
      if (j === own) continue
      // v_i,own - p_own >= v_ij - p_j
      const r = row()
      r[own] = 1
      r[j] = -1
      A.push(r)
      b.push(v[i][own] - v[i][j])
      rel.push('<=')
    }
    // t <= v_i,own - p_own
    const r = row()
    r[n] = 1
    r[own] = 1
    A.push(r)
    b.push(v[i][own])
    rel.push('<=')
  }
  const c = row()
  c[n] = 1
  const res = solveLP({ c, A, b, rel, free: new Array(n + 1).fill(true) })
  if (res.status !== 'optimal') throw new Error('No envy-free prices found: ' + res.status)
  const prices = res.x.slice(0, n).map((x) => x * s)
  const utilities = assignment.map((room, i) => values[i][room] - prices[room])
  return {
    assignment,
    prices,
    utilities,
    welfare: assignment.reduce((acc, room, i) => acc + values[i][room], 0),
    minUtility: Math.min(...utilities),
  }
}

/** utility[i][j] = value person i puts on room j minus its price. */
export function utilityTable(values: number[][], prices: number[]): number[][] {
  return values.map((row) => row.map((x, j) => x - prices[j]))
}

/** Largest amount by which anyone would gain by swapping to another room (<= 0 means envy-free). */
export function maxEnvy(values: number[][], prices: number[], assignment: number[]): number {
  const u = utilityTable(values, prices)
  let worst = -Infinity
  u.forEach((row, i) => row.forEach((x, j) => j !== assignment[i] && (worst = Math.max(worst, x - row[assignment[i]]))))
  return worst
}

/** Round to cents (or `decimals`) so the rounded prices still sum to `total` (largest remainder). */
export function roundPrices(prices: number[], total: number, decimals = 2): number[] {
  const k = 10 ** decimals
  const scaled = prices.map((p) => p * k)
  const floors = scaled.map(Math.floor)
  let missing = Math.round(total * k) - floors.reduce((a, b) => a + b, 0)
  const order = scaled.map((x, i) => [x - floors[i], i]).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (missing <= 0) break
    floors[i]++
    missing--
  }
  return floors.map((x) => x / k)
}
