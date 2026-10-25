# claude-code-mods

Two small [Claude Code](https://code.claude.com) mods (hooks-module plugins) that make the session easier to read and drive.

| Mod | What it does | Where it shows |
|---|---|---|
| **context-meter** | A color-coded context window meter right above the prompt | Terminal and VS Code extension |
| **term-bar** | Footer buttons: 🕐 recent conversations, model picker, effort picker | Terminal only |

Requires Claude Code **2.1.287 or newer** (`claude --version`).

## context-meter

```
Context 48.3k / 1m (5%) · 918.7k free · claude-sonnet-5-5
██▌█████▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
● System prompt 4.4k  ● System tools 33.6k  ● MCP tools 818  ● Memory files 129
● Skills 6.7k  ● Messages 1.9k  ● Autocompact buffer 33.0k  ● Free space 918.7k
                                                                              ▼
```

- One bar segment and legend entry per `/context` category, each with a **fixed color**, so a category that drops out never shifts the others.
- The title turns to the warning color at 80% or more.
- Refreshes after every turn, on every prompt and right after `/model`.
- **▼** slides it shut (only **▲** stays), **/ctx** toggles it.
- Draws together with other plugins' bands (progress bars and the like) instead of replacing them.
- **Read-only**: it measures with the local `summary` estimate, so it sends no network requests, writes no files and never touches tool calls. Numbers can differ slightly from `/context`, which counts with the token-count API.

## term-bar (terminal only)

```
[ 🕐 ] [ Sonnet ▾ ] [ medium ▾ ]
```

- **🕐** expands this folder's last 7 conversations above the prompt: the conversation's title (or its first message when it has none yet) and how long ago. Click one to resume it; empty conversations are left out. **✕** or 🕐 again closes it.
- **Model ▾** / **effort ▾** expand the choices in place; the current one is highlighted.
- The VS Code extension already has all three, so term-bar draws nothing there.

Notes:
- The conversation list is read with PowerShell, so 🕐 is **Windows only**. The model and effort buttons work anywhere.
- Changing the model or effort runs `/model` or `/effort`, which leave a line in the transcript and also save your choice as the default for new sessions.

## Install

```
claude plugin marketplace add hyun8935181-ux/claude-code-mods
claude plugin install context-meter@claude-code-mods --scope user
claude plugin install term-bar@claude-code-mods --scope user
```

Then run `/reload-plugins` inside Claude Code (or start a new session). Install either one on its own; they do not depend on each other.

To update later: `claude plugin marketplace update claude-code-mods`, then `/reload-plugins`.

## Develop

```
claude plugin validate context-meter
claude plugin test context-meter
```

Each mod is a `hooks/register.tsx` module plus a `types/index.d.ts` state contract. See the plugin-authoring docs in Claude Code for the API.

## License

[MIT](LICENSE)
