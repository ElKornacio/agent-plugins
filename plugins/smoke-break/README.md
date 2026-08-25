# Smoke Break

Smoke Break is a tiny Codex plugin that nudges the agent to step back and reassess a long-running turn. It records the start of each turn and, after a completed tool call, adds a short model-visible reflection prompt once per elapsed interval.

Its plugin icon is the smoking cigarette emoji: 🚬

The default interval is five minutes.

## Why it is fast

- One persistent Node.js process serves both hooks over MCP stdio.
- The server has no runtime dependencies and performs no file or network I/O.
- Turn state lives in a bounded in-memory `Map`.
- Each hook invocation is an object lookup plus a clock read.

Node.js 18 or newer must be available as `node` on `PATH`.

## How it works

1. `UserPromptSubmit` calls the MCP tool with `turn_start`.
2. `PostToolUse` calls the same tool with `tool_end`.
3. The server compares the current time with the saved turn start.
4. On the first tool completion in each five-minute bucket, it returns `hookSpecificOutput.additionalContext` for the agent.

This design is event-driven: no reminder can appear while the agent is idle or between tool calls. It also inherits the tool coverage of Codex lifecycle hooks; hosted tool calls that do not emit `PostToolUse` are not observed.

See the [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks) for lifecycle and MCP hook behavior.

## Configuration

Create `~/.smoke-break.env` in your home directory:

```dotenv
SMOKE_BREAK_INTERVAL_MS=300000
```

Smoke Break reads this file once on every `UserPromptSubmit`, so edits apply to the next turn without restarting the MCP server. The file value overrides `SMOKE_BREAK_INTERVAL_MS` from [`.mcp.json`](.mcp.json). If the file is absent, the MCP environment value is used; the built-in fallback is five minutes.

Set `SMOKE_BREAK_CONFIG_FILE` in the MCP process environment if you want to use a different file. `~` paths are supported on macOS, Linux, and Windows.

## Development

No install step is required:

```sh
npm test
npm run check
```

## Layout

- [`.codex-plugin/plugin.json`](.codex-plugin/plugin.json) — plugin manifest
- [`.mcp.json`](.mcp.json) — local stdio MCP server configuration
- [`hooks/hooks.json`](hooks/hooks.json) — Codex lifecycle hooks
- [`src/server.mjs`](src/server.mjs) — dependency-free MCP JSON-RPC server
- [`src/turn-tracker.mjs`](src/turn-tracker.mjs) — turn timing and reminder logic

Codex asks the user to trust plugin hooks before loading them.

## Installation

Smoke Break is distributed through the [ElKornacio Agent Plugins](https://github.com/ElKornacio/agent-plugins) marketplace. See the marketplace README for the current installation and update commands.
