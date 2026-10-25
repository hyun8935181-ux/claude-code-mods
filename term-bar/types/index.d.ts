export type Pick = 'model' | 'effort' | null

export type History =
  | { state: 'closed' }
  | { state: 'loading' }
  | { state: 'ok'; rows: { id: string; title: string; mtime: number }[]; now: number; current: string }
  | { state: 'error'; text: string }

declare module 'claude-code' {
  interface PluginState {
    // model, effort: the values the buttons show. picking: which choices are expanded. history: the 🕐 list
    'term-bar': { model: Shaped<string>; effort: Shaped<string>; picking: Shaped<Pick>; history: Shaped<History> }
  }
}
