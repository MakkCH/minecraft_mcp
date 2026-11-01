# JsMacros scripting

Scripts are **GraalJS in JsMacros**, not Node.js. Each execution gets a fresh native context. `console.log`, `.info/.warn/.error/.debug` and `print` go to MCP; `Chat.log` goes to the game. Results are explicit: `console.log(value)`. Top-level `return`/`await` and Node built-ins are not supplied. Use `Client.waitTick(n)` inside task scripts and `JavaWrapper.methodToJava` for game callbacks. Never busy-loop or sleep on Minecraft's main thread. Java calls are trusted local code with the player's OS privileges.

Native APIs: `Player`, `World`, `Hud`, `Client`, `KeyBind`, `Chat`, `JsMacros`, `JavaWrapper`, `Java.type`. Search [api-index.txt](api-index.txt); follow the linked versioned source for more detail. Short strings/JSON are preferable to dumping Java objects.

Game-thread mutation:
```js
Client.runOnMainThread(JavaWrapper.methodToJava(() => {
  // Short game operation here. Never waitTick inside this callback.
}));
```

Baritone:
```js
const bot = Java.type('baritone.api.BaritoneAPI').getProvider().getPrimaryBaritone();
Client.runOnMainThread(JavaWrapper.methodToJava(() => {
  bot.getCommandManager().execute('goto 100 64 200');
}));
```

For drawings/commands created by a task, call `mcp.track(drawOrCommand)` so stop can unregister them. Task event listeners are removed on stop. Raw Java calls can create resources the bridge cannot discover: keep those scripts short and explicitly clean up. Script completion does not imply Baritone movement has finished; `stop` cancels it independently. Disconnect cancels old tasks and releases controls.
