// App state, defaults, presets, sanitising and URL-hash sharing.

export type Mode = 'rent' | 'harmony' | 'chores'
export type Method = 'round-robin' | 'envy-cycle'

export interface AppState {
  mode: Mode
  people: string[]
  rent: number
  currency: string
  rooms: string[]
  /** bids[person][room] */
  bids: number[][]
  chores: string[]
  /** minutes[person][chore] */
  minutes: number[][]
  method: Method
  improve: boolean
  weeks: number
  rotate: boolean
}

export const MAX_PEOPLE = 8
export const MAX_CHORES = 20

export const PRESETS: Record<string, Omit<AppState, 'mode'>> = {
  three: {
    people: ['Alex', 'Sam', 'Jo'],
    rent: 2400,
    currency: '$',
    rooms: ['Master (en suite)', 'Middle', 'Box room'],
    bids: [[1100, 800, 500], [900, 900, 600], [800, 700, 900]],
    chores: ['Dishes', 'Bathroom', 'Vacuum', 'Bins & recycling', 'Kitchen surfaces', 'Shared laundry'],
    minutes: [[60, 45, 30, 15, 30, 40], [40, 70, 35, 10, 25, 30], [50, 30, 40, 20, 35, 60]],
    method: 'round-robin',
    improve: true,
    weeks: 6,
    rotate: true,
  },
  four: {
    people: ['Mia', 'Leo', 'Ana', 'Raj'],
    rent: 3600,
    currency: '$',
    rooms: ['Front double', 'Back double', 'Attic', 'Study'],
    bids: [[1500, 1000, 700, 400], [900, 1100, 900, 700], [800, 800, 1100, 900], [1200, 700, 900, 800]],
    chores: ['Dishes', 'Bathroom', 'Floors', 'Bins', 'Kitchen', 'Laundry', 'Garden', 'Shopping'],
    minutes: [
      [60, 45, 40, 10, 30, 40, 50, 60],
      [40, 70, 35, 15, 25, 30, 20, 45],
      [50, 30, 50, 10, 35, 60, 40, 30],
      [45, 50, 30, 20, 40, 35, 60, 35],
    ],
    method: 'envy-cycle',
    improve: true,
    weeks: 8,
    rotate: true,
  },
}

export const defaultState = (): AppState => ({ mode: 'rent', ...structuredClone(PRESETS.three) })

const str = (x: unknown, d: string) => (typeof x === 'string' ? x.slice(0, 40) : d)
const num = (x: unknown, d: number, lo = 0, hi = 1e9) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d)

/** Validates untrusted data (localStorage, URL hash) and fixes matrix sizes. Returns null if unusable. */
export function sanitize(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = defaultState()
  if (!Array.isArray(r.people) || r.people.length < 2 || r.people.length > MAX_PEOPLE) return null
  const n = r.people.length
  const people = r.people.map((p, i) => str(p, `Person ${i + 1}`))
  const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
  const rooms = Array.from({ length: n }, (_, j) => str(arr(r.rooms)[j], `Room ${j + 1}`))
  const bids = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => num(arr(arr(r.bids)[i])[j], 0)))
  const m = Math.min(MAX_CHORES, Math.max(1, arr(r.chores).length || 1))
  const chores = Array.from({ length: m }, (_, c) => str(arr(r.chores)[c], `Chore ${c + 1}`))
  const minutes = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, c) => num(arr(arr(r.minutes)[i])[c], 30)))
  return {
    mode: r.mode === 'harmony' || r.mode === 'chores' ? r.mode : 'rent',
    people,
    rent: num(r.rent, d.rent, 0, 1e7),
    currency: str(r.currency, '$').slice(0, 3),
    rooms,
    bids,
    chores,
    minutes,
    method: r.method === 'envy-cycle' ? 'envy-cycle' : 'round-robin',
    improve: r.improve !== false,
    weeks: Math.round(num(r.weeks, 6, 1, 52)),
    rotate: r.rotate !== false,
  }
}

function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export const encodeState = (s: AppState) => toB64(JSON.stringify(s))

export function decodeState(hash: string): AppState | null {
  try {
    const m = /^#?s=([A-Za-z0-9_-]+)$/.exec(hash)
    return m ? sanitize(JSON.parse(fromB64(m[1]))) : null
  } catch {
    return null
  }
}

/** Resize every matrix when the number of people changes. */
export function withPeople(s: AppState, n: number): AppState {
  const people = Array.from({ length: n }, (_, i) => s.people[i] ?? `Person ${i + 1}`)
  const rooms = Array.from({ length: n }, (_, j) => s.rooms[j] ?? `Room ${j + 1}`)
  const bids = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => s.bids[i]?.[j] ?? Math.round(s.rent / n)))
  const minutes = Array.from({ length: n }, (_, i) => s.chores.map((_, c) => s.minutes[i]?.[c] ?? 30))
  return { ...s, people, rooms, bids, minutes }
}
