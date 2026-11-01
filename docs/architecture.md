# Architecture

Codex fs/shell → local .js files and documentation.
Codex MCP → Node MCP SDK (stdio) → authenticated loopback HTTP → small JDK bridge → bootstrap.js → native JsMacros contexts and Baritone.

The Java helper has no Minecraft dependencies. HTTP workers never execute scripts: they enqueue small requests. A JsMacros Tick listener dispatches them into native `runScript` contexts; the bootstrap context stays available while a separate script runs. Output uses synchronized bounded buffers and HTTP reads independent of game ticks. No disk round trip is needed for text output. Screenshots use the native screenshot API and return MCP image content.

The bridge records only output and references to native contexts, not a second scheduler. 128 retained task records and 64 pending requests bound retained state. Finished records are evicted when capacity is needed. `read_output` is a single-consumer drain, not a durable delivery protocol; disconnect/retry after a response was consumed may lose that chunk. An output overflow is explicitly reported. Preserve important output with normal local files.

Execution returns captured console output, errors and native task state. Fresh contexts avoid hidden cross-execution globals; callbacks can keep a task active. `mcp.track(registrable)` handles overlay cleanup. Explicit stop also cancels Baritone globally because the player has one movement controller. Other manually started JsMacros scripts are not closed.

A stalled game main thread can prevent command dispatch and screenshots. Network request timeouts do not imply an already dispatched game action was undone. Do not automatically retry mutations. `/mcp stop` cannot undo irreversible in-game actions or arbitrary native Java side effects.

Sources: JsMacros Reloaded v2.2.1 FJsMacros, ServiceManager, EventService, FPlayer, FClient; Baritone v1.20.0 API; official MCP TypeScript SDK 1.32.2. Source links are in api-index.txt.

Unhandled errors in later native callbacks can be reported by JsMacros to the game log rather than the completed script callback. Use try/catch with console.error in long-lived event handlers. `active` indicates an open native callback context, not proof that a particular game action is still running.
