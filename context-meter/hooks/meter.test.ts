import { expect, test } from 'claude-code/testing'

import { cells, fmt, frames, legendRows, paint, widths } from './meter'

test('each category keeps its own color', async () => {
  expect(paint('Messages')).toBe('#8b5cf6')
  expect(paint('Free space')).toBe('#9ca3af')
  expect(paint('Custom agents')).toBe('#ec4899')
})

test('token labels and bar widths', async () => {
  expect(fmt(122700)).toBe('122.7k')
  expect(fmt(1_000_000)).toBe('1m')
  expect(fmt(999)).toBe('999')

  const rows = [10, 20, 70].map(tokens => ({ name: 'x', tokens, color: 'text', kind: 'used' as const }))
  const w = widths(rows, 100, 50)
  expect(w).toEqual([5, 10, 35])
  expect(w.reduce((a, b) => a + b, 0)).toBe(50)
  expect(widths(rows, 0, 50)).toEqual([0, 0, 0])
})

test('slide frames and legend rows', async () => {
  expect(frames(4, 0)).toEqual([3, 2, 1, 0])
  expect(frames(0, 4)).toEqual([1, 2, 3, 4])
  expect(cells('한글 1k')).toBe(7)
  expect(legendRows(['aaaa', 'bbbb'], 100)).toBe(1)
  expect(legendRows(['aaaa', 'bbbb', 'cccc'], 14)).toBe(2)
})
