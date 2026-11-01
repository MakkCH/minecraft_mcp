# minecraft_mcp

A companion Agent Skill and small local MCP bridge to the player's Minecraft client: execute JsMacros scripts, read incremental output, stop, screenshot, and display colored Agent progress in chat. Native JsMacros contexts/services own execution; ordinary filesystem and shell tools own engineering work.

Target: Minecraft **26.3**, Fabric **0.19.5**, JsMacros Reloaded **2.2.1**, Baritone **1.20.0**. Node >=22 and JDK >=21 are required to build the bridge. The game uses Java 25 for Minecraft 26.3.

```sh
npm ci
npm run build
npm test
```

## Installation

Use your launcher to create/import an isolated Fabric instance. Install the official JsMacros Reloaded and Baritone API Fabric jars, plus Fabric API. Put `dist/bootstrap.js`, `dist/minecraft-mcp-bridge.jar` and a private `config.json` in `config/jsMacros/Macros/minecraft_mcp/`. Register `minecraft_mcp/bootstrap.js` as an enabled JsMacros service named `minecraft_mcp`.

`python3 scripts/prepare_pack.py` downloads and verifies pinned official release jars, then packages them with a generated private config into `dist/minecraft_mcp-26.3.mrpack`, ready for launcher import. Published SHA-256/SHA-512 hashes are pinned in the script. The generated pack contains a local secret: do not distribute it.

Register with Codex:
```sh
codex mcp add minecraft_mcp --env MINECRAFT_MCP_CONFIG=/absolute/path/to/config.json -- node /absolute/path/to/minecraft_mcp/src/server.mjs
```

Install the companion Skill from the repository root (keep this checkout in place):
```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$PWD/skills/minecraft-mcp" "${CODEX_HOME:-$HOME/.codex}/skills/minecraft-mcp"
```

The Skill teaches task execution, incremental output, player takeover, Baritone and API lookup; MCP supplies the five client tools. Invoke `$minecraft-mcp` on your next turn, or let Codex select it for Minecraft tasks. The symlink keeps the installed Skill synchronized with this repository. Detailed references load only when needed. If the destination already exists, inspect it before replacing it.

Keep the Minecraft instance running. `/mcp status` reports connection state; `/mcp stop` disables the bridge's game actions and relinquishes control; `/mcp start` enables them again. These are client-side commands and are not sent to a server. The bootstrap service starts automatically at client startup. Disconnect cancels old tasks and releases controls without changing the enable flag.

Chat defaults to aqua `[AGENT]` and white message text. `chat.tag`, `tagColor`, optional `name`, `nameColor`, and `messageColor` are configurable using Minecraft text colors or hex colors. Config changes take effect after restarting the bootstrap service/client. Tag/name formatting is applied to local chat only.

The bridge binds only `127.0.0.1` and requires a random bearer secret. `MINECRAFT_MCP_CONFIG` identifies the same config used by bootstrap. Tokens are never committed. This is an intentionally trusted local scripting interface, not a sandbox for untrusted scripts.

## Development and verification

`npm test` uses the official MCP SDK client against the actual stdio server for protocol negotiation and schema validation. `npm run test:live` requires a real running client in a disposable single-player world and exercises native Java/game APIs, incremental output, cooperative and busy-loop cancellation, key release, real Baritone movement, /mcp stop/start, native overlay registration/cleanup, errors, colored local chat and PNG capture. No mocks or fake game implementations. Tests fail if Minecraft is unavailable.

[Agent Skill](skills/minecraft-mcp/SKILL.md) · [API index](skills/minecraft-mcp/references/api-index.txt) · [Architecture](docs/architecture.md) · [Verified behavior](docs/validation.md)
