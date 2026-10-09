// Rental harmony by Sperner's lemma (Su 1999), driven by "which room would you take?" answers.
//
// Prices live on the simplex {p : sum p = rent, p_j <= rent}. Write p_j = rent * (1 - (n-1) x_j / N)
// with x a lattice point (x_j >= 0 integers, sum N). A room with x_j = 0 costs the whole rent, so nobody
// picks it: the answer at x always lies in the carrier {j : x_j > 0}, which is exactly Sperner's boundary
// condition. The lattice is triangulated the Freudenthal way (moves e_m - e_{m+1}); owner(x) =
// sum (i+1) x_i mod n gives every small simplex n distinct owners. Following the path of "doors"
// (facets labelled with every room but the last) ends in a simplex whose n corners are n different
// people choosing n different rooms: an approximately envy-free price vector.

export class NeedAnswer {
  x: number[]
  constructor(x: number[]) {
    this.x = x
  }
}

export const vkey = (x: number[]) => x.join(',')

export function priceOf(x: number[], N: number, rent: number): number[] {
  const n = x.length
  return x.map((xj) => rent * (1 - ((n - 1) * xj) / N))
}

export function ownerOf(x: number[]): number {
  let s = 0
  x.forEach((xj, i) => (s += (i + 1) * xj))
  return s % x.length
}

/** Rooms a person may pick at x (those that do not cost the entire rent). */
export function carrierOf(x: number[]): number[] {
  return x.flatMap((xj, j) => (xj > 0 ? [j] : []))
}

export type HarmonyState =
  | { kind: 'ask'; x: number[]; owner: number; prices: number[]; rooms: number[] }
  | {
      kind: 'done'
      vertices: number[][]
      /** labels[k] = room chosen at vertex k by owners[k] */
      labels: number[]
      owners: number[]
      /** assignment[person] = room */
      assignment: number[]
      /** centroid of the corner prices */
      prices: number[]
      /** largest price change between neighbouring lattice points */
      step: number
    }
  | { kind: 'fail' }

function pivot(V: number[][], k: number): { simplex: number[][]; entry: number } | null {
  const d = V.length - 1
  if (d === 0) return null
  const combo = (a: number[], b: number[], c: number[]) => a.map((_, i) => a[i] + b[i] - c[i])
  let nv: number[]
  let simplex: number[][]
  let entry = k
  if (k === 0) {
    nv = combo(V[d], V[1], V[0])
    simplex = [...V.slice(1), nv]
    entry = d
  } else if (k === d) {
    nv = combo(V[0], V[d - 1], V[d])
    simplex = [nv, ...V.slice(0, d)]
    entry = 0
  } else {
    nv = combo(V[k - 1], V[k + 1], V[k])
    simplex = V.slice()
    simplex[k] = nv
  }
  return nv.every((x) => x >= 0) ? { simplex, entry } : null
}

/** The corner simplex of the face spanned by the first m rooms (vectors have length n). */
function cornerSimplex(n: number, m: number, N: number): number[][] {
  const v0 = new Array<number>(n).fill(0)
  v0[m - 1] = N
  const out = [v0]
  for (let t = 1; t < m; t++) {
    const v = out[t - 1].slice()
    v[m - 1 - t]++
    v[m - t]--
    out.push(v)
  }
  return out
}

/**
 * Replays the whole search from the recorded answers (answers: vertex key -> room).
 * Returns the next question, or the final simplex.
 */
export function runHarmony(n: number, N: number, rent: number, answers: Map<string, number>): HarmonyState {
  const label = (x: number[]) => {
    const a = answers.get(vkey(x))
    if (a === undefined) throw new NeedAnswer(x)
    return a
  }
  try {
    const m = n - 1
    // Breadth-first over the simplices of the face where room n-1 costs the whole rent;
    // every fully labelled one is a door into the main triangulation.
    const start = cornerSimplex(n, m, N)
    const seen = new Set<string>([start.map(vkey).sort().join('|')])
    const queue = [start]
    for (let qi = 0; qi < queue.length; qi++) {
      const F = queue[qi]
      const labs = new Set(F.map(label))
      if (labs.size === m) {
        const w = F[0].slice()
        w[n - 2]--
        w[n - 1]++
        if (w.every((x) => x >= 0)) {
          const found = walk([w, ...F], 0)
          if (found) return found
        }
      }
      for (let k = 0; k < F.length; k++) {
        const nb = pivot(F, k)
        if (!nb) continue
        const id = nb.simplex.map(vkey).sort().join('|')
        if (!seen.has(id)) {
          seen.add(id)
          queue.push(nb.simplex)
        }
      }
    }
    return { kind: 'fail' }
  } catch (e) {
    if (e instanceof NeedAnswer) {
      return { kind: 'ask', x: e.x, owner: ownerOf(e.x), prices: priceOf(e.x, N, rent), rooms: carrierOf(e.x) }
    }
    throw e
  }

  function walk(start: number[][], entry0: number): HarmonyState | null {
    let T = start
    let entry = entry0
    for (let iter = 0; iter < 1_000_000; iter++) {
      const labs = T.map(label)
      if (new Set(labs).size === n) {
        const owners = T.map(ownerOf)
        const assignment = new Array<number>(n).fill(-1)
        owners.forEach((o, k) => (assignment[o] = labs[k]))
        const ps = T.map((x) => priceOf(x, N, rent))
        const prices = ps[0].map((_, j) => ps.reduce((acc, p) => acc + p[j], 0) / n)
        return { kind: 'done', vertices: T, labels: labs, owners, assignment, prices, step: ((n - 1) * rent) / N }
      }
      const u = labs.findIndex((l, k) => k !== entry && l === labs[entry])
      if (u < 0) return null
      const nb = pivot(T, u)
      if (!nb) return null
      T = nb.simplex
      entry = nb.entry
    }
    return null
  }
}

/** Answers a quasi-linear person would give: the best room among the carrier, ties to the lowest index. */
export function bestRoom(values: number[], prices: number[], rooms: number[]): number {
  let best = rooms[0]
  for (const j of rooms) if (values[j] - prices[j] > values[best] - prices[best] + 1e-12) best = j
  return best
}

/** Runs the search to the end with simulated answers; returns the final state and the answers asked in order. */
export function simulateHarmony(values: number[][], rent: number, N: number) {
  const n = values.length
  const answers = new Map<string, number>()
  const order: { x: number[]; owner: number; room: number }[] = []
  for (;;) {
    const st = runHarmony(n, N, rent, answers)
    if (st.kind !== 'ask') return { state: st, answers, order }
    const room = bestRoom(values[st.owner], st.prices, st.rooms)
    answers.set(vkey(st.x), room)
    order.push({ x: st.x, owner: st.owner, room })
  }
}

/** Lattice resolution per number of rooms and precision level (0 quick, 1 normal, 2 fine). */
export function meshFor(n: number, level: number): number {
  const table: Record<number, number[]> = { 2: [16, 40, 100], 3: [9, 18, 30], 4: [4, 6, 8] }
  return (table[n] ?? table[4])[Math.max(0, Math.min(2, level))]
}
