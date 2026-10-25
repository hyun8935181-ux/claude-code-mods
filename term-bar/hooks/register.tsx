import { atom, read, update } from 'claude-code'
import type { Engine, Next, Register, RenderInput } from 'claude-code'

import type { History, Pick } from '../types'
import { EFFORTS, MODELS, aliasOf, label } from './cycle'
import { ago, listCommand, parseList, pickRows } from './sessions'

const model = atom({ plugin: 'term-bar', key: 'model' } as const, '', { shape: 'model-1' })
const effort = atom({ plugin: 'term-bar', key: 'effort' } as const, '', { shape: 'effort-1' })
const picking = atom({ plugin: 'term-bar', key: 'picking' } as const, null as Pick, { shape: 'pick-1' })
const history = atom({ plugin: 'term-bar', key: 'history' } as const, { state: 'closed' } as History, {
  shape: 'history-2',
})

// 🕐: opens the list in the band above the prompt (loading...), then fills in this folder's
// last 7 conversations, empty ones left out. A pane would dock as a sidebar on a wide terminal,
// so the band it is. Pressing again closes it.
const toggleHistory = async ($: Engine) => {
  if ((await read($, history)).state !== 'closed') return update($, history, () => ({ state: 'closed' }))
  await update($, history, () => ({ state: 'loading' }))
  try {
    const cwd = await $.session.cwd()
    const { exitCode, stdout, stderr } = await $.process.run(listCommand(cwd))
    if (exitCode !== 0) throw new Error(stderr.trim() || `exit ${exitCode}`)
    const current = await $.session.id()
    const rows = pickRows(parseList(stdout), current)
    const now = await $.clock.now()
    await update($, history, () => ({ state: 'ok', rows, now, current }))
  } catch (err) {
    await update($, history, () => ({ state: 'error', text: String(err).slice(0, 200) }))
  }
}

// A /config row, when there is one, changes the setting quietly; otherwise the slash command
// runs (and leaves a line in the transcript).
const rowOf = async ($: Engine, re: RegExp) => (await $.config.list()).find(r => re.test(r.key))
const MODEL_ROW = /^model$/i
const EFFORT_ROW = /effort/i
// The engine exposes no way to read the effort, so the last one picked is kept in the
// cross-session store (/effort also saves it as the default for new sessions).
const EFFORT_KEY = 'effort'

const syncModel = async ($: Engine) => {
  const m = aliasOf(await $.session.model())
  await update($, model, () => m)
}

// Tries the /config row, then the slash command. True on success.
const apply = async ($: Engine, row: RegExp, command: string, value: string) => {
  const r = await rowOf($, row)
  if (r) {
    const { deny } = await $.config.set({ key: r.key, value })
    if (!deny) return true
  }
  if ((await $.command.list()).some(c => c.name === command)) {
    await $.command.run({ command, args: value })
    return true
  }
  $.ui.toast(`No way to change ${command} found in this version`)
  return false
}

// The mode labels at the bottom right (next to [ Progress ]). The VS Code extension already
// has all of this, so it draws on the terminal only. A press expands the choices in the same
// row: this slot is one row high, so a menu popping upward would be clipped.
const draw = async ($: Engine, e: RenderInput<"SessionMode">, next: Next<"ui.render">, isWide: boolean) => {
  if (e.surface !== 'terminal') return next(e)

  const below = await next(e)
  const { Box, Button } = $.ui.resolve(e)
  // Right after /clear the session values are empty: read the model from the engine and the
  // effort from the last pick (store) on the spot.
  const m = (await read($, model)) || aliasOf(await $.session.model())
  const ef = (await read($, effort)) || String((await $.store.get(EFFORT_KEY)) ?? '')
  const kind = await read($, picking)
  // Taking the terminal's width keeps the buttons on the bottom row instead of next to the status line.
  const row = isWide
    ? { gap: 1, width: Math.max(20, (e.viewport?.columns ?? 80) - 4), justifyContent: 'flex-end' as const }
    : { gap: 1 }

  const choose = async (v: string) => {
    await update($, picking, () => null)
    if (kind === 'effort') {
      if (await apply($, EFFORT_ROW, 'effort', v)) {
        await update($, effort, () => v)
        await $.store.set(EFFORT_KEY, v)
      }
    } else if (await apply($, MODEL_ROW, 'model', v)) {
      await update($, model, () => v)
    }
  }

  if (kind) {
    const list = kind === 'effort' ? EFFORTS : MODELS
    const cur = kind === 'effort' ? ef : m
    return (
      <Box {...row}>
        {below}
        {list.map(v => (
          <Button
            key={`pick-${v}`}
            variant={v === cur ? 'primary' : undefined}
            label={kind === 'effort' ? v : label(v)}
            onPress={() => choose(v)}
          />
        ))}
        <Button key="pick-close" label="✕" onPress={() => update($, picking, () => null)} />
      </Box>
    )
  }

  return (
    <Box {...row}>
      {below}
      <Button key="history" label="🕐" onPress={() => toggleHistory($)} />
      <Button key="model" label={`${label(m || 'model')} ▾`} onPress={() => update($, picking, () => 'model')} />
      <Button key="effort" label={`${ef || 'effort'} ▾`} onPress={() => update($, picking, () => 'effort')} />
    </Box>
  )
}


export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await syncModel($)
    const r = await rowOf($, EFFORT_ROW)
    if (typeof r?.value === 'string') await update($, effort, () => r.value as string)

    return next(e)
  })

  // Catches changes made another way (typing /model) whenever a prompt is sent.
  on('prompt.submit', ($, e, next) => {
    void syncModel($)

    return next(e)
  })

  // 🕐 list: drawn in the band above the prompt, other plugins' band below it. A press resumes
  // that conversation (/resume).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const hist = await read($, history) // never name it h: that is the JSX factory
    if (e.surface !== 'terminal' || e.props.hasSurvey || hist.state === 'closed') return next(e)

    const below = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const close = () => update($, history, () => ({ state: 'closed' }))
    const resume = async (id: string) => {
      await close()
      await $.command.run({ command: 'resume', args: id })
    }

    const body =
      hist.state === 'loading' ? (
        <Text dimColor>Loading…</Text>
      ) : hist.state === 'error' ? (
        <Text color="error">Could not read the list: {hist.text}</Text>
      ) : hist.rows.length === 0 ? (
        <Text dimColor>No conversations in this folder yet.</Text>
      ) : (
        <Box flexDirection="column">
          {hist.rows.map(r =>
            r.id === hist.current ? (
              // A Text takes no key: the Box carries it.
              <Box key={r.id}>
                <Text dimColor wrap="truncate-end">
                  ● {r.title} · current
                </Text>
              </Box>
            ) : (
              <Button key={r.id} plain onPress={() => resume(r.id)}>
                {r.title} <Text dimColor>{ago(r.mtime, hist.now)}</Text>
              </Button>
            ),
          )}
        </Box>
      )

    // The same rule above and below frames the list.
    const rule = (
      <Text dimColor wrap="truncate-end">
        {'─'.repeat(Math.max(10, e.props.bodyColumns))}
      </Text>
    )

    return (
      <Box flexDirection="column">
        {rule}
        <Box justifyContent="space-between">
          <Text weight="bold">Recent conversations</Text>
          <Button key="history-close" plain label="✕" onPress={close} />
        </Box>
        {body}
        {rule}
        {below}
      </Box>
    )
  })

  // If the width is refused, draw again without it so the buttons never vanish.
  on('ui.render', { component: 'SessionMode' }, ($, e, next) => draw($, e, next, true)).catch(($, e, next) =>
    draw($, e, next, false),
  )
}
