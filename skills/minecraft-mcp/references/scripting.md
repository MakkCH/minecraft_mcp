# JsMacros scripting

Scripts are **GraalJS in JsMacros**, not Node.js. Each execution gets a fresh native context. `console.log`, `.info/.warn/.error/.debug` and `print` go to MCP; `Chat.log` goes to the game. Results are explicit: `console.log(value)`. Top-level `return`/`await` and Node built-ins are not supplied. Java calls are trusted local code with the player's OS privileges.

Native APIs: `Player`, `World`, `Hud`, `Client`, `KeyBind`, `Chat`, `JsMacros`, `JavaWrapper`, `Java.type`. Search [api-index.txt](api-index.txt); follow the versioned source for semantics. Use [mods.md](mods.md) to discover any installed mod's APIs. Short JSON is preferable to dumping Java objects.

## Main-thread operations

Use `mcp.mainThread(fn)` for a short game-thread operation. It waits through JsMacros's context-aware mechanism, returns the callback value and rethrows callback errors into the task output:

```js
const position = mcp.mainThread(() => {
  const p = Player.getPlayer();
  return {x:p.getX(), y:p.getY(), z:p.getZ()};
});
console.log(position);
```

It calls `Client.runOnMainThread(JavaWrapper.methodToJava(fn), true, 5000)` with error/result capture. There is no extra tick wait, MCP roundtrip, or mod-specific wrapper. Group related short mutations into one callback. Keep navigation polling, mining completion, I/O and expensive computation outside it. Use `Client.waitTick(n)` in the task script to yield between observations, never inside a main-thread callback.

The native **one-argument** `Client.runOnMainThread(...)` is fire-and-forget. If the originating script keeps the GraalJS context occupied, the main thread waits for that same context until the watchdog closes it. Raw Java `Thread.sleep`, futures/latches and JS busy loops do not release this lock. `methodToJavaAsync` is not a substitute: it moves execution to a worker instead of keeping the operation on the game thread. Do not fix watchdog errors by increasing the timeout or disabling it. Split long work and use the waiting helper; inspect game state before retrying an action that may already have executed. Raw JsMacros APIs remain available when their semantics are needed.

## Lifetimes and examples

For drawings/commands created by a task, call `mcp.track(drawOrCommand)` so stop can unregister them. Task event listeners are removed on stop. Raw Java calls can create resources the bridge cannot discover: explicitly clean up those resources. Errors in later native callbacks can go to the game log rather than task output; catch and `console.error` them.

Runnable examples live in the Skill's `scripts/` directory. Pass their **absolute paths** to `execute(file=...)`, or copy/edit them with local file tools:

- [inspect.js](../scripts/inspect.js): player and installed mod inventory; requires a world.
- [discover-mods.js](../scripts/discover-mods.js): mod inventory or one mod's version, source links and JAR paths.
- [marker.js](../scripts/marker.js): tracked 3D marker, removed by `stop`.
- [baritone-goto.js](../scripts/baritone-goto.js): edit its destination before executing; moves the real player.
- [baritone-nearby.js](../scripts/baritone-nearby.js): two-block navigation exercise for a disposable world.

A script returning does not mean an autonomous mod finished its action. Observe its native progress and the player's actual state. `stop` cancels Baritone independently; disconnect cancels old tasks and releases controls.
