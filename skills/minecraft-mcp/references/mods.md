# Discover and call installed mods

Use the same path for every mod: installed metadata → public API signatures → direct Java interop. Cache useful versioned signatures in the task workspace; search them with `rg` instead of repeatedly dumping all classes.

On Fabric, identify the running game through `Client.getMod('minecraft').getVersion()`; `Client.mcVersion()` can return a launcher label such as `Fabric` in development. Get the instance directory from `Java.type('net.fabricmc.loader.api.FabricLoader').getInstance().getGameDir()`. Minecraft's JAR can live outside that directory in a shared launcher cache; inspect the `minecraft` mod container's origin instead of guessing a launcher path.

1. Run [discover-mods.js](../scripts/discover-mods.js) to list IDs and versions. `Client.isModLoaded(id)` is a cheap availability check. Pass `args: {modId: "jsmacros"}` to inspect one mod; on Fabric the script also returns official source links and local JAR paths.
2. List classes with `jar tf '/path/mod.jar'`. Search for the feature name or an API package, then inspect a candidate with `javap -classpath '/path/mod.jar' -public package.name.ClassName`. Prefer public interfaces over obfuscated implementation classes. If types are missing, add the actual dependency JARs to the classpath; do not guess names from an older release.
3. Inspect a small live signature subset if needed:

```js
const Api = Java.type('baritone.api.IBaritone'); // replace with the discovered class
console.log(Java.from(Api.class.getMethods())
  .filter(m => /Process|Behavior/.test(String(m.getName()))).map(String));
```

4. Use `Java.type(className)` to call the API directly. For short game-thread operations use `mcp.mainThread(() => ...)`. Some mods expose commands or configuration as their supported interface.

Check thread requirements and cleanup scope in source matching the loaded version, or inspect the installed implementation with `javap -c`. If a mod has no suitable cleanup method, keep the action within the lifetime of the script.

## Baritone example

[baritone-goto.js](../examples/baritone-goto.js) takes integer `x` and `z`, plus an optional `y` for an exact destination. It tracks the custom goal process and waits until the player's feet reach the goal. Run it with the default `keep_alive: false`.

Baritone reuses its process objects. Finish or stop the previous task before reusing its process so old cleanup cannot cancel new work. Its `IPathingBehavior.forceCancel()` interrupts the current path and signals every registered process on that Baritone instance to relinquish control.
