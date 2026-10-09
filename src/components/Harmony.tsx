import { useMemo, useState } from 'react'
import { meshFor, runHarmony, simulateHarmony, vkey } from '../lib/harmony.ts'
import { downloadText, toCsv } from '../lib/csv.ts'
import { normalizeBids, roundPrices, solveRent } from '../lib/rent.ts'
import type { AppState } from '../lib/state.ts'
import { money } from '../lib/format.ts'

const LEVELS = ['Quick', 'Normal', 'Fine']

export function Harmony({ s }: { s: AppState }) {
  const n = s.people.length
  const [level, setLevel] = useState(1)
  const N = meshFor(n, level)
  const sig = `${n}|${N}|${s.rent}`
  const [rec, setRec] = useState<{ sig: string; list: [string, number][]; simulated: boolean }>({ sig, list: [], simulated: false })
  const list = useMemo(() => (rec.sig === sig ? rec.list : []), [rec, sig])
  const simulated = rec.sig === sig && rec.simulated
  const state = useMemo(() => runHarmony(n, N, s.rent, new Map(list)), [n, N, s.rent, list])
  const cur = s.currency
  const step = ((n - 1) * s.rent) / N

  const answer = (key: string, room: number) => setRec({ sig, list: [...list, [key, room]], simulated: false })
  const simulate = () => {
    const sim = simulateHarmony(normalizeBids(s.bids, s.rent), s.rent, N)
    setRec({ sig, list: sim.order.map((o) => [vkey(o.x), o.room]), simulated: true })
  }
  const exact = useMemo(() => (simulated ? solveRent(normalizeBids(s.bids, s.rent), s.rent) : null), [simulated, s.bids, s.rent])

  return (
    <>
      <div className="box">
        <h3>Rental harmony (Sperner's lemma)</h3>
        <p className="hint">
          No bids needed. The app proposes a price list, asks one roommate "which room would you take at these prices?", and uses the answer to decide which prices to try next. A path of such questions ends at a price list where each of {n} people picks a different room, so nobody wants to swap. Pass the device around: the name shown is whose answer is needed.
        </p>
        <div className="row">
          <label>
            Precision{' '}
            <select value={level} onChange={(e) => setLevel(+e.target.value)}>
              {LEVELS.map((l, i) => <option key={l} value={i}>{l} (about {money(step * (meshFor(n, 1) / meshFor(n, i)), cur, 0)} steps)</option>)}
            </select>
          </label>
          <button disabled={!list.length} onClick={() => setRec({ sig, list: list.slice(0, -1), simulated: false })}>Undo</button>
          <button disabled={!list.length} onClick={() => setRec({ sig, list: [], simulated: false })}>Restart</button>
          <button onClick={simulate} title="Answer every question automatically using the bids from the sidebar">Answer from the bids</button>
        </div>
        {n > 4 && <p className="err-text">Interactive mode supports up to 4 roommates. Remove a roommate or use the bidding mode.</p>}
      </div>

      {n <= 4 && state.kind === 'ask' && (
        <div className="box question">
          <p className="hint">Question {list.length + 1}</p>
          <p className="who">{s.people[state.owner]}</p>
          <p>At these prices, which room would you take?</p>
          <div className="choices">
            {state.rooms.map((j) => (
              <button key={j} onClick={() => answer(vkey(state.x), j)}>
                <span>{s.rooms[j]}</span>
                <span className={`price ${state.prices[j] < 0 ? 'neg' : ''}`}>{money(state.prices[j], cur, 0)}</span>
              </button>
            ))}
          </div>
          <p className="hint">
            Total rent {money(s.rent, cur, 0)}.{state.prices.some((p) => p < 0) ? ' A negative price means you would be paid to take that room.' : ''}
            {state.rooms.length < n ? ' Rooms left out would cost the whole rent.' : ''}
          </p>
        </div>
      )}

      {n <= 4 && state.kind === 'done' && (
        <div className="box">
          <h3>Result after {list.length} answers</h3>
          <p className="verdict ok">Everyone picked a different room at nearly these prices.</p>
          <div className="scroll">
            <table className="data">
              <thead>
                <tr><th>Room</th><th>Roommate</th><th className="num">Pays (about)</th>{exact && <th className="num">Exact (from bids)</th>}</tr>
              </thead>
              <tbody>
                {s.rooms.map((r, j) => {
                  const i = state.assignment.indexOf(j)
                  const shown = roundPrices(state.prices, s.rent, 0)
                  return (
                    <tr key={j}>
                      <td>{r}</td>
                      <td>{s.people[i]}</td>
                      <td className="num">{money(shown[j], cur, 0)}</td>
                      {exact && <td className="num">{money(exact.prices[j], cur, 0)}{exact.assignment[i] === j ? '' : ' (other tenant)'}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">
            The price list is the average of {n} corner price lists that differ by at most {money(step, cur, 0)} per room, so each person's best room is within about {money(2 * step, cur, 0)} of the one assigned. Pick Fine precision for a tighter answer. Prices sum to the rent.
          </p>
          <div className="row">
            <button onClick={() => downloadText('rental-harmony.csv', toCsv([['Room', 'Roommate', 'Price'], ...s.rooms.map((r, j) => [r, s.people[state.assignment.indexOf(j)], roundPrices(state.prices, s.rent, 0)[j]])]))}>Export CSV</button>
          </div>
        </div>
      )}
      {n <= 4 && state.kind === 'fail' && <div className="box err-text">The search did not finish. Check that each answer is a room you would really take, or restart.</div>}
    </>
  )
}
