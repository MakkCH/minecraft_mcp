# Verified on 2026-11-01

Environment: macOS arm64, Node 24.4.1, Minecraft 26.3 / Java 25, Fabric Loader 0.19.5, Fabric API 0.160.6+26.3, JsMacros Reloaded 2.2.1, Baritone API Fabric 1.20.0.

The launcher imported `dist/minecraft_mcp-26.3.mrpack` through its UI into the separate `minecraft_mcp` instance. `bootstrap.js` started automatically as an enabled native JsMacros service. A new disposable single-player world, `minecraft_mcp Test World`, was used; existing worlds were not modified.

Passed:
- JDK 21-target compilation of the helper JAR.
- Official MCP SDK client → actual stdio server: negotiation, tool discovery and schema rejection (`npm test`).
- Node test runner → official MCP SDK → actual Minecraft (`npm run test:live`): player/Java access, incremental output without duplication, cooperative cancellation, tight-loop cancellation, actual held-key release, runtime/syntax errors, real Baritone navigation to a nearby goal, native 3D overlay registration and cleanup, `/mcp status`, `/mcp stop` rejecting execution, `/mcp start` restoring execution, colored local chat component, real PNG capture matching its saved file.
- Baritone moved the actual player to the requested X/Z goal. Measurements are in `artifacts/navigation.json`.
- Final bootstrap reload and compact `/mcp status` checked using the same config path registered in Codex.
- Published release hashes verified for all three packaged mods.
- Codex `mcp get minecraft_mcp` reports enabled stdio transport with absolute Node/server paths.

No mocks or fake game implementations were used. Local test output and screenshots are in ignored `artifacts/`; source tests are committed. `npm run test:live` requires the real client, an entered world and enabled Agent control. It deliberately moves the player a short distance and exercises local commands.

Not measured: combat performance, long-session endurance, multiplayer-server compatibility, or benchmark scores. The existing Codex conversation does not acquire newly registered tools automatically; start a new conversation to load the MCP server.
