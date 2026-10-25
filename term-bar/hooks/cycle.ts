export const MODELS = ['opus', 'sonnet', 'haiku']
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']

// The next value in the list; the first one for a value not in it.
export const nextOf = (list: readonly string[], cur: string) => list[(list.indexOf(cur) + 1) % list.length]

// A full model id (claude-opus-5-5) to its alias (opus). Unknown names pass through.
export const aliasOf = (model: string) => MODELS.find(m => model.toLowerCase().includes(m)) ?? model

export const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
