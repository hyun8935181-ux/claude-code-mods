export type Row = {
  name: string
  tokens: number
  color: string
  kind: 'used' | 'free' | 'buffer' | 'deferred'
}
export type Meter = {
  model: string
  total: number
  max: number
  percent: number
  rows: Row[]
}

declare module 'claude-code' {
  interface PluginState {
    'context-meter': {
      meter: Shaped<Meter | null>
      isOpen: Shaped<boolean>
      // Slide progress 0-100; null when not animating.
      rows: Shaped<number | null>
    }
  }
}
