# minecraft_mcp

A Skill and MCP server for controlling a Minecraft Java Edition client through JsMacros. Agents use five tools—execute, incremental output, stop, screenshot and local chat—alongside their normal filesystem and shell. The player watches the actual client and can take over with `/mcp stop`.

The integration targets the configured instance, independently of its launcher, world, server or modpack. Installed mods are discovered through metadata and called through their Java APIs. Baritone is optional; its navigation, mining and building APIs remain directly available when installed.

## Requirements

- A Minecraft Java Edition instance with a compatible JsMacros installation and JavaScript support.
- Node.js >=22 for the MCP server; JDK >=21 to build the bridge. Minecraft may require a newer Java runtime.
- The MCP process and Minecraft must run on the same machine and have access to the script and screenshot files.

The current compatibility baseline is Minecraft 26.3, Fabric 0.19.5 and JsMacros Reloaded 2.2.1. The bundled API index describes that version; check installed versions when using another instance. Mod dependencies must match that instance's Minecraft version and loader.

## Install into an instance

Build from this checkout:

```sh
npm ci
npm run build
```

1. Locate the target instance's game directory using its launcher.
2. Copy `dist/bootstrap.js`, `dist/minecraft-mcp-bridge.jar` and `client/config.example.json` into its `config/jsMacros/Macros/minecraft_mcp/` directory, naming the config `config.json`.
3. Replace the token placeholder with a random secret (at least 32 characters). Choose a free loopback port; simultaneously running instances need different ports. Keep the config private.
4. Register `minecraft_mcp/bootstrap.js` as an enabled JsMacros service named `minecraft_mcp`.
5. Point the MCP server at that instance's config:

```sh
codex mcp add minecraft_mcp --env MINECRAFT_MCP_CONFIG=/absolute/instance/config/jsMacros/Macros/minecraft_mcp/config.json -- node /absolute/install/minecraft_mcp/src/server.mjs
```

`MINECRAFT_MCP_CONFIG` is required for client operations. There is no implicit instance or config in the repository. Use separate MCP registrations with separate configs to connect to multiple instances. The server can start from any working directory.

Install the companion Skill by copying `skills/minecraft-mcp` to the agent's skill directory, or link it from a stable checkout:

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$PWD/skills/minecraft-mcp" "${CODEX_HOME:-$HOME/.codex}/skills/minecraft-mcp"
```

Invoke `$minecraft-mcp`, or allow automatic skill selection. The Skill teaches workflows and loads API references only when needed.

For updates, `node scripts/deploy-client.mjs /absolute/instance` copies the built bridge and bootstrap into an existing instance, preserving its config. Reload the JsMacros service after updating, when no agent task is running.

An optional pinned starter pack can be built with `python3 scripts/prepare_pack.py --output /chosen/path/minecraft_mcp.mrpack`. It packages Minecraft 26.3/Fabric with JsMacros, Fabric API and Baritone for import by compatible launchers. Downloads are cached in the OS temporary directory (override with `--cache-dir`); each pack gets a new secret. The resulting pack is private and contains its own instance config. Manual installation does not require this pack.

## Working files and controls

Keep agent scripts, notes and task outputs in a separate task workspace. This repository contains the implementation; the installed Skill contains reusable utilities and reference examples. Neither is the agent's working directory. Copy examples into the task workspace before adapting them, and pass absolute file paths to `execute`. Screenshots are saved in the target instance's `config/jsMacros/Macros/minecraft_mcp/captures/screenshots/` directory and returned directly as MCP images.

`/mcp status` reports control state. `/mcp stop` disables further agent actions and relinquishes control; `/mcp start` enables them again. These are client-side commands. The bootstrap starts with the client; disconnect cancels old tasks and releases controls without changing the enable flag. MCP `stop` cancels tasks without disabling the bridge.

Chat defaults to aqua `[AGENT]` and white message text. Configure `chat.tag`, `tagColor`, optional `name`, `nameColor` and `messageColor` in the instance config, then reload the service. Messages display locally and are not sent to the server.

The bridge binds only `127.0.0.1` and authenticates with the instance secret. Java scripting runs with the client's OS privileges; this is a trusted scripting interface.

## Architecture

Agent fs/shell → task workspace and scripts.
Agent MCP → Node MCP SDK (stdio) → authenticated loopback HTTP → JDK bridge → bootstrap → native JsMacros contexts and installed mod APIs.

HTTP workers enqueue requests; a JsMacros Tick listener dispatches them into native script contexts. The Java bridge has no Minecraft dependency and does not replace JsMacros task management. Output uses bounded in-memory buffers, with no filesystem roundtrip. Each `execute` gets a fresh context. Callbacks may retain that context; `active` is not proof an action is still progressing, and script completion is not proof an autonomous mod finished.

`read_output` consumes newly buffered output for a single reader. Overflow reports `dropped_chars`; output is not durable replay. The bridge retains at most 128 task records and 64 queued requests, evicting finished records when needed. Preserve important results in the task workspace. An uncertain transport timeout does not undo an already dispatched action; inspect state before repeating mutations.

`mcp.mainThread(fn)` yields the GraalJS context while waiting for a short native game-thread callback, returns its value and propagates errors. Keep tick waits, I/O and long work outside it. The native fire-and-forget overload can cause a watchdog timeout if the originating script retains the same context lock. Later native callback errors may go to the game log; catch and print them when task output is needed.

`mcp.track(registrable)` registers drawings/commands for cleanup. Stop closes MCP-owned contexts and releases scripted keys. If Baritone is installed, stop also cancels its process because it can outlive the initiating script. This optional takeover cleanup is the only mod-specific runtime behavior; other mods use their own documented cleanup APIs. Other manually started JsMacros contexts are not closed.

## Development checks

- `npm test`: official MCP SDK negotiation and schema/config validation against the real stdio server; no game required.
- `npm run test:runtime`: real-client thread handoffs, callback errors, mod discovery, API access and screenshots. Set `MINECRAFT_MCP_CONFIG`; run while other agents are idle because task cleanup releases shared controls.
- `npm run test:live`: real-client execution, output, cancellation, key release, Baritone navigation, overlays, commands, chat and screenshots. Requires the config, Baritone and a disposable world; it moves the player and exercises stop/start.

No mocks or fake clients are used. Live tests fail when the configured instance is unavailable. Results go to the test runner; tests do not save copies of screenshots or logs in the repository. These checks do not establish compatibility with every Minecraft/mod version or measure combat performance.

[Agent Skill](skills/minecraft-mcp/SKILL.md) · [API index](skills/minecraft-mcp/references/api-index.txt) · [Mod discovery](skills/minecraft-mcp/references/mods.md) · [Utilities](skills/minecraft-mcp/scripts) · [Examples](skills/minecraft-mcp/examples)
