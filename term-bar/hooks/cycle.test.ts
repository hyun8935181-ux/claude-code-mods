import { expect, test } from 'claude-code/testing'

import { EFFORTS, MODELS, aliasOf, label, nextOf } from './cycle'

test('model and effort helpers', async () => {
  expect(nextOf(MODELS, 'opus')).toBe('sonnet')
  expect(nextOf(MODELS, 'haiku')).toBe('opus')
  expect(nextOf(EFFORTS, 'max')).toBe('low')
  expect(nextOf(EFFORTS, '?')).toBe('low')
  expect(aliasOf('claude-opus-5-5')).toBe('opus')
  expect(aliasOf('custom-x')).toBe('custom-x')
  expect(label('sonnet')).toBe('Sonnet')
})
