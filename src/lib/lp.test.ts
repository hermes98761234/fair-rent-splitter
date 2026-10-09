import { expect, it } from 'vitest'
import { solveLP } from './lp.ts'

it('solves a textbook LP', () => {
  // max 3x+2y s.t. x+y<=4, x+3y<=6, x<=3  -> x=3,y=1, value 11
  const r = solveLP({ c: [3, 2], A: [[1, 1], [1, 3], [1, 0]], b: [4, 6, 3], rel: ['<=', '<=', '<='] })
  expect(r.status).toBe('optimal')
  if (r.status === 'optimal') {
    expect(r.value).toBeCloseTo(11)
    expect(r.x[0]).toBeCloseTo(3)
    expect(r.x[1]).toBeCloseTo(1)
  }
})

it('handles >=, = and free variables', () => {
  // min x+y (as max -x-y) s.t. x+y>=2, x-y=0 -> value -2
  const r = solveLP({ c: [-1, -1], A: [[1, 1], [1, -1]], b: [2, 0], rel: ['>=', '='] })
  expect(r.status === 'optimal' && r.value).toBeCloseTo(-2)
  // free variable: max t s.t. t <= -5  -> t=-5
  const f = solveLP({ c: [1], A: [[1]], b: [-5], rel: ['<='], free: [true] })
  expect(f.status === 'optimal' && f.x[0]).toBeCloseTo(-5)
})

it('detects infeasible and unbounded problems', () => {
  expect(solveLP({ c: [1], A: [[1], [1]], b: [1, 2], rel: ['<=', '>='] }).status).toBe('infeasible')
  expect(solveLP({ c: [1], A: [[1]], b: [1], rel: ['>='] }).status).toBe('unbounded')
})

it('survives a degenerate LP (Beale cycling example)', () => {
  const r = solveLP({
    c: [0.75, -150, 0.02, -6],
    A: [[0.25, -60, -0.04, 9], [0.5, -90, -0.02, 3], [0, 0, 1, 0]],
    b: [0, 0, 1],
    rel: ['<=', '<=', '<='],
  })
  expect(r.status === 'optimal' && r.value).toBeCloseTo(0.05)
})
