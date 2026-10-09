import { MAX_CHORES, MAX_PEOPLE, PRESETS, withPeople, type AppState } from '../lib/state.ts'
import { NumInput } from './ui.tsx'

type Props = { s: AppState; set: (f: (s: AppState) => AppState) => void }

export function Setup({ s, set }: Props) {
  const n = s.people.length
  const rentMode = s.mode !== 'chores'
  return (
    <div className="side">
      <div className="section">
        <h3>Examples</h3>
        <div className="row">
          <button onClick={() => set((x) => ({ ...x, ...structuredClone(PRESETS.three) }))}>Flat of three</button>
          <button onClick={() => set((x) => ({ ...x, ...structuredClone(PRESETS.four) }))}>House of four</button>
        </div>
      </div>

      <div className="section">
        <h3>Roommates</h3>
        {s.people.map((p, i) => (
          <div className="row" key={i}>
            <input type="text" className="name" aria-label={`Name of roommate ${i + 1}`} value={p} maxLength={40} onChange={(e) => set((x) => ({ ...x, people: x.people.map((q, k) => (k === i ? e.target.value : q)) }))} />
            <button className="small danger" disabled={n <= 2} aria-label={`Remove ${p}`} onClick={() => set((x) => withPeople({ ...x, people: x.people.filter((_, k) => k !== i), rooms: x.rooms.filter((_, k) => k !== i), bids: x.bids.filter((_, k) => k !== i).map((r) => r.filter((_, k) => k !== i)), minutes: x.minutes.filter((_, k) => k !== i) }, n - 1))}>
              ✕
            </button>
          </div>
        ))}
        <button className="small" disabled={n >= MAX_PEOPLE} onClick={() => set((x) => withPeople(x, n + 1))}>
          + Add roommate
        </button>
        {rentMode && <p className="hint">There is one room per roommate.</p>}
      </div>

      {rentMode ? (
        <div className="section">
          <h3>Rent</h3>
          <div className="row">
            <label>
              Total rent{' '}
              <NumInput className="cell" label="Total rent" value={s.rent} onChange={(v) => set((x) => ({ ...x, rent: v }))} />
            </label>
            <label>
              Currency{' '}
              <input type="text" className="cell" style={{ width: 48, textAlign: 'center' }} maxLength={3} aria-label="Currency symbol" value={s.currency} onChange={(e) => set((x) => ({ ...x, currency: e.target.value }))} />
            </label>
          </div>
          <p className="hint">Each roommate says what every room is worth to them. Only the proportions matter: each row is rescaled to add up to the total rent.</p>
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Bids</th>
                  {s.rooms.map((r, j) => (
                    <th key={j}>
                      <input type="text" className="name" style={{ minWidth: 80 }} aria-label={`Name of room ${j + 1}`} value={r} maxLength={40} onChange={(e) => set((x) => ({ ...x, rooms: x.rooms.map((q, k) => (k === j ? e.target.value : q)) }))} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.people.map((p, i) => (
                  <tr key={i}>
                    <td>{p}</td>
                    {s.rooms.map((r, j) => (
                      <td key={j}>
                        <NumInput label={`${p}'s bid for ${r}`} value={s.bids[i][j]} onChange={(v) => set((x) => ({ ...x, bids: x.bids.map((row, a) => (a === i ? row.map((b, c) => (c === j ? v : b)) : row)) }))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="section">
          <h3>Chores and minutes</h3>
          <p className="hint">How many minutes per week would each person need for each chore? Honest, different numbers are the point: a fast cleaner and a slow one see the same chore differently.</p>
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Chore</th>
                  {s.people.map((p, i) => (
                    <th key={i} className="num">{p}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.chores.map((c, ci) => (
                  <tr key={ci}>
                    <td>
                      <input type="text" className="name" style={{ minWidth: 100 }} aria-label={`Name of chore ${ci + 1}`} value={c} maxLength={40} onChange={(e) => set((x) => ({ ...x, chores: x.chores.map((q, k) => (k === ci ? e.target.value : q)) }))} />
                    </td>
                    {s.people.map((p, i) => (
                      <td key={i}>
                        <NumInput label={`Minutes for ${p} to do ${c}`} value={s.minutes[i][ci]} onChange={(v) => set((x) => ({ ...x, minutes: x.minutes.map((row, a) => (a === i ? row.map((b, k) => (k === ci ? v : b)) : row)) }))} />
                      </td>
                    ))}
                    <td>
                      <button className="small danger" disabled={s.chores.length <= 1} aria-label={`Remove ${c}`} onClick={() => set((x) => ({ ...x, chores: x.chores.filter((_, k) => k !== ci), minutes: x.minutes.map((r) => r.filter((_, k) => k !== ci)) }))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="small" disabled={s.chores.length >= MAX_CHORES} onClick={() => set((x) => ({ ...x, chores: [...x.chores, `Chore ${x.chores.length + 1}`], minutes: x.minutes.map((r) => [...r, 30]) }))}>
            + Add chore
          </button>
        </div>
      )}
    </div>
  )
}
