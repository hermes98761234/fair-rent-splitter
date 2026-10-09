import { useEffect, useState } from 'react'
import { Chores } from './components/Chores.tsx'
import { Harmony } from './components/Harmony.tsx'
import { RentResults } from './components/RentResults.tsx'
import { Setup } from './components/Setup.tsx'
import { decodeState, defaultState, encodeState, sanitize, type AppState, type Mode } from './lib/state.ts'

const KEY = 'fair-rent-splitter:v1'

function load(): { state: AppState; shared: boolean } {
  const fromHash = decodeState(location.hash)
  if (fromHash) return { state: fromHash, shared: true }
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? sanitize(JSON.parse(raw)) : null
    if (s) return { state: s, shared: false }
  } catch {
    // fall through to defaults
  }
  return { state: defaultState(), shared: false }
}

const TABS: [Mode, string][] = [
  ['rent', 'Rent by bids'],
  ['harmony', 'Rental harmony'],
  ['chores', 'Chores'],
]

export default function App() {
  const [{ state, shared }, setBoth] = useState(load)
  const [copied, setCopied] = useState(false)
  const set = (f: (s: AppState) => AppState) => setBoth((b) => ({ state: f(b.state), shared: b.shared }))
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // storage may be unavailable
    }
  }, [state])

  const share = async () => {
    const url = `${location.origin}${location.pathname}#s=${encodeState(state)}`
    history.replaceState(null, '', url)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">Fair Rent Splitter</span>
        <nav className="tabs" aria-label="Mode">
          {TABS.map(([m, label]) => (
            <button key={m} className={state.mode === m ? 'on' : ''} aria-pressed={state.mode === m} onClick={() => set((x) => ({ ...x, mode: m }))}>
              {label}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        <button onClick={share}>{copied ? 'Link copied' : 'Copy share link'}</button>
      </header>
      <div className="body">
        <Setup s={state} set={set} />
        <main className="main">
          {shared && (
            <div className="banner">
              Opened from a shared link. Your edits stay on this device until you copy a new link.
            </div>
          )}
          {state.mode === 'rent' && <RentResults s={state} />}
          {state.mode === 'harmony' && <Harmony s={state} />}
          {state.mode === 'chores' && <Chores s={state} set={set} />}
        </main>
      </div>
      <p className="hint foot">
        Everything runs in your browser. Rent method: Gal, Mash, Procaccia, Shah (2016); interactive mode: Su (1999).{' '}
        <a href="https://github.com/hermes98761234/fair-rent-splitter">Source</a>
      </p>
    </div>
  )
}
