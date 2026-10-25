import { expect, test } from 'claude-code/testing'

const FOOTER = { plugin: 'term-bar', component: 'SessionMode', surface: 'terminal', props: { modes: [] } } as const
const BAND = {
  plugin: 'term-bar',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('🕐 expands the recent conversations in the band', async ($, on) => {
  // Stands for the engine and the plugins below: each draws one word.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('session.cwd', () => ({ value: 'C:\\work' }))
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('store.get', () => ({ value: 'high' }))
  on('session.id', () => ({ value: 'now' }))
  on('clock.now', () => ({ value: 120_000 }))
  on('process.run', () => ({
    value: { exitCode: 0, stderr: '', stdout: '[{"id":"now","t":"this one","m":0},{"id":"old","t":"gearbox notes","m":0}]' },
  }))

  const footer = await $.ui.mount(FOOTER)
  // Even with empty session values (right after /clear) the engine's and the store's values show.
  expect((await footer.find({ key: 'model' }))?.text).toContain('Sonnet')
  expect((await footer.find({ key: 'effort' }))?.text).toContain('high')
  await footer.press({ key: 'history' })

  const band = await $.ui.mount(BAND)
  await band.drawn() // fails here if the tree is refused
  expect((await band.find({ key: 'old' }))?.text).toContain('gearbox notes')
  expect((await band.find({ type: 'Text', text: /current/ }))?.text).toContain('this one')

  await band.press({ key: 'history-close' })
  expect(await band.find({ key: 'old' })).toBeUndefined()
})
