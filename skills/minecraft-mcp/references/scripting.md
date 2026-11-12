# JsMacros scripting

`console.log`, `.info/.warn/.error/.debug` and `print` go to MCP; `Chat.log` goes to the game. Top-level `return`/`await` and Node built-ins are not supplied. Java calls are trusted local code with the player's OS privileges.

## Files and arguments

For `build.js` in the MCP server's working directory:

```js
execute({file: "build.js", args: {seed: 1099}, wait_ms: 30000})
```

In `build.js`:

```js
const observe = require('./lib/observe.js');
console.log({seed: mcp.args.seed, position: observe()});
```

Relative `file` paths resolve from the MCP working directory. `require()` resolves relative to the script's directory and uses JsMacros's native CommonJS loader. Each execution has a fresh context and module cache. With an optional remote game connection, `file` is read on the MCP computer, but `require()` and script filesystem calls use the game computer.

`args` is a JSON object and defaults to `{}`. Inline `code` also accepts it. The complete request accepts up to 1 MiB of UTF-8 JSON.

`execute` waits for the script body to finish; `read_output` returns when output arrives or the task ends. Both accept `wait_ms` from `0` to `30000`; their defaults are `1000` and `0`. Reaching the deadline returns the task state without stopping it.

## Errors and output

Read `error` before `output`. Script errors include stack traces with original file, line and column locations. Inline scripts are named `inline.js`.

Output retains the most recent 64 KiB of UTF-8 text. Each read consumes it. Discarded output is marked with `[ …N bytes truncated… ]`. Errors are retained separately, keep their beginning and have a 256 KiB limit.

## Main-thread operations

Use `mcp.mainThread(fn)` for game-thread mutations and consistent snapshots of related state. The helper waits for the callback, returns its value and rethrows callback errors. [inspect.js](../scripts/inspect.js) shows a player snapshot and returns `null` when no world is loaded. Action scripts such as navigation fail with an error when a world is required.

Simple getters can be read directly when a changing value is acceptable. Check the called API's thread requirements. Group related short mutations into one callback. Keep navigation polling, mining completion, I/O and expensive computation outside it. Use `Client.waitTick(n)` in the task script to yield between observations, never inside a main-thread callback.

The helper captures the callback's result or error and dispatches through `Client.runOnMainThread(..., true, 5000)`. The final argument sets a 5,000-millisecond watchdog limit for the main-thread lock. The MCP tool wait deadline is separate. See the [JsMacros implementation](https://github.com/grepsedawk/JsMacros/blob/v2.2.1/src/client/java/xyz/wagyourtail/jsmacros/client/api/library/impl/FClient.java).

The native **one-argument** `Client.runOnMainThread(...)` is fire-and-forget. If the originating script keeps the GraalJS context occupied, the main thread waits for that same context until the watchdog closes it. Raw Java `Thread.sleep`, futures/latches and JS busy loops do not release this lock. `methodToJavaAsync` is not a substitute: it moves execution to a worker instead of keeping the operation on the game thread. Do not fix watchdog errors by increasing the timeout or disabling it. Split long work and use the waiting helper.

## Lifetimes

For drawings/commands created by a task, call `mcp.track(drawOrCommand)` so stop can unregister them. Task event listeners are removed on stop. Raw Java calls can create resources the bridge cannot discover: explicitly clean up those resources. Errors in later native callbacks can go to the game log rather than task output; catch and `console.error` them.

Disconnecting from a server or leaving a singleplayer world cancels tasks and releases controls; changing dimensions does not. Disconnecting the MCP client does not stop game scripts; use `stop` or the player's `/mcp stop`.
