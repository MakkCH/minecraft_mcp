<p align="center">
  <img src="assets/icon.svg" width="96" height="96" alt="Minecraft MCP" />
</p>

# Minecraft MCP

**Let an AI agent play in your Minecraft client, while you watch and stay in control.**

Minecraft MCP connects your game to an MCP-capable agent. Ask it to explore, gather resources, build or debug a script. You see what happens from your own player’s perspective and can take over with `/mcp stop`.

It comes in two parts: a **Minecraft client mod** and an **agent plugin containing the MCP server and Skill**. Install and update them independently. Both run on your computer.

## What you can do

- **Play together.** The agent controls your real client, with progress messages in local chat.
- **Automate with scripts.** JsMacros runs JavaScript in the game; the agent uses its usual editor, files and shell to develop scripts.
- **See and debug.** Capture the game view, read script output as it arrives, and draw markers in the world.
- **Use your installed mods.** The Skill teaches the agent how to discover their APIs. Baritone adds navigation, mining and building automation.
- **Take over.** Stop the agent’s scripts and release its controls from Minecraft.

## Requirements

The current client mod targets the following versions. Other Minecraft versions and loaders are not yet verified.

| Component | Requirement |
| --- | --- |
| Minecraft Java Edition | 26.3 |
| Mod loader | Fabric Loader 0.19.5 or later |
| Java | 25 or later |
| Scripting mod | JsMacros Reloaded 2.2.1 |
| Agent runtime | Node.js 22 or later, available on `PATH` |
| Agent application | Codex desktop, or another local MCP client |
| Recommended mod | Baritone, matching your Minecraft version |

**Baritone is optional but strongly recommended.** Without it, scripts, screenshots and direct player controls still work; navigation and resource gathering require more scripting. JsMacros Reloaded 2.2.1 bundles the Fabric API modules this mod needs.

## Get started

You need the client mod JAR and the agent plugin archive. The current filenames are `minecraft-mcp-0.2.0.jar` and `minecraft-mcp-0.2.1.tgz`. To produce them from this repository, see [Development](#development).

### 1. Add the mod to Minecraft

1. Open your instance’s game folder in your launcher.
2. Put the Minecraft MCP JAR in `mods/`, alongside JsMacros and, preferably, Baritone.
3. Launch Minecraft. Press **F8**, or enter **`/mcp config`** in a world.
4. Copy the **token** and note the **port**. You will use them to pair the agent with this instance.

The settings screen also controls automatic startup and the `[AGENT]` tag, optional name and chat colors. Press **Apply** to save changes; this stops any active agent tasks. F8 can be rebound in Minecraft’s Controls settings.

### 2. Install the Codex plugin

The archive includes the MCP server, its dependencies and the Skill. The commands below use macOS/Linux shell syntax; on Windows, use the equivalent folders under your user profile.

Extract the archive into your personal plugin folder:

```sh
mkdir -p ~/plugins/minecraft-mcp
tar -xzf /path/to/minecraft-mcp-0.2.1.tgz \
  -C ~/plugins/minecraft-mcp --strip-components=1
```

<details>
<summary>Register Minecraft MCP in your personal plugin directory</summary>

Create `~/.agents/plugins/marketplace.json` with the following contents. If you already have a marketplace file, add just the Minecraft entry to its `plugins` array and keep its existing name and entries.

```json
{
  "name": "personal",
  "interface": {"displayName": "Personal"},
  "plugins": [{
    "name": "minecraft-mcp",
    "source": {"source": "local", "path": "./plugins/minecraft-mcp"},
    "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
    "category": "Productivity"
  }]
}
```

This makes the plugin available in your local directory; it does not publish it. See [Codex plugin installation](https://developers.openai.com/plugins/build/plugins) for other installation options.

</details>

Install and enable it:

```sh
codex plugin add minecraft-mcp@personal
```

Use your marketplace’s name instead of `personal` if it differs. You can also install **Minecraft MCP** from that source in the desktop app’s Plugins directory. Reopen the directory or restart the app if the new entry has not appeared.

### 3. Pair the agent with your game

Create `~/.config/minecraft-mcp/connection.json` with the values from the Minecraft settings screen:

```json
{
  "port": 28473,
  "token": "PASTE_YOUR_TOKEN_FROM_MINECRAFT_SETTINGS"
}
```

On macOS/Linux, restrict access with `chmod 600 ~/.config/minecraft-mcp/connection.json`. This is the **agent’s connection file**. Minecraft manages its own settings through the game UI; the two sides do not share a config file. Keep the token out of the plugin folder so updates and sharing do not include it.

Start a **new local Codex chat**, choose Minecraft MCP, and try:

> Inspect my Minecraft client and tell me what you can see.

> Gather some wood nearby and keep me updated in chat.

> Place a visible marker at this location so I can find it again.

The plugin already includes the Skill. If you previously configured Minecraft MCP manually, remove that older MCP registration and standalone Skill copy after confirming the plugin works.

<details>
<summary>Use another MCP client, or configure Codex manually</summary>

Extract the same archive into a stable folder, or run `npm ci` in a source checkout. Configure your MCP host to start the server with Node:

```json
{
  "mcpServers": {
    "minecraft_mcp": {
      "command": "node",
      "args": ["/absolute/path/to/minecraft-mcp/src/server.mjs"],
      "env": {
        "MINECRAFT_MCP_PORT": "28473",
        "MINECRAFT_MCP_TOKEN": "PASTE_YOUR_TOKEN_FROM_MINECRAFT_SETTINGS"
      }
    }
  }
}
```

Your host may use a different configuration format. For manual Codex setup:

```sh
codex mcp add minecraft_mcp \
  --env MINECRAFT_MCP_PORT=28473 \
  --env MINECRAFT_MCP_TOKEN=PASTE_YOUR_TOKEN_FROM_MINECRAFT_SETTINGS \
  -- node /absolute/path/to/minecraft-mcp/src/server.mjs
```

Install `skills/minecraft-mcp` in your agent’s Skill directory as well. For Codex, that is `${CODEX_HOME:-$HOME/.codex}/skills/`. The Skill contains API references, utilities and examples that the agent reads when needed.

</details>

## Staying in control

| In Minecraft | Action |
| --- | --- |
| `/mcp stop` | Disable agent actions, cancel its scripts and release controls |
| `/mcp start` | Allow agent actions again |
| `/mcp status` | Show whether control is enabled and how many tasks are active |
| `/mcp config` or **F8** | Open connection and chat settings |

These are client-side commands. `[AGENT]` messages stay in your local chat; they are not sent to a multiplayer server. Screenshots remain available while control is disabled. Leaving or changing worlds cancels old tasks.

The mod adds no blocks, items, entities or world-generation changes. Removing it does not require converting your save. Actions performed by the agent still affect your world and inventory, just as player actions do.

## Connection help

| Symptom | What to check |
| --- | --- |
| Connection refused | Launch the correct Minecraft instance and check the port in F8 settings |
| Authentication failed | Copy the same token into the agent’s connection settings, then restart its MCP connection |
| Agent control disabled | Enter `/mcp start` when you want the agent to resume |
| Plugin or tools missing | Confirm the plugin is enabled, Node.js is installed, and open a new local chat |
| Port already in use | Give each simultaneously running instance a different port |
| Incompatible protocol | Update the mod and MCP plugin to compatible versions |

The desktop plugin reads `~/.config/minecraft-mcp/connection.json`. Set `MINECRAFT_MCP_CONNECTION` to use a different file. Explicit `MINECRAFT_MCP_PORT` and `MINECRAFT_MCP_TOKEN` values override the file’s values; the standalone server uses these environment variables directly.

Minecraft and the MCP server must run on the same computer. The mod listens only on `127.0.0.1` and requires its token. Scripts run with the Minecraft process’s permissions, so connect agents you trust.

## Updating

- **Minecraft mod:** close Minecraft and replace the JAR in `mods/`.
- **Agent plugin:** replace the extracted package, run `codex plugin add minecraft-mcp@personal` again, and start a new chat.
- **Manual MCP setup:** update the installed package and restart the MCP process.

Your Minecraft settings and agent connection file stay outside the installed packages. The mod and plugin have separate version numbers; they communicate using a versioned protocol.

<details>
<summary>Migrating from the older JsMacros bootstrap installation</summary>

Stop and remove the `minecraft_mcp` JsMacros service and its bootstrap/helper JAR. Install the client mod and follow the pairing instructions above. Replace the old `MINECRAFT_MCP_CONFIG` setting with the new agent-side configuration. Other JsMacros scripts and services can stay as they are.

</details>

## Development

The repository contains one agent plugin and its companion Minecraft mod:

```text
.codex-plugin/         Codex plugin metadata
.mcp.json             Bundled MCP server launch configuration
src/                  Node.js MCP server and plugin entrypoint
skills/minecraft-mcp/ Agent instructions, API references, scripts and examples
mod/                  Fabric client mod
assets/               Plugin icon
scripts/              Developer utilities
tests/                MCP protocol and real-client integration checks
```

The plugin metadata, Skill and MCP launch configuration sit at the plugin root. `src/` contains the MCP implementation; `mod/` contains the game integration. Keep gameplay scripts, notes and captures in a separate task workspace.

Build the Minecraft mod with JDK 25:

```sh
./gradlew build
```

On Windows, use `gradlew.bat build`. Install the JAR from `build/libs/`, excluding the `-sources.jar`.

Package the agent plugin with Node.js 22 or later:

```sh
npm ci
mkdir -p build/distributions
npm pack --pack-destination build/distributions
```

The archive contains the server, runtime dependencies, Skill and plugin metadata. It does not contain Minecraft, a launcher instance or pairing credentials.

`npm test` checks the real stdio server through the official MCP SDK. These additional checks require a running disposable Minecraft client and the MCP port/token environment variables:

- `npm run test:runtime`: script execution, game-thread callbacks, mod discovery and screenshots.
- `npm run test:mod`: settings UI, token rotation and authentication.
- `npm run test:live`: movement, Baritone navigation, output, cancellation, markers and player takeover. Requires Baritone and a loaded world.

No mocked game clients are used. Launch a separate development client with `./gradlew runClient -PmcpRunDir=/absolute/test-instance`; the default run directory is in the OS temporary folder.

The five MCP tools are `execute`, `read_output`, `stop`, `screenshot` and `chat`. Each execution gets a fresh JsMacros context; running scripts can continue and produce incremental output, but top-level variables are not shared between calls.

[Agent Skill](skills/minecraft-mcp/SKILL.md) · [API index](skills/minecraft-mcp/references/api-index.txt) · [Mod discovery](skills/minecraft-mcp/references/mods.md) · [Script utilities](skills/minecraft-mcp/scripts) · [Examples](skills/minecraft-mcp/examples)
