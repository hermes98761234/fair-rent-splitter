import { useState } from 'react'

/** Number field that lets you type freely and commits valid numbers. */
export function NumInput({ value, onChange, className = 'cell', label }: { value: number; onChange: (v: number) => void; className?: string; label?: string }) {
  const [text, setText] = useState(String(value))
  // Keep what the user typed ("1." or "") while it still means the same number.
  const shown = text === '' || Number(text) === value ? text : String(value)
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      className={className}
      aria-label={label}
      value={shown}
      onChange={(e) => {
        setText(e.target.value)
        const v = parseFloat(e.target.value)
        if (Number.isFinite(v)) onChange(v)
      }}
    />
  )
}
