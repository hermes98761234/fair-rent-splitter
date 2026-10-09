import { useMemo } from 'react'
import { bundleCost, checkEF1, envyCycle, improve, roundRobin, rotationSchedule, totalCost } from '../lib/chores.ts'
import { downloadText, toCsv } from '../lib/csv.ts'
import type { AppState } from '../lib/state.ts'

export function Chores({ s, set }: { s: AppState; set: (f: (s: AppState) => AppState) => void }) {
  const costs = s.minutes
  const { bundles, report, base } = useMemo(() => {
    const base = s.method === 'envy-cycle' ? envyCycle(costs) : roundRobin(costs)
    const bundles = s.improve ? improve(costs, base) : base
    return { bundles, base, report: checkEF1(costs, bundles) }
  }, [costs, s.method, s.improve])
  const n = s.people.length
  const schedule = rotationSchedule(bundles, s.weeks, s.rotate)
  const weekMinutes = (w: number, p: number) => schedule[w].owner.reduce((sum, o, c) => sum + (o === p ? costs[p][c] : 0), 0)

  const exportAlloc = () => {
    const rows: (string | number)[][] = [['Person', 'Chores', 'Minutes per week']]
    s.people.forEach((p, i) => rows.push([p, bundles[i].map((c) => s.chores[c]).join('; '), bundleCost(costs, i, bundles[i])]))
    downloadText('chores-allocation.csv', toCsv(rows))
  }
  const exportSchedule = () => {
    const rows: (string | number)[][] = [['Chore', ...schedule.map((_, w) => `Week ${w + 1}`)]]
    s.chores.forEach((c, ci) => rows.push([c, ...schedule.map((wk) => s.people[wk.owner[ci]])]))
    rows.push(['Minutes (total)'], ...s.people.map((p, i) => [p, ...schedule.map((_, w) => weekMinutes(w, i))]))
    downloadText('chores-schedule.csv', toCsv(rows))
  }
  const bundleOwner = (j: number) => s.people[j]
  return (
    <>
      <div className="box">
        <h3>Method</h3>
        <div className="row">
          <select aria-label="Method" value={s.method} onChange={(e) => set((x) => ({ ...x, method: e.target.value as AppState['method'] }))}>
            <option value="round-robin">Round-robin: take turns picking your cheapest chore</option>
            <option value="envy-cycle">Envy-cycle elimination</option>
          </select>
          <label>
            <input type="checkbox" checked={s.improve} onChange={(e) => set((x) => ({ ...x, improve: e.target.checked }))} /> Cut total time while staying EF1
          </label>
        </div>
        <p className={`verdict ${report.ef1 ? 'ok' : 'err'}`}>
          {report.ef1 ? 'Envy-free up to one chore (EF1): nobody would prefer another bundle once they drop one of their own chores.' : 'Not EF1.'}
        </p>
        <p className="hint">
          Total {totalCost(costs, bundles)} min per week{s.improve && totalCost(costs, base) > totalCost(costs, bundles) ? ` (the plain method gave ${totalCost(costs, base)})` : ''}.
        </p>
      </div>

      <div className="box">
        <h3>Allocation</h3>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Roommate</th><th>Chores</th><th className="num">Min / week</th></tr>
            </thead>
            <tbody>
              {s.people.map((p, i) => (
                <tr key={i}>
                  <td>{p}</td>
                  <td>{bundles[i].length ? bundles[i].slice().sort((a, b) => a - b).map((c) => s.chores[c]).join(', ') : '–'}</td>
                  <td className="num">{bundleCost(costs, i, bundles[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row"><button onClick={exportAlloc}>Export CSV</button></div>
      </div>

      <div className="box">
        <h3>Why it is fair</h3>
        <p className="hint">Each cell is how long the row's person would need for that column's bundle, by their own estimates. Their own bundle is highlighted. Where a cell is lower than their own, they envy that bundle, but the note shows the single chore they could drop to be fine with it.</p>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Minutes</th>{s.people.map((_, j) => <th key={j} className="num">{bundleOwner(j)}'s bundle</th>)}</tr>
            </thead>
            <tbody>
              {s.people.map((p, i) => (
                <tr key={i}>
                  <td>{p}</td>
                  {s.people.map((_, j) => {
                    const v = bundleCost(costs, i, bundles[j])
                    const dropped = report.drop[i][j]
                    return (
                      <td key={j} className={`num ${i === j ? 'own' : ''}`}>
                        {v}
                        {i !== j && !report.envyFree[i][j] && <div className="hint" style={{ margin: 0 }}>{dropped >= 0 ? `envy gone without ${s.chores[dropped]}` : 'envy!'}</div>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="box">
        <h3>Weekly schedule</h3>
        <div className="row">
          <label>Weeks <input type="number" className="cell" min={1} max={52} value={s.weeks} onChange={(e) => set((x) => ({ ...x, weeks: Math.min(52, Math.max(1, Math.round(+e.target.value) || 1)) }))} /></label>
          <label>
            <input type="checkbox" checked={s.rotate} onChange={(e) => set((x) => ({ ...x, rotate: e.target.checked }))} /> Pass bundles along each week
          </label>
        </div>
        <p className="hint">
          {s.rotate
            ? `With ${n} bundles passed along, everyone does every bundle once every ${n} weeks. Individual weeks stay fair on average rather than EF1 each week.`
            : 'Everyone keeps the same bundle every week, which is the EF1 allocation above.'}
        </p>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Chore</th>{schedule.map((_, w) => <th key={w}>W{w + 1}</th>)}</tr>
            </thead>
            <tbody>
              {s.chores.map((c, ci) => (
                <tr key={ci}>
                  <td>{c}</td>
                  {schedule.map((wk, w) => <td key={w}>{s.people[wk.owner[ci]]}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {s.people.map((p, i) => (
                <tr key={i}>
                  <th>{p} (min)</th>
                  {schedule.map((_, w) => <th key={w}>{weekMinutes(w, i)}</th>)}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        <div className="row"><button onClick={exportSchedule}>Export schedule CSV</button></div>
      </div>
    </>
  )
}
