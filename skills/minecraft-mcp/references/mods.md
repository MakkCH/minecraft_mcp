# Discover and call installed mods

Use the same path for every mod: installed metadata → public API signatures → direct Java interop. No new MCP endpoint or bridge integration is required. Cache useful versioned signatures in the task workspace; search them with `rg` instead of repeatedly dumping all classes.

1. Run [discover-mods.js](../scripts/discover-mods.js) to list IDs and versions. `Client.isModLoaded(id)` is a cheap availability check. Copy it into the task workspace and set `modId` to inspect one mod; on Fabric it also returns official source links and local JAR paths. These are metadata, not permission to install or enable another mod.
2. Inspect that JAR with ordinary shell tools: `jar tf '/path/mod.jar' | rg '/api/.*class$'`, then `javap -classpath '/path/mod.jar' -public package.api.Interface`. Prefer public interfaces over obfuscated implementation classes. If types are missing, add the actual dependency JARs to the classpath; do not guess names from an older release.
3. Inspect a small live signature subset if needed:

```js
const Api = Java.type('baritone.api.IBaritone'); // replace with the discovered class
console.log(Java.from(Api.class.getMethods())
  .filter(m => /Process|Behavior/.test(String(m.getName()))).map(String));
```

4. Use `Java.type(className)` to call the API directly. For short game-thread operations use `mcp.mainThread(() => ...)`. Read the mod's versioned source for thread requirements and long-running actions. Reflection gives signatures, not semantics; some mods expose configuration or commands rather than a supported Java API.

## Baritone (verified 1.20.0)

```js
if (!Client.isModLoaded('baritone')) throw new Error('Baritone is not installed');
const bot = Java.type('baritone.api.BaritoneAPI').getProvider().getPrimaryBaritone();
// Starting a path is short; do not wait for arrival inside this callback.
mcp.mainThread(() => bot.getCommandManager().execute('goto 100 64 200'));
console.log({pathing:bot.getPathingBehavior().isPathing()});
```

Edit the destination before executing. The same command manager supports mining/building commands; the public API also exposes mining, building, exploration, following and goal processes. Discover only the relevant interfaces via `javap` or the [versioned IBaritone source](https://github.com/cabaletta/baritone/blob/v1.20.0/src/api/java/baritone/api/IBaritone.java). Existing goal examples are in [examples](scripting.md#examples). Observe position/inventory and the relevant process; `isPathing() === false` alone does not mean the task succeeded.

Baritone retains its normal native pathfinding and speed. The only bridge-specific behavior is optional cancellation/input cleanup on player takeover: an autonomous process can keep moving after its initiating JS context ends. Other mods do not inherit a fictitious universal cancel API; use their documented stop/restore operations when they retain control or change settings.
