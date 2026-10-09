export function money(x: number, cur: string, decimals = 2): string {
  const s = Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (Math.round(x * 10 ** decimals) < 0 ? '−' : '') + cur + s
}
