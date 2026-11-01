# minecraft_mcp

A client mod, MCP server and Agent Skill for controlling Minecraft through JsMacros. The player watches the actual client, can interact normally and can take over with `/mcp stop`. Agents use five tools—execute, incremental output, stop, screenshot and local chat—alongside their normal filesystem and shell.

The Minecraft mod and MCP server are installed, configured and updated independently. They communicate over an authenticated loopback connection; they do not share a config file or screenshot directory.

## Install the Minecraft mod

1. Use a compatible **Minecraft Java Edition / Fabric** instance with **JsMacros Reloaded**. **Baritone is strongly recommended** for navigation, mining and building, but is not required to start the mod or execute scripts.
2. Put `minecraft-mcp-0.2.0.jar` in the instance's `mods/` folder and launch Minecraft. This build targets **Minecraft 26.3, Java 25, Fabric Loader >=0.19.5 and JsMacros Reloaded 2.2.1**. The required Fabric lifecycle/command/key-mapping modules are also bundled by that JsMacros release.
3. Press **F8** (rebindable in Controls) or enter **`/mcp config`** to open the mod settings.
4. Choose a port, copy or set a token, and configure automatic startup and chat appearance. Apply saves the settings and stops current agent tasks. Different simultaneously running instances need different ports.

The mod manages its own `config/minecraft_mcp.json`; users do not need to edit it. Tokens are hidden in the UI until explicitly shown, and can be copied or regenerated. Keep the same token in the separate MCP setup below. A port conflict or invalid settings is shown in the UI, without crashing Minecraft.

The mod adds its own settings and a key binding. It does not install other mods, change world generation or add blocks/items/entities. Agent gameplay can of course change the world and inventory. Removing the mod disables the integration without requiring save conversion.

## Install the MCP server and Skill

The MCP server requires **Node.js >=22**. Install the separately packaged `minecraft-mcp-0.2.0.tgz` with npm, or run `npm ci` in a source checkout. The package provides a `minecraft-mcp` executable. Register it with your MCP host; the following source-checkout example uses its absolute entrypoint. For Codex:

```sh
codex mcp add minecraft_mcp \
  --env MINECRAFT_MCP_PORT=28473 \
  --env MINECRAFT_MCP_TOKEN=PASTE_TOKEN_FROM_MOD_SETTINGS \
  -- node /absolute/install/minecraft_mcp/src/server.mjs
```

`MINECRAFT_MCP_PORT` defaults to `28473`; `MINECRAFT_MCP_TOKEN` is required. Both belong to the MCP host's settings. The server never reads the mod's config file. Minecraft and MCP currently run on the same machine, but use no shared runtime files. Use separate registrations and ports for multiple instances. The server starts from any working directory. See [Codex MCP configuration](https://developers.openai.com/codex/mcp) for host-specific setup.

Copy `skills/minecraft-mcp` to the agent's skill directory, or link it from a stable checkout:

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$PWD/skills/minecraft-mcp" "${CODEX_HOME:-$HOME/.codex}/skills/minecraft-mcp"
```

The Skill teaches the workflows and loads API references only when needed. Keep task scripts, notes and outputs in a separate workspace; copy examples there before editing them.

## Controls and updates

- `/mcp start`: enable agent actions.
- `/mcp stop`: disable actions, cancel owned scripts and release controls.
- `/mcp status`: report control state and active tasks.
- `/mcp config` or F8: settings, pairing token and chat appearance.

Commands are client-side. MCP `stop` cancels work without disabling the connection. Screenshots remain available while agent control is disabled. Leaving or changing worlds cancels old tasks without changing the player's enable/disable choice.

Chat defaults to aqua `[AGENT]` and white message text. The settings screen controls the tag, optional name and their colors. Messages display locally and are not sent to a multiplayer server.

Update the mod by replacing its JAR while Minecraft is closed. Update the MCP server/Skill separately and restart that MCP process. Settings persist on their respective sides. A protocol handshake rejects incompatible versions before sending actions; matching protocol versions can update independently.

For migration from the old bootstrap version: stop and remove the `minecraft_mcp` JsMacros service, then remove its old bootstrap/helper JAR. Install the mod and configure its token/port through the UI. Replace the old `MINECRAFT_MCP_CONFIG` environment setting with the separate port/token settings above. Other JsMacros scripts and services need no changes.

## Architecture

Agent fs/shell → task workspace and scripts.
Agent MCP → Node MCP SDK (stdio) → authenticated loopback HTTP → client mod → native JsMacros contexts and installed mod APIs.

The mod owns the HTTP listener, UI, chat commands and lifecycle. HTTP workers enqueue requests; a native client-tick callback dispatches short operations and starts scripts through JsMacros's `Core.exec`. There is no second script scheduler or external bootstrap/service to install. Baritone and other installed mods remain ordinary Java APIs, discovered through metadata and public signatures. The only Baritone-specific runtime code cancels autonomous movement on player takeover; the mod starts and runs without it.

Each `execute` gets a fresh GraalJS context. Output is a bounded in-memory, single-consumer stream, read through `read_output` without filesystem roundtrips. Overflow reports `dropped_chars`. The bridge retains at most 128 task records and 64 queued requests; preserve durable results in the task workspace. `active` describes native callback lifetime, not gameplay progress. Script completion does not prove an autonomous mod finished.

`mcp.mainThread(fn)` yields the JS context while waiting for a short native game-thread callback, returning its result and propagating errors. Keep waits and long work outside that callback. `mcp.track(registrable)` registers drawings/commands for cleanup. Stop closes MCP-owned contexts and releases scripted keys without closing unrelated JsMacros scripts.

Screenshots use the real framebuffer and return PNG data over the connection. Temporary encoding files are deleted by the mod; the MCP server returns image content directly. It never reads a client-provided screenshot path. Script files are read by MCP and their source is sent over the connection.

The listener binds only `127.0.0.1` and authenticates with the mod's token. Java scripting has the client's OS privileges. An uncertain timeout does not undo a dispatched action; inspect game state before retrying mutations.

## Build and test

Build the mod using JDK 25:

```sh
./gradlew build
```

On Windows use `gradlew.bat build`. The installable mod JAR is in `build/libs/` (not the `-sources.jar`). The build resolves official Minecraft/Fabric dependencies and JsMacros; it does not package a launcher instance or authentication token. `npm pack --pack-destination /chosen/output` packages the MCP server and Skill separately.

- `npm test`: official MCP SDK negotiation, tool schemas and missing-token handling; no game required.
- `npm run test:runtime`: real-client thread handoffs, callback errors, mod discovery, APIs and screenshots. Set the MCP port/token environment variables and run while agents are idle.
- `npm run test:mod`: real settings UI token rotation/restoration and HTTP authentication/protocol checks. Requires a disposable client and the MCP port/token.
- `npm run test:live`: real-client navigation, output, cancellation, keys, overlays, commands, chat and screenshots. Requires Baritone and a disposable world; it moves the player and exercises stop/start.

No mocked clients are used. `./gradlew runClient -PmcpRunDir=/absolute/test-instance` launches a separate development client; its default directory is in the OS temporary directory. Test results go to the runner, not a repository working-data directory.

[Agent Skill](skills/minecraft-mcp/SKILL.md) · [API index](skills/minecraft-mcp/references/api-index.txt) · [Mod discovery](skills/minecraft-mcp/references/mods.md) · [Utilities](skills/minecraft-mcp/scripts) · [Examples](skills/minecraft-mcp/examples)
