# minecraft_mcp

A companion Agent Skill and small local MCP bridge to the player's Minecraft client: execute JsMacros scripts, read incremental output, stop, screenshot, and display colored Agent progress in chat. Native JsMacros contexts/services own execution; ordinary filesystem and shell tools own engineering work.

Tested pack: Minecraft **26.3**, Fabric **0.19.5**, JsMacros Reloaded **2.2.1**, Baritone **1.20.0**. Baritone is optional for the bridge; the supplied pack includes it. Node >=22 and JDK >=21 are required to build the bridge. The game uses Java 25 for Minecraft 26.3.

```sh
npm ci
npm run build
npm test
```

## Installation

Use your launcher to create/import an isolated Fabric instance. Install JsMacros Reloaded and Fabric API; include Baritone API Fabric for navigation/mining automation. Put `dist/bootstrap.js`, `dist/minecraft-mcp-bridge.jar` and a private `config.json` in `config/jsMacros/Macros/minecraft_mcp/`. Register `minecraft_mcp/bootstrap.js` as an enabled JsMacros service named `minecraft_mcp`.

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

The Skill teaches task execution, incremental output, player takeover and installed-mod API discovery; MCP supplies the five client tools. Invoke `$minecraft-mcp` on your next turn, or let Codex select it for Minecraft tasks. The symlink keeps the installed Skill synchronized with this repository. Detailed references load only when needed. If the destination already exists, inspect it before replacing it.

Keep the Minecraft instance running. `/mcp status` reports connection state; `/mcp stop` disables the bridge's game actions and relinquishes control; `/mcp start` enables them again. These are client-side commands and are not sent to a server. The bootstrap service starts automatically at client startup. Disconnect cancels old tasks and releases controls without changing the enable flag.

Chat defaults to aqua `[AGENT]` and white message text. `chat.tag`, `tagColor`, optional `name`, `nameColor`, and `messageColor` are configurable using Minecraft text colors or hex colors. Config changes take effect after restarting the bootstrap service/client. Tag/name formatting is applied to local chat only.

The bridge binds only `127.0.0.1` and requires a random bearer secret. `MINECRAFT_MCP_CONFIG` identifies the same config used by bootstrap. Tokens are never committed. This is an intentionally trusted local scripting interface, not a sandbox for untrusted scripts.

## Development and verification

`npm test` uses the official MCP SDK client against the actual stdio server for protocol negotiation and schema validation. `npm run test:live` requires a real running client in a disposable single-player world and exercises native Java/game APIs, incremental output, cooperative and busy-loop cancellation, key release, real Baritone movement, /mcp stop/start, native overlay registration/cleanup, errors, colored local chat and PNG capture. `npm run test:runtime` runs the focused real-client threading/mod-discovery regression without navigation or inventory changes. It closes its own tasks, which also releases shared scripted controls, so run it while other agents are idle. No mocks or fake game implementations. Live tests fail if Minecraft is unavailable.

[Agent Skill](skills/minecraft-mcp/SKILL.md) · [API index](skills/minecraft-mcp/references/api-index.txt) · [Mod discovery](skills/minecraft-mcp/references/mods.md) · [Script examples](skills/minecraft-mcp/scripts)

## Architecture

Codex fs/shell → local .js files and documentation.
Codex MCP → Node MCP SDK (stdio) → authenticated loopback HTTP → small JDK bridge → bootstrap.js → native JsMacros contexts and installed mod APIs.

The Java helper has no Minecraft dependencies. HTTP workers never execute scripts: they enqueue small requests. A JsMacros Tick listener dispatches them into native `runScript` contexts; the bootstrap context stays available while a separate script runs. Output uses synchronized bounded buffers and HTTP reads independent of game ticks. No disk round trip is needed for text output. Screenshots use the native screenshot API and return MCP image content.

The bridge records only output and references to native contexts, not a second scheduler. 128 retained task records and 64 pending requests bound retained state. Finished records are evicted when capacity is needed. `read_output` is a single-consumer drain, not a durable delivery protocol; disconnect/retry after a response was consumed may lose that chunk. An output overflow is explicitly reported. Preserve important output with normal local files.

Execution returns captured console output, errors and native task state. Fresh contexts avoid hidden cross-execution globals; callbacks can keep a task active. `mcp.track(registrable)` handles overlay cleanup. Explicit stop releases scripted keys and, when installed, cancels Baritone globally because its movement process can outlive a script. This optional takeover cleanup is the only mod-specific runtime code; gameplay remains direct Java interop. There is no mandatory Baritone class loaded at bootstrap. Other manually started JsMacros scripts are not closed.

A stalled game main thread can prevent command dispatch and screenshots. Network request timeouts do not imply an already dispatched game action was undone. Do not automatically retry mutations. `/mcp stop` cannot undo irreversible in-game actions or arbitrary native Java side effects.

`mcp.mainThread(fn)` uses the native awaited main-thread call, returning values and propagating callback errors. It releases the GraalJS context lock while waiting; no extra polling, tick delay or mod abstraction is added. The native fire-and-forget overload can deadlock when the script keeps that lock, causing a watchdog error. Long operations still must stay outside a main-thread callback.

Sources: JsMacros Reloaded v2.2.1 FJsMacros, ServiceManager, EventService, FPlayer, FClient; Baritone v1.20.0 API; official MCP TypeScript SDK 1.32.2. Source links are in the [Skill API index](skills/minecraft-mcp/references/api-index.txt).

Unhandled errors in later native callbacks can be reported by JsMacros to the game log rather than the completed script callback. Use try/catch with console.error in long-lived event handlers. `active` indicates an open native callback context, not proof that a particular game action is still running.

## Verified on 2026-11-01

Environment: macOS arm64, Node 24.4.1, Minecraft 26.3 / Java 25, Fabric Loader 0.19.5, Fabric API 0.160.6+26.3, JsMacros Reloaded 2.2.1, Baritone API Fabric 1.20.0.

Initial validation: The launcher imported `dist/minecraft_mcp-26.3.mrpack` through its UI into the separate `minecraft_mcp` instance. `bootstrap.js` started automatically as an enabled native JsMacros service. A new disposable single-player world, `minecraft_mcp Test World`, was used; existing worlds were not modified.

Initial full-client checks passed:
- JDK 21-target compilation of the helper JAR.
- Official MCP SDK client → actual stdio server: negotiation, tool discovery and schema rejection (`npm test`).
- Node test runner → official MCP SDK → actual Minecraft (`npm run test:live`): player/Java access, incremental output without duplication, cooperative cancellation, tight-loop cancellation, actual held-key release, runtime/syntax errors, real Baritone navigation to a nearby goal, native 3D overlay registration and cleanup, `/mcp status`, `/mcp stop` rejecting execution, `/mcp start` restoring execution, colored local chat component, real PNG capture matching its saved file.
- Baritone moved the actual player to the requested X/Z goal. Measurements are in `artifacts/navigation.json`.
- Final bootstrap reload and compact `/mcp status` checked using the same config path registered in Codex.
- Published release hashes verified for all three packaged mods.
- Codex `mcp get minecraft_mcp` reports enabled stdio transport with absolute Node/server paths.

Current watchdog/mod-discovery change: reproduced the same native `RunOnMainThread` watchdog failure with a fire-and-forget callback followed by a Java sleep that held the GraalJS context. After deploying/reloading the fix, `npm run test:runtime` passed 20 real main-thread handoffs, returned values, callback exceptions (including a falsy thrown value), generic mod inventory, actual installed JAR/metadata lookup, direct Baritone API access and PNG capture. Handoffs measured 13–34 ms in this client session; this is dispatch latency, not a combat benchmark. No new watchdog appeared during the fixed-path test. Current-instance tests did not move the player or modify inventory. The full movement/control suite was not rerun in the user's survival world. Iris and a Baritone-free instance have not been live-tested.

No mocks or fake game implementations were used. Local test output and screenshots are in ignored `artifacts/`; source tests are committed. `npm run test:live` requires the real client, an entered world and enabled Agent control. It deliberately moves the player a short distance and exercises local commands.

Not measured: combat performance, long-session endurance, multiplayer-server compatibility, or benchmark scores. The existing Codex conversation does not acquire newly registered tools automatically; start a new conversation to load the MCP server.
