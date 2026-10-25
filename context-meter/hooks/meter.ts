import type { Row } from '../types'

export const fmt = (n: number) =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`

// A fixed color per category, matched on the engine's /context row name, so dropping one
// category never shifts the others' colors. Mid-saturation hues read on light and dark themes.
const COLORS: [RegExp, string][] = [
  [/system prompt/i, '#ef4444'],
  [/system tools/i, '#f97316'],
  [/mcp.*(instruction|server)/i, '#22c55e'],
  [/mcp/i, '#eab308'],
  [/memory/i, '#06b6d4'],
  [/skills/i, '#3b82f6'],
  [/messages/i, '#8b5cf6'],
  [/autocompact|buffer/i, '#475569'], // quiet dark grey
  [/free/i, '#9ca3af'], // light grey
]
export const paint = (name: string) => COLORS.find(([re]) => re.test(name))?.[1] ?? '#ec4899' // unknown: pink

// Bar cells per row. Cumulative rounding, so the total never exceeds cols.
export const widths = (rows: Row[], max: number, cols: number) => {
  let sum = 0
  let prev = 0

  return rows.map(r => {
    sum += r.tokens
    const end = max > 0 ? Math.min(cols, Math.round((sum / max) * cols)) : 0
    const w = Math.max(0, end - prev)
    prev = Math.max(prev, end)

    return w
  })
}

// Terminal cells: wide (CJK) characters take two.
export const cells = (s: string) =>
  [...s].reduce((n, c) => n + ((c.codePointAt(0) ?? 0) > 0x2e80 ? 2 : 1), 0)

// How many rows the legend wraps to at cols ('● ' before each item, two cells between items).
// An estimate for the slide animation's height.
export const legendRows = (items: string[], cols: number) => {
  let rows = 1
  let used = 0

  for (const s of items) {
    const w = 2 + cells(s)
    if (used > 0 && used + 2 + w > cols) {
      rows += 1
      used = w
    } else {
      used += (used > 0 ? 2 : 0) + w
    }
  }

  return rows
}

// Animation frames from -> to in steps (the last one is exactly to).
export const frames = (from: number, to: number, steps = 4) =>
  Array.from({ length: steps }, (_, i) => Math.round(from + ((to - from) * (i + 1)) / steps))
