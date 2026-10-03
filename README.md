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
| `grok-result` | Collect an answer that was still running, waiting up to 50s per call | `job_id` (required), `wait_seconds` |
| `grok-cancel` | Cancel a still-running job and stop its `grok` process | `job_id` (required) |
| `ping` | Health check | `message` (optional) |
| `help` | List tools | — |

`effort` accepts: `low`, `medium`, `high`, `xhigh`, `max`. Include files in a prompt with the `@` prefix.

### Long-running queries and 60-second client timeouts

Grok answers often take 20–90 seconds, and deep research at higher `effort` can take several minutes. Some MCP clients cancel any tool call after about 60 seconds no matter what; the Claude desktop app does this and ignores `MCP_TOOL_TIMEOUT` ([anthropics/claude-code#63379](https://github.com/anthropics/claude-code/issues/63379)).

So `grok` and `web-search` run Grok as a background job and wait for it for up to 45 seconds (`GROK_SYNC_WAIT_SECONDS`). If the answer is ready, it is returned as before. If not, the call returns a `job_id` instead of being cut off; `grok-result` then waits at most 50 seconds per call until the answer is ready. Set `GROK_SYNC_WAIT_SECONDS=0` to always wait for the answer in one call, for clients without such a limit.

When a client cancels a call, the server stops the `grok` process instead of leaving it running.

### Background workflows are disabled

For research-style prompts ("research thoroughly ...") grok may start its `workflow` tool, which runs the research in the background and reports back later. A one-shot `grok -p` never receives that report: in our tests the call either returned only a "research in progress" note, or grok finished its answer and then kept the process alive waiting for the workflow. The server therefore passes `--disallowed-tools workflow`; grok then does the research inline and exits with the full answer (about 5 minutes for a deep `effort: high` question). Override with `GROK_DISALLOWED_TOOLS`.

## Environment

| Variable | Purpose |
|----------|---------|
| `GROK_CLI_PATH` | Absolute path to the `grok` binary (default: `grok` on PATH) |
| `GROK_SYNC_WAIT_SECONDS` | How long `grok` / `web-search` wait before returning a `job_id` (default: `45`, `0` always waits for the answer) |
| `GROK_DISALLOWED_TOOLS` | Built-in grok tools to remove, comma-separated (default: `workflow`, see above; empty string allows all) |
| `GROK_TIMEOUT_MS` | Kill a `grok` process after this many ms (default: `600000`, `0` disables) |
| `GROK_MCP_DEBUG` | Set to any value to enable debug logging on stderr |

## License

MIT © Isaac Yoon / TripleA Lab
