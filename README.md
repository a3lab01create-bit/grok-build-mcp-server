# grok-build-mcp-server

An [MCP](https://modelcontextprotocol.io) server that wraps the **xAI Grok Build CLI (`grok`)** so any MCP client (Claude Code, Claude Desktop, Codex, etc.) can query Grok through your local `grok` install.

Grok is particularly strong at **web research (incl. X/Twitter), direct critique / red-teaming, and code + analysis** — a useful counter-voice alongside other models.

## Why

`grok` runs headlessly (`grok -p "<prompt>" --output-format json`) and authenticates with your existing Grok login. This server exposes that headless mode as MCP tools — no extra API keys, it rides your existing Grok access. Responses are parsed from Grok's structured JSON output for robustness.

## Install

Requires [Grok Build](https://x.ai) (`grok`) installed and logged in:

```bash
grok -p "say pong"   # should print a response
```

### Register with Claude Code

```bash
claude mcp add grok-build -- npx -y @talabisaac/grok-build-mcp-server
```

Or add it manually:

```json
{
  "mcpServers": {
    "grok-build": {
      "command": "npx",
      "args": ["-y", "@talabisaac/grok-build-mcp-server"]
    }
  }
}
```

If `grok` is not on the spawned process's `PATH`, set its absolute path:

```json
{
  "mcpServers": {
    "grok-build": {
      "command": "npx",
      "args": ["-y", "@talabisaac/grok-build-mcp-server"],
      "env": { "GROK_CLI_PATH": "/home/you/.grok/bin/grok" }
    }
  }
}
```

## Tools

| Tool | Description | Args |
|------|-------------|------|
| `grok` | Query Grok (xAI) | `prompt` (required), `model`, `effort` |
| `web-search` | Web search incl. X/Twitter, Grok-synthesized | `query` (required), `summarize` |
| `ping` | Health check | `message` (optional) |
| `help` | List tools | — |

`effort` accepts: `low`, `medium`, `high`, `xhigh`, `max`. Include files in a prompt with the `@` prefix.

## Environment

| Variable | Purpose |
|----------|---------|
| `GROK_CLI_PATH` | Absolute path to the `grok` binary (default: `grok` on PATH) |
| `GROK_MCP_DEBUG` | Set to any value to enable debug logging on stderr |

## License

MIT © Isaac Yoon / TripleA Lab
