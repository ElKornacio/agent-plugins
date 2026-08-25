# Agent Plugins

A curated marketplace of lightweight plugins for Codex and the ChatGPT desktop app.

## Install the marketplace

```sh
codex plugin marketplace add ElKornacio/agent-plugins --ref main
```

List the available plugins:

```sh
codex plugin list --marketplace agent-plugins --available --json
```

## Plugins

| Plugin | Description | Install |
| --- | --- | --- |
| [Smoke Break](plugins/smoke-break) | Periodically nudges the agent to reassess long-running turns. | `codex plugin add smoke-break@agent-plugins` |

Plugin hooks must be reviewed and trusted before Codex loads them. Smoke Break also requires Node.js 18 or newer to be available as `node` on `PATH`.

## Update

Refresh the marketplace snapshot:

```sh
codex plugin marketplace upgrade agent-plugins
```

Install the latest published plugin version:

```sh
codex plugin add smoke-break@agent-plugins
```

Start a new conversation after installing or updating a plugin so Codex picks up its hooks and MCP tools.

## Development

Each plugin is self-contained under [`plugins/`](plugins). The marketplace catalog lives at [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json).

Run all repository checks from the root:

```sh
npm run check
```

No dependency installation is currently required.

## License

[MIT](LICENSE)
