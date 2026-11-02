<p align="center">
  <img src="assets/icon.svg" width="96" height="96" alt="Minecraft MCP" />
</p>

# Minecraft MCP

**Let an AI agent play in your Minecraft client, while you watch and stay in control.**

Minecraft MCP connects your game to an MCP-capable agent. Ask it to explore, gather resources, build or debug a script. You see what happens from your own player’s perspective and can take over with `/mcp stop`.

It comes in two parts: a **Minecraft client mod** and an **agent package containing the MCP server and Skill**. Install and update them independently. Both run on your computer. The package includes a Codex plugin; Claude Code, Claude Desktop, Cursor and other local MCP clients can connect to the same server.

## From an empty inventory to the End Poem

**A single Codex agent went from an empty inventory to the End Poem on Normal difficulty in about 8 hours 25 minutes, writing and debugging its own gameplay scripts along the way.**

On **November 1–2, 2026**, a Codex agent running **`gpt-6-astra`** with **`high` reasoning effort** used Minecraft MCP to gather resources, reach the End, defeat the Ender Dragon and enter the End Poem. It wrote and revised its own JavaScript throughout the run: mining and trading, recovering equipment after deaths, building safer routes, and eventually timing bed explosions behind a protective wall.

![The dragon egg and active exit portal after the final fight](assets/runs/2026-11-02/exit-portal.png)

*About 8 hours 21 minutes into the run — The dragon is defeated, the exit portal is open, and the player has survived the final fight.*

| Run | Recorded result |
| --- | --- |
| Starting state | Survival mode, empty inventory |
| Difficulty | **Normal**; the recorded in-game difficulty query returned `2` |
| Environment | Local single-player world with an integrated server; Minecraft Java 26.3, Fabric Loader 0.19.5, JsMacros Reloaded 2.2.1, Baritone API Fabric 1.20.0 |
| Completion | Dragon health reached zero; the exit portal opened; the End Poem was confirmed on screen |
| Elapsed time | About **8 hours 25 minutes** |
| Script execution | **856 tasks**, with **2,060 task responses** including follow-up output reads |
| Milestone journal | **19 screenshots** with timestamps and captions; four are selected here |

Elapsed time includes planning, debugging, recovery and pauses, measured from the initial request to confirmation of the ending screen.

The agent could inspect structured game state and Java APIs, use Baritone, write scripts with the local filesystem and shell, capture screenshots, and pause the single-player game while handling dangerous situations. It also read integrated-server state when checking completion. This was not a vision-only or continuously running real-time benchmark. The initial request was to finish Minecraft; a later request added the screenshot journal. This is a documented demonstration of one run with those capabilities.

<details>
<summary><strong>Run timeline and selected screenshots</strong></summary>

The timeline combines timestamped task output, progress messages and the screenshot journal. Times below are approximate elapsed hours and minutes from the initial request. Screenshots are unedited captures from the player's client.

| Elapsed time (h:mm) | Milestone |
| --- | --- |
| 0:00 | Started with an empty inventory; gathered wood, food, iron and equipment. |
| 0:32 | Activated a Nether portal and entered the Nether. |
| 0:40 | Located a Nether fortress and approached its blaze spawner. |
| 0:43–2:14 | Died during the initial approach and recovery attempts. Rebuilt equipment, stored valuables, established a respawn point, and added a low-health pause guard. |
| 2:46–3:09 | Recovered equipment through sheltered routes, fought blazes, and banked the first two blaze rods. |
| 3:49 | Died after a ghast knocked the player down; previously banked pearls and rods remained safe. |
| 5:01 | Finished the pearl-gathering phase with **15 ender pearls**, after repeated gold-mining and piglin-bartering trips. |
| 5:24–5:33 | Reached **seven blaze rods**, returned to the Overworld and crafted **14 eyes of ender**. |
| 5:45–5:56 | Used two eye trajectories to estimate the stronghold's location, travelled there, and found the portal room. |
| 6:01–6:09 | Survived a fall into the portal room's lava, secured the room, set a respawn point and activated the End portal. |
| 6:11–6:25 | Entered the End, bridged to the main island and destroyed eight crystals. |
| 6:36 | Opened both crystal cages, but was knocked into the void while descending a tower and lost the carried equipment. |
| 6:57 | Rebuilt equipment near the stronghold, returned and destroyed the last crystal. **All ten crystals were gone.** |
| 7:05–7:48 | Repeated melee, shelter and recovery attempts made little progress against the dragon. Switched to preparing beds for explosive attacks. |
| 7:53–8:05 | Collected wool, crafted **12 beds**, recovered equipment and prepared a protected position beneath the central fountain. |
| 8:10 | First effective bed explosion: dragon health fell from **185 to 133.4**; player health remained **19.58/20**. |
| 8:13–8:21 | Repaired the blast shield between attempts. Three more effective explosions reduced dragon health to **75.6 → 24.4 → 0**. |
| 8:25 | Confirmed the **End Poem**, saved the final screenshot, then stopped automated actions. |

![The activated End portal in the stronghold](assets/runs/2026-11-02/end-portal.png)

*About 6 hours 8 minutes into the run — Twelve eyes in place. The stronghold portal opens, with a respawn point and supplies nearby.*

![The dragon taking damage above the protected bed-explosion position](assets/runs/2026-11-02/bed-strategy.png)

*About 8 hours 10 minutes into the run — The first effective bed explosion deals about 52 damage. Script output confirms the player's blast damage was only 0.42 health points.*

![The End Poem displayed after entering the exit portal](assets/runs/2026-11-02/end-poem.png)

*About 8 hours 25 minutes into the run — The End Poem is visible: the run has reached its verified endpoint.*

</details>

<details>
<summary><strong>What the run taught us</strong></summary>

**The agent built capabilities during play.** It developed reusable routines for inventory handling, mining, trading, navigation and combat. The chat crossed seven context compactions; scripts and checkpoint notes on disk carried its work forward. Minecraft MCP supplied execution, observation and control, while the agent developed the gameplay logic in its own workspace.

**Preserving progress mattered more than avoiding every death.** Early deaths led to expensive rebuilds. Stored valuables, spare equipment, respawn beds and enclosed routes made later failures easier to recover from. Four hours and 52 minutes elapsed between first entering the Nether and gathering enough blaze rods and pearls, including Overworld resupply trips.

**Changing strategy unlocked the final fight.** After clearing the crystals, the agent spent roughly 50 minutes trying melee positions, rebuilding shelters and recovering equipment. It then prepared a bed strategy. Placing and detonating a bed in the same game-thread callback prevented the dragon from destroying it first; checking the head's position and repairing the shield made the attack repeatable. Four effective explosions finished the remaining 185 health in about 11 minutes. A useful lesson for future agents is to measure damage or other concrete progress and reconsider a strategy when repeated refinements produce little improvement.

**Fast reactions belonged in scripts.** Health checks, shield use, hazard avoidance and attack timing ran in the client. The model handled planning and debugging between actions. Single-player pause/resume was part of the agent's safety strategy; the same behavior would need a different approach on a server that continues running.

**The bridge remained usable throughout the run.** All 2,060 recorded task responses reported zero output-buffer overflow. Errors still occurred in scripts and game actions. One output request used a mistyped task ID and succeeded after correction. Screenshot saving initially failed when image data was embedded in another tool's executable code; the agent recovered by using Minecraft's native screenshot facility. Direct local saving from the screenshot tool remains a useful improvement.

**Completion needed both state and visual checks.** The agent verified zero dragon health and an active exit portal, then checked the actual ending screen. An initial screen lookup returned `null` even though the ending had begun; inspecting the GUI and capturing the End Poem resolved that ambiguity.

</details>

## What you can do

- **Play together.** The agent controls your real client, with progress messages in local chat.
- **Automate with scripts.** JsMacros runs JavaScript in the game; the agent uses its usual editor, files and shell to develop scripts.
- **See and debug.** Capture the game view, read script output as it arrives, and draw markers in the world.
- **Use your installed mods.** The Skill teaches the agent how to discover their APIs. Baritone adds navigation, mining and building automation.
- **Take over.** Stop the agent’s scripts and release its controls from Minecraft.

## Requirements

Source builds on this branch support the version groups below. For published binaries, check the release notes. Choose the client mod and JsMacros JAR for the same Minecraft version group; the MCP server and Skill are shared across groups.

| Minecraft Java Edition | JAR group | Baritone API Fabric (optional) |
| --- | --- | --- |
| 26.1, 26.1.1, 26.1.2 | 26.1 | 1.18.0 |
| 26.2 | 26.2 | 1.19.0 |
| 26.3 | 26.3 | 1.20.0 |

Only the listed versions are supported; future 26.x releases and other mod loaders need separate verification.

| Component | Requirement |
| --- | --- |
| Mod loader | Fabric Loader 0.19.5 or later |
| Java | 25 or later |
| Scripting mod | JsMacros Reloaded 2.2.1, matching the JAR group above |
| Agent runtime | Node.js 22 or later, available on `PATH` |
| Agent application | Codex, Claude Code, Claude Desktop, Cursor, or another client with local stdio MCP support |
| Recommended mod | Baritone, matching your Minecraft version |

**Baritone is optional but strongly recommended.** Without it, scripts, screenshots and direct player controls still work; navigation and resource gathering require more scripting. JsMacros Reloaded 2.2.1 bundles the Fabric API modules this mod needs.

## Get started

Go to [GitHub Releases](../../releases) and download the **client mod JAR** (`.jar`, not the sources JAR) and **agent package** (`.tgz`) listed together in the release. Check the release notes for compatible Minecraft and dependency versions. You do not need to build from source; build instructions are in [Development](#development).

### 1. Add the mod to Minecraft

1. Create or select a Fabric installation matching the release requirements, then open its game folder in your launcher.
2. Put the Minecraft MCP JAR in `mods/`, alongside JsMacros and, preferably, Baritone.
3. Launch Minecraft. With [Mod Menu](https://modrinth.com/mod/modmenu) installed, open **Mods → Minecraft MCP → Configure**. You can also press **F8**, or enter **`/mcp config`** in a world.
4. Copy the **token** and note the **port**. You will use them to pair the agent with this instance.

Use the game folder for the installation you actually launch:

| Launcher | Where to put the JAR |
| --- | --- |
| Official Minecraft Launcher | The installation's **Game Directory**, inside `mods/`. With the default directory, this is `.minecraft/mods/` on Windows/Linux or `~/Library/Application Support/minecraft/mods/` on macOS. |
| Prism Launcher or MultiMC | Open the selected instance's Minecraft folder and use its `mods/` directory, usually `.minecraft/mods/` inside the instance folder. |
| Other launchers | Open the selected instance's game folder and use its `mods/` directory. |

All three entrypoints open the same settings screen. Mod Menu is optional. The screen also controls automatic startup and the `[AGENT]` tag, optional name and chat colors. Press **Apply** to save changes; this stops any active agent tasks. F8 can be rebound in Minecraft’s Controls settings.

### 2. Install the agent package

The archive includes the MCP server, its dependencies, the Skill and Codex plugin metadata. Extract it into a stable folder, then choose the setup for your agent below. The commands use macOS/Linux shell syntax; on Windows, use the equivalent folders under your user profile.

Replace the archive path with the `.tgz` you downloaded:

```sh
mkdir -p ~/plugins/minecraft-mcp
tar -xzf /path/to/downloaded-agent-package.tgz \
  -C ~/plugins/minecraft-mcp --strip-components=1
```

<details>
<summary>Codex: install the bundled plugin</summary>

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

Install and enable it:

```sh
codex plugin add minecraft-mcp@personal
```

Use your marketplace’s name instead of `personal` if it differs. You can also install **Minecraft MCP** from that source in the desktop app’s Plugins directory. Reopen the directory or restart the app if the new entry has not appeared.

The plugin already includes the Skill. If you previously configured Minecraft MCP manually, remove that older MCP registration and standalone Skill copy after confirming the plugin works.

</details>

<details>
<summary>Claude Code, Claude Desktop, Cursor and other MCP clients</summary>

Configure a **local stdio MCP server** that runs `node` with the absolute path to the extracted `src/plugin.mjs`. This entrypoint reads the connection file created in step 3.

For **Cursor**, add the following to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project). Merge it with any existing servers. See the [Cursor MCP documentation](https://cursor.com/docs/mcp).

```json
{
  "mcpServers": {
    "minecraft_mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/minecraft-mcp/src/plugin.mjs"]
    }
  }
}
```

For **Claude Desktop**, use the same `command` and `args` in the `mcpServers` section of `claude_desktop_config.json`; omit the `type` field. Follow the [local MCP setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

For **Claude Code**, register the server with its CLI ([MCP documentation](https://code.claude.com/docs/en/mcp)):

```sh
claude mcp add --transport stdio --scope user minecraft_mcp \
  -- node /absolute/path/to/minecraft-mcp/src/plugin.mjs
```

For **Codex without the plugin**, register it manually:

```sh
codex mcp add minecraft_mcp \
  -- node /absolute/path/to/minecraft-mcp/src/plugin.mjs
```

Other clients may use a different configuration format; the command and entrypoint are the same. These instructions connect to a process on your computer, so use the client's local MCP support.

Also install the complete `skills/minecraft-mcp` folder using your client's Skill support. For manual Codex setup, copy it to `${CODEX_HOME:-$HOME/.codex}/skills/`. If your client does not load Skills, provide `SKILL.md` as instructions and make its referenced files available to the agent. The folder contains API references, utilities and examples that the agent reads when needed.

</details>

### 3. Pair the agent with your game

Create `~/.config/minecraft-mcp/connection.json` (including its parent directory) with the values from the Minecraft settings screen. On Windows, `~` means your user profile directory, typically `C:\Users\YourName`.

```json
{
  "port": 28473,
  "token": "PASTE_YOUR_TOKEN_FROM_MINECRAFT_SETTINGS"
}
```

On macOS/Linux, restrict access with `chmod 600 ~/.config/minecraft-mcp/connection.json`. This is the **agent's connection file**. Minecraft manages its own settings through the game UI; the two sides do not share a config file. Keep the token out of the installed package so updates and sharing do not include it.

Restart your client's MCP connection and start a new local chat. Enable Minecraft MCP if your client requires it, then try:

> Inspect my Minecraft client and tell me what you can see.

> Gather some wood nearby and keep me updated in chat.

> Place a visible marker at this location so I can find it again.

## Staying in control

| In Minecraft | Action |
| --- | --- |
| `/mcp stop` | Disable agent actions, cancel its scripts and release controls |
| `/mcp start` | Allow agent actions again |
| `/mcp status` | Show whether control is enabled and how many tasks are active |
| `/mcp config` or **F8** | Open connection and chat settings |
| Mod Menu → Minecraft MCP → Configure | Open the same settings screen; **Done** or **Esc** returns to Mod Menu |

These are client-side commands. The mod interface and agent-authored in-game messages use English. `[AGENT]` messages stay in your local chat; they are not sent to a multiplayer server. Screenshots remain available while control is disabled. Leaving or changing worlds cancels old tasks.

The mod adds no blocks, items, entities or world-generation changes. Removing it does not require converting your save. Actions performed by the agent still affect your world and inventory, just as player actions do.

## Connection help

| Symptom | What to check |
| --- | --- |
| Connection refused | Launch the correct Minecraft instance and check the port in F8 settings |
| Authentication failed | Copy the same token into the agent’s connection settings, then restart its MCP connection |
| Agent control disabled | Enter `/mcp start` when you want the agent to resume |
| Plugin or tools missing | Confirm the plugin or MCP server is enabled, Node.js is installed, and open a new local chat |
| Port already in use | Give each simultaneously running instance a different port |
| Incompatible protocol | Update the mod and MCP plugin to compatible versions |

The `src/plugin.mjs` entrypoint used by the Codex plugin and the manual setups above reads `~/.config/minecraft-mcp/connection.json`. Set `MINECRAFT_MCP_CONNECTION` to use a different file. Explicit `MINECRAFT_MCP_PORT` and `MINECRAFT_MCP_TOKEN` values override the file's values. To configure the connection entirely through environment variables, launch `src/server.mjs` directly instead.

Minecraft and the MCP server must run on the same computer. The mod listens only on `127.0.0.1` and requires its token. Scripts run with the Minecraft process’s permissions, so connect agents you trust.

## Updating

Download compatible mod and agent packages from [GitHub Releases](../../releases), then:

- **Minecraft mod:** close Minecraft and replace the JAR in `mods/`.
- **Codex plugin:** replace the extracted package, run `codex plugin add minecraft-mcp@personal` again, and start a new chat.
- **Other clients or manual MCP setup:** replace the extracted package, update any separately installed Skill copy, and restart the MCP process.

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
assets/               Icons and selected playthrough screenshots
scripts/              Developer utilities
tests/                MCP protocol and real-client integration checks
```

The plugin metadata, Skill and MCP launch configuration sit at the plugin root. `src/` contains the MCP implementation; `mod/` contains the game integration. Keep gameplay scripts, notes and captures in a separate task workspace.

Build the Minecraft mod with JDK 25. Each profile produces a separate JAR from the shared bridge and a small client adapter:

```sh
./gradlew build -PmcProfile=26.1
./gradlew build -PmcProfile=26.2
./gradlew build -PmcProfile=26.3
```

The default profile is 26.3. On Windows, use `gradlew.bat`. Install the JAR from `build/<profile>/libs/`, excluding the `-sources.jar`. The 26.1 profile builds against 26.1.2; `-PmcVersion=26.1` or `-PmcVersion=26.1.1` selects another member of that group for development.

Package the agent plugin with Node.js 22 or later:

```sh
npm ci
mkdir -p build/distributions
npm pack --pack-destination build/distributions
```

The archive contains the server, runtime dependencies, Skill, plugin metadata and icons. Playthrough screenshots stay in the repository and are excluded from the agent package. The archive does not contain Minecraft, a launcher instance or pairing credentials.

The editable icon source is `assets/icon.svg`. Both the mod and plugin use its transparent 512 × 512 export, `assets/icon.png`; Gradle copies the PNG to the mod's resource path when building. When changing the SVG, refresh the PNG with an SVG renderer such as resvg and check that the terminal symbol and transparency are preserved.

[`npm test`](tests/protocol.test.mjs) checks the real stdio server through the official MCP SDK. These additional checks require a running disposable Minecraft client and the MCP port/token environment variables:

- [`npm run test:runtime`](tests/runtime.test.mjs): script execution, game-thread callbacks, mod discovery and screenshots.
- [`npm run test:mod`](tests/mod.test.mjs): settings UI, token rotation and authentication; also checks the settings entrypoint and return navigation when Mod Menu is installed.
- [`npm run test:live`](tests/live.test.mjs): movement, Baritone navigation, output, cancellation, markers and player takeover. Requires Baritone and a loaded world.

No mocked game clients are used. Launch a separate development client with `./gradlew runClient -PmcProfile=26.1 -PmcpRunDir=/absolute/test-instance`; the default run directory is version-specific and in the OS temporary folder. Give each test client a separate MCP port/token and pass those values to the tests. Run the client checks for each supported Minecraft version; source signature checks alone do not establish runtime compatibility.

The five MCP tools are `execute`, `read_output`, `stop`, `screenshot` and `chat`. Each execution gets a fresh JsMacros context; running scripts can continue and produce incremental output, but top-level variables are not shared between calls.

[Agent Skill](skills/minecraft-mcp/SKILL.md) · [API index](skills/minecraft-mcp/references/api-index.txt) · [Mod discovery](skills/minecraft-mcp/references/mods.md) · [Script utilities](skills/minecraft-mcp/scripts) · [Examples](skills/minecraft-mcp/examples)

## License

[MIT](LICENSE) © 2026 [Mak](https://github.com/MakkCH). Bundled third-party dependencies retain their own licenses.
