import { expect, test } from 'claude-code/testing'

import { ago, listCommand, parseList, pickRows, projectDir } from './sessions'

test('the PowerShell patterns are exactly the hand-tested ones', async () => {
  const cmd = listCommand('C:\\work')[3]
  expect(cmd).toContain(String.raw`'.claude\projects\C--work'`)
  expect(cmd).toContain(String.raw`-Pattern '\x22aiTitle\x22:\x22((?:[^\x22\\]|\\.)*)\x22'`)
  expect(cmd).toContain(String.raw`-Pattern '\x22role\x22:\x22user\x22,\x22content\x22:\x22((?:[^\x22\\]|\\.)*)\x22'`)
  expect(cmd).not.toContain('"') // double quotes get stripped on the way to PowerShell
})

test('session list helpers', async () => {
  expect(projectDir('C:\\work')).toBe('C--work')
  expect(projectDir('C:\\work\\my-app')).toBe('C--work-my-app')

  expect(parseList('')).toEqual([])
  expect(parseList('{"id":"a","t":"one","m":5}')).toEqual([{ id: 'a', title: 'one', mtime: 5 }])
  const rows = parseList(
    '[{"id":"a","t":"say \\\\\\"hi\\\\\\"","f":"","m":1},' +
      '{"id":"b","t":"","f":"fix the gearbox\\\\nsecond line","m":2},' +
      '{"id":"c","t":"","f":"","m":3}]',
  )
  expect(rows[0].title).toBe('say "hi"')
  expect(rows[1].title).toBe('fix the gearbox') // no title yet: first message's first line
  expect(rows[2].title).toBe('') // empty conversation

  // Empty ones are dropped, the current one stays even when empty, at most n.
  expect(pickRows(rows, 'x').map(r => r.id)).toEqual(['a', 'b'])
  expect(pickRows(rows, 'c').map(r => r.id)).toEqual(['a', 'b', 'c'])
  expect(pickRows(rows, 'x', 1).map(r => r.id)).toEqual(['a'])

  expect(ago(0, 30_000)).toBe('now')
  expect(ago(0, 120_000)).toBe('2m')
  expect(ago(0, 3 * 3600_000)).toBe('3h')
  expect(ago(0, 14 * 86400_000)).toBe('14d')
})
