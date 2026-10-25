// title '' means an empty conversation (no message was ever sent)
export type SessionRow = { id: string; title: string; mtime: number }

// The folder Claude Code keeps a project's transcripts in: the working directory with every
// character that is not a letter or digit turned into '-'.
export const projectDir = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, '-')

// One PowerShell run lists this folder's n newest transcripts with each one's last aiTitle and
// first user message. Searching the file finds those lines however large the transcript is
// (a mod's own file read stops at 4 MiB). Messages starting with '<' are slash-command records.
// Double quotes in the patterns are written \x22: they are stripped on the way to PowerShell.
const STR = '((?:[^\\x22\\\\]|\\\\.)*)'
export const listCommand = (cwd: string, n = 15) => [
  'powershell',
  '-NoProfile',
  '-Command',
  `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ` +
    `$d=Join-Path $env:USERPROFILE '.claude\\projects\\${projectDir(cwd)}'; ` +
    `Get-ChildItem $d -Filter *.jsonl | Sort-Object LastWriteTime -Descending | Select-Object -First ${n} | ForEach-Object { ` +
    `$h = Select-String -Path $_.FullName -Encoding UTF8 -Pattern '\\x22aiTitle\\x22:\\x22${STR}\\x22' | Select-Object -Last 1; ` +
    `$p = Select-String -Path $_.FullName -Encoding UTF8 -Pattern '\\x22role\\x22:\\x22user\\x22,\\x22content\\x22:\\x22${STR}\\x22' | ` +
    `Where-Object { $_.Matches[0].Groups[1].Value -notmatch '^<' } | Select-Object -First 1; ` +
    `[pscustomobject]@{ id = $_.BaseName; t = $(if ($h) { $h.Matches[0].Groups[1].Value } else { '' }); ` +
    `f = $(if ($p) { $p.Matches[0].Groups[1].Value } else { '' }); ` +
    `m = [int64](($_.LastWriteTimeUtc - [datetime]'1970-01-01').TotalMilliseconds) } } | ConvertTo-Json -Compress`,
]

// Unescapes \" \n and the like inside a JSON string; a broken one passes through as is.
const unescape = (s: string) => {
  try {
    return JSON.parse(`"${s}"`) as string
  } catch {
    return s
  }
}

// PowerShell's output (JSON: an object for one, an array for several) to rows.
// Without a title yet, the first message's first line stands in (50 characters). Neither: empty.
export const parseList = (stdout: string): SessionRow[] => {
  const text = stdout.trim()
  if (!text) return []
  type Raw = { id: string; t: string; f?: string; m: number }
  const raw = JSON.parse(text) as Raw | Raw[]
  return (Array.isArray(raw) ? raw : [raw]).map(r => {
    const first = unescape(r.f ?? '').split('\n')[0].trim()
    const title = unescape(r.t) || (first.length > 50 ? `${first.slice(0, 50)}…` : first)
    return { id: r.id, title, mtime: r.m }
  })
}

// The rows to show: empty conversations dropped, the current one kept, the newest n.
export const pickRows = (rows: SessionRow[], current: string, n = 7) =>
  rows.filter(r => r.title !== '' || r.id === current).slice(0, n)

// Minutes / hours / days ago
export const ago = (mtime: number, now: number) => {
  const s = Math.max(0, Math.round((now - mtime) / 1000))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
