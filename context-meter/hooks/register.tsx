import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

import type { Meter } from '../types'
import { fmt, frames, legendRows, paint, widths } from './meter'

const meter = atom({ plugin: 'context-meter', key: 'meter' } as const, null, {
  shape: 'meter-1',
})
// Open from the start.
const isOpen = atom({ plugin: 'context-meter', key: 'isOpen' } as const, true, {
  shape: 'open-2',
})
const rows = atom({ plugin: 'context-meter', key: 'rows' } as const, null, {
  shape: 'rows-1',
})

// The autocompact buffer is a dark fill, free space a light shade (colors come from paint).
const GLYPH = { used: '█', buffer: '█', free: '░' } as const

// Eases progress p (0-100) out and turns it into how many of `full` cells to show.
const wipe = (p: number, full: number) => Math.max(1, Math.round(full * (1 - (1 - p / 100) ** 2)))

// Read-only: `summary` estimates locally and sends no network request.
const measure = async ($: Engine): Promise<Meter | null> => {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })
    const b = context.breakdown
    if (!b) return null

    return {
      model: b.model,
      total: b.totalTokens,
      max: b.rawMaxTokens,
      percent: b.percentage,
      rows: b.categories.map(({ name, tokens, color, kind }) => ({ name, tokens, color, kind })),
    }
  } catch {
    // A failed refresh must never affect the session.
    return null
  }
}

const refresh = async ($: Engine) => {
  const next = await measure($)
  if (next) await update($, meter, () => next)
}

export const register: Register = on => {
  // Ignores presses mid-animation. Fine to lose on reload, so a module variable.
  let isSliding = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ctx',
      description: 'Show or hide the context meter',
    })
    // Clears an animation a reload cut short.
    await update($, rows, () => null)
    await refresh($)

    return next(e)
  })

  on('command.run', { command: 'ctx' }, async $ => {
    const wasOpen = await read($, isOpen)
    await refresh($)
    await update($, rows, () => null)
    await update($, isOpen, () => !wasOpen)

    return { text: wasOpen ? 'Context meter hidden.' : 'Context meter shown.' }
  })

  // After /model, update the model and window right away instead of after the next response.
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const ran = await next(e)
    await refresh($)

    return ran
  })

  // The VS Code extension switches models by click, with no /model command: refresh on every prompt too.
  on('prompt.submit', ($, e, next) => {
    void refresh($)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await refresh($)

    return next(e)
  })

  // The band right above the prompt: unlike a pane, it never moves to a side panel on a wide terminal.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Right after /clear the stored value is empty: measure on the spot (a render cannot store).
    const m = (await read($, meter)) ?? (await measure($))

    if (!m || e.props.hasSurvey) return next(e)

    // The band is one slot: draw what the plugins below drew (progress bars and so on) above ours.
    const below = await next(e)
    const open = await read($, isOpen)
    const slide = await read($, rows)
    const { Box, Button, Text } = $.ui.resolve(e)
    const cols = Math.max(10, e.props.bodyColumns)

    // Rows outside the window (deferred tool schemas) are left out.
    const list = m.rows
      .filter(r => r.kind !== 'deferred' && r.tokens > 0)
      .map(r => ({ ...r, paint: paint(r.name) }))
    const w = widths(list, m.max, cols)
    const free = m.rows.find(r => r.kind === 'free')?.tokens ?? Math.max(0, m.max - m.total)
    const items = list.map(r => `${r.name} ${fmt(r.tokens)}`)
    const height = 2 + legendRows(items, cols) // title + bar + legend

    // The arrow slides the content shut or open over a few frames.
    // The final state (isOpen) is set on press; the frames in between live in rows only.
    const toggle = async () => {
      if (isSliding) return
      isSliding = true
      // Settle the final state first: opening and closing work even if the animation fails.
      await update($, isOpen, () => !open)
      try {
        // rows = progress 0-100, ten frames; the render applies the easing.
        for (const p of open ? frames(100, 0, 10) : frames(0, 100, 10)) {
          await update($, rows, () => p)
          await $.clock.sleep(25)
        }
      } catch {
        // The animation is a nicety.
      } finally {
        await update($, rows, () => null)
        isSliding = false
      }
    }

    // ▼ collapses: bottom-right. Collapsed, only ▲ peeks out.
    const arrow = (
      <Box justifyContent="flex-end">
        <Button key="toggle" plain label={open ? '▼' : '▲'} onPress={toggle} />
      </Box>
    )

    const content = (
      <Box flexDirection="column">
        <Text weight="bold" color={m.percent >= 80 ? 'warning' : undefined}>
          Context {fmt(m.total)} / {fmt(m.max)} ({m.percent}%) · {fmt(free)} free · {m.model}
        </Text>
        <Text>
          {list.map((r, i) => (
            <Text color={r.paint}>{GLYPH[r.kind as keyof typeof GLYPH].repeat(w[i])}</Text>
          ))}
        </Text>
        <Box flexWrap="wrap" columnGap={2}>
          {list.map((r, i) => (
            <Box key={r.name} gap={1}>
              <Text color={r.paint}>●</Text>
              <Text>{items[i]}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    )

    return (
      <Box flexDirection="column">
        {below}
        {slide === null ? (
          open && content
        ) : (
          slide > 0 && (
            // Shrinks height and width together. The inner width stays fixed so text never rewraps.
            <Box height={wipe(slide, height)} width={wipe(slide, cols)} overflow="hidden">
              <Box width={cols} flexShrink={0}>
                {content}
              </Box>
            </Box>
          )
        )}
        {arrow}
      </Box>
    )
  })
}
