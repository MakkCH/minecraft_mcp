# Discover and call installed mods

Use the same path for every mod: installed metadata → public API signatures → direct Java interop. Cache useful versioned signatures in the task workspace; search them with `rg` instead of repeatedly dumping all classes.

On Fabric, identify the running game through `Client.getMod('minecraft').getVersion()`; `Client.mcVersion()` can return a launcher label such as `Fabric` in development. Get the instance directory from `Java.type('net.fabricmc.loader.api.FabricLoader').getInstance().getGameDir()`. Minecraft's JAR can live outside that directory in a shared launcher cache; inspect the `minecraft` mod container's origin instead of guessing a launcher path.

1. Run [discover-mods.js](../scripts/discover-mods.js) to list IDs and versions. `Client.isModLoaded(id)` is a cheap availability check. Pass `args: {modId: "jsmacros"}` to inspect one mod; on Fabric the script also returns official source links and local JAR paths.
2. Inspect that JAR with ordinary shell tools: `jar tf '/path/mod.jar' | rg '/api/.*class$'`, then `javap -classpath '/path/mod.jar' -public package.api.Interface`. Prefer public interfaces over obfuscated implementation classes. If types are missing, add the actual dependency JARs to the classpath; do not guess names from an older release.
3. Inspect a small live signature subset if needed:

```js
const Api = Java.type('baritone.api.IBaritone'); // replace with the discovered class
console.log(Java.from(Api.class.getMethods())
  .filter(m => /Process|Behavior/.test(String(m.getName()))).map(String));
```

4. Use `Java.type(className)` to call the API directly. For short game-thread operations use `mcp.mainThread(() => ...)`. Read the mod's versioned source for thread requirements and long-running actions. Reflection gives signatures, not semantics; some mods expose configuration or commands rather than a supported Java API.

## Baritone (verified 1.20.0)

Run [baritone-goto.js](../examples/baritone-goto.js) with `args: {x: 100, y: 64, z: 200}`. It checks that Baritone and a world are available, then starts a `GoalBlock` for the exact destination. Observe the player's position to confirm arrival; `isPathing() === false` alone does not mean the goal was reached.

For mining, building, exploration or following, inspect the relevant process through `javap` or the [versioned IBaritone source](https://github.com/cabaletta/baritone/blob/v1.20.0/src/api/java/baritone/api/IBaritone.java). The command manager also accepts Baritone commands.

Autonomous processes can keep moving after the initiating script ends. MCP `stop` cancels Baritone movement. For other mods, use their documented stop/restore operations when they retain control or change settings.
