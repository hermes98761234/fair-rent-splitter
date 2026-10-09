// A small dense two-phase simplex solver (Bland's rule, so it cannot cycle).
// maximise c·x  subject to  A x (<= | >= | =) b,  x >= 0 unless marked free.

export type Rel = '<=' | '>=' | '='
export interface LP {
  c: number[]
  A: number[][]
  b: number[]
  rel: Rel[]
  /** free[j] = true lets variable j take any sign. */
  free?: boolean[]
}
export type LPResult = { status: 'optimal'; x: number[]; value: number } | { status: 'infeasible' | 'unbounded' }

const EPS = 1e-9

export function solveLP(lp: LP): LPResult {
  // A free variable becomes the difference of two non-negative ones.
  const cols: { j: number; sign: 1 | -1 }[] = []
  lp.c.forEach((_, j) => {
    cols.push({ j, sign: 1 })
    if (lp.free?.[j]) cols.push({ j, sign: -1 })
  })
  const res = simplex(
    cols.map(({ j, sign }) => sign * lp.c[j]),
    lp.A.map((row) => cols.map(({ j, sign }) => sign * row[j])),
    lp.b,
    lp.rel,
  )
  if (res.status !== 'optimal') return res
  const x = lp.c.map(() => 0)
  cols.forEach(({ j, sign }, k) => (x[j] += sign * res.x[k]))
  return { status: 'optimal', x, value: res.value }
}

function simplex(c: number[], A: number[][], b: number[], rel: Rel[]): LPResult {
  const m = A.length
  const n = c.length
  const rows = A.map((r) => r.slice())
  const rhs = b.slice()
  const rl = rel.slice()
  for (let i = 0; i < m; i++) {
    if (rhs[i] < 0) {
      rows[i] = rows[i].map((v) => -v)
      rhs[i] = -rhs[i]
      rl[i] = rl[i] === '<=' ? '>=' : rl[i] === '>=' ? '<=' : '='
    }
  }
  const nSlack = rl.filter((r) => r !== '=').length
  const nArt = rl.filter((r) => r !== '<=').length
  const artStart = n + nSlack
  const total = artStart + nArt
  const T: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(total + 1).fill(0))
  const basis: number[] = new Array(m).fill(0)
  let s = n
  let a = artStart
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) T[i][j] = rows[i][j]
    T[i][total] = rhs[i]
    if (rl[i] === '<=') {
      T[i][s] = 1
      basis[i] = s++
    } else {
      if (rl[i] === '>=') T[i][s++] = -1
      T[i][a] = 1
      basis[i] = a++
    }
  }

  const pivot = (r: number, e: number) => {
    const p = T[r][e]
    for (let j = 0; j <= total; j++) T[r][j] /= p
    for (let i = 0; i <= m; i++) {
      if (i === r) continue
      const f = T[i][e]
      if (f === 0) continue
      for (let j = 0; j <= total; j++) T[i][j] -= f * T[r][j]
    }
    basis[r] = e
  }
  const run = (maxCol: number): 'optimal' | 'unbounded' => {
    for (let iter = 0; iter < 100000; iter++) {
      let e = -1
      for (let j = 0; j < maxCol; j++) {
        if (T[m][j] < -EPS) {
          e = j
          break
        }
      }
      if (e < 0) return 'optimal'
      let r = -1
      let best = Infinity
      for (let i = 0; i < m; i++) {
        if (T[i][e] > EPS) {
          const ratio = T[i][total] / T[i][e]
          if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[r])) {
            best = ratio
            r = i
          }
        }
      }
      if (r < 0) return 'unbounded'
      pivot(r, e)
    }
    return 'optimal'
  }
  const eliminateBasics = () => {
    for (let i = 0; i < m; i++) {
      const f = T[m][basis[i]]
      if (f !== 0) for (let j = 0; j <= total; j++) T[m][j] -= f * T[i][j]
    }
  }

  if (nArt > 0) {
    // Phase 1: maximise -(sum of artificials).
    for (let j = artStart; j < total; j++) T[m][j] = 1
    eliminateBasics()
    run(total)
    if (T[m][total] < -1e-7) return { status: 'infeasible' }
    for (let i = 0; i < m; i++) {
      if (basis[i] < artStart) continue
      const e = T[i].findIndex((v, j) => j < artStart && Math.abs(v) > 1e-7)
      if (e >= 0) pivot(i, e) // otherwise the row is redundant and stays at zero
    }
  }
  // Phase 2: the real objective, never letting an artificial column back in.
  T[m].fill(0)
  for (let j = 0; j < n; j++) T[m][j] = -c[j]
  eliminateBasics()
  if (run(artStart) === 'unbounded') return { status: 'unbounded' }
  const x = new Array<number>(n).fill(0)
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][total]
  return { status: 'optimal', x, value: T[m][total] }
}
