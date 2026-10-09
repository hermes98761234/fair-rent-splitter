import { useMemo } from 'react'
import { toCsv, downloadText } from '../lib/csv.ts'
import { maxEnvy, normalizeBids, roundPrices, solveRent, utilityTable } from '../lib/rent.ts'
import type { AppState } from '../lib/state.ts'
import { money } from '../lib/format.ts'

export function RentResults({ s }: { s: AppState }) {
  const out = useMemo(() => {
    if (!(s.rent > 0)) return { error: 'Enter a total rent above zero.' as const }
    try {
      const values = normalizeBids(s.bids, s.rent)
      const sol = solveRent(values, s.rent)
      return { values, sol, shown: roundPrices(sol.prices, s.rent), table: utilityTable(values, sol.prices), envy: maxEnvy(values, sol.prices, sol.assignment) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not solve.' }
    }
  }, [s.bids, s.rent])
  if ('error' in out) return <div className="box err-text">{out.error}</div>
  const { sol, shown, table, envy, values } = out
  const cur = s.currency
  const roomOf = (i: number) => sol.assignment[i]
  const exportCsv = () => {
    const rows: (string | number)[][] = [['Person', 'Room', 'Price', 'Own value', 'Utility']]
    s.people.forEach((p, i) => rows.push([p, s.rooms[roomOf(i)], shown[roomOf(i)].toFixed(2), values[i][roomOf(i)].toFixed(2), sol.utilities[i].toFixed(2)]))
    rows.push([], ['Utility at final prices (value minus price)', ...s.rooms.map((r, j) => `${r} @ ${shown[j].toFixed(2)}`)])
    s.people.forEach((p, i) => rows.push([p, ...table[i].map((u) => u.toFixed(2))]))
    downloadText('fair-rent.csv', toCsv(rows))
  }
  return (
    <>
      <div className="box">
        <h3>Who takes which room</h3>
        <p className={`verdict ${envy < 1e-6 ? 'ok' : 'err'}`}>
          {envy < 1e-6 ? 'Envy-free: nobody would swap rooms at these prices.' : 'Not envy-free.'}
        </p>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Room</th><th>Roommate</th><th className="num">Pays</th><th className="num">Gets (utility)</th></tr>
            </thead>
            <tbody>
              {s.rooms.map((r, j) => {
                const i = sol.assignment.indexOf(j)
                return (
                  <tr key={j}>
                    <td>{r}</td>
                    <td>{s.people[i]}</td>
                    <td className={`num ${shown[j] < 0 ? 'neg' : ''}`}>{money(shown[j], cur)}</td>
                    <td className="num">{money(sol.utilities[i], cur)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr><th colSpan={2}>Total</th><th className="num">{money(shown.reduce((a, b) => a + b, 0), cur)}</th><th /></tr>
            </tfoot>
          </table>
        </div>
        {shown.some((p) => p < 0) && <p className="hint">A negative price means the others chip in to compensate whoever takes that room.</p>}
        <div className="row">
          <button onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      <div className="box">
        <h3>Why it is envy-free</h3>
        <p className="hint">
          Each cell is what the row's person would gain in that room: their value for it minus its price. Their own room (highlighted) has the largest number in their row, so nobody can do better by swapping. The assignment maximises total value (Hungarian algorithm); the prices were then chosen with a linear program to be envy-free while making the least happy person as happy as possible (maximin).
        </p>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Utility</th>{s.rooms.map((r, j) => <th key={j} className="num">{r}<br />@ {money(shown[j], cur, 0)}</th>)}</tr>
            </thead>
            <tbody>
              {s.people.map((p, i) => (
                <tr key={i}>
                  <td>{p}</td>
                  {table[i].map((u, j) => (
                    <td key={j} className={`num ${j === roomOf(i) ? 'own' : ''}`}>{money(u, cur)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Prices are shown to the cent; utilities are exact, so differences under one cent are rounding.</p>
      </div>
    </>
  )
}
