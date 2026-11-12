# JsMacros scripting

`console.log`, `.info/.warn/.error/.debug` and `print` go to MCP; `Chat.log` goes to the game. Top-level `return`/`await` and Node built-ins are not supplied. Java calls are trusted local code with the player's OS privileges.

## Main-thread operations

Use `mcp.mainThread(fn)` for a short game-thread operation. It waits through JsMacros's context-aware mechanism, returns the callback value and rethrows callback errors into the task output:

```js
const position = mcp.mainThread(() => {
  const p = Player.getPlayer();
  return p ? {x:p.getX(), y:p.getY(), z:p.getZ()} : 'No world loaded';
});
console.log(position);
```

It calls `Client.runOnMainThread(JavaWrapper.methodToJava(fn), true, 5000)` with error/result capture. Group related short mutations into one callback. Keep navigation polling, mining completion, I/O and expensive computation outside it. Use `Client.waitTick(n)` in the task script to yield between observations, never inside a main-thread callback.

The native **one-argument** `Client.runOnMainThread(...)` is fire-and-forget. If the originating script keeps the GraalJS context occupied, the main thread waits for that same context until the watchdog closes it. Raw Java `Thread.sleep`, futures/latches and JS busy loops do not release this lock. `methodToJavaAsync` is not a substitute: it moves execution to a worker instead of keeping the operation on the game thread. Do not fix watchdog errors by increasing the timeout or disabling it. Split long work and use the waiting helper.

## Lifetimes

For drawings/commands created by a task, call `mcp.track(drawOrCommand)` so stop can unregister them. Task event listeners are removed on stop. Raw Java calls can create resources the bridge cannot discover: explicitly clean up those resources. Errors in later native callbacks can go to the game log rather than task output; catch and `console.error` them.

## Scripts

Ready-to-run inspection utilities live in `scripts/` on the agent computer. Pass their absolute paths to `execute(file=...)`; the local Node MCP server reads and forwards the contents to the game bridge. This works unchanged for a local or remote game.

- [inspect.js](../scripts/inspect.js): player and installed mod inventory; requires a world.
- [discover-mods.js](../scripts/discover-mods.js): mod inventory or one mod's version, source links and JAR paths.

## Examples

Demonstrations live in `examples/`. Adapt workspace copies to the current world and installed APIs before executing.

- [marker.js](../examples/marker.js): tracked 3D marker, removed by `stop`.
- [baritone-goto.js](../examples/baritone-goto.js): choose a destination; requires Baritone and moves the real player.
- [baritone-nearby.js](../examples/baritone-nearby.js): two-block navigation exercise for a disposable world with Baritone.

Leaving or changing the Minecraft world cancels old tasks and releases controls. Disconnecting the MCP client does not stop game scripts; use `stop` or the player's `/mcp stop`.
