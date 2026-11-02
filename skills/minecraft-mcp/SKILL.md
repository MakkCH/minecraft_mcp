---
name: minecraft-mcp
description: Control and inspect the player's real Minecraft client through the minecraft_mcp MCP server, JsMacros scripts and installed mods. Use for Minecraft gameplay, navigation, visual markers, screenshots, script debugging, incremental task output, and player takeover. Use normal filesystem and shell tools for writing scripts and looking up APIs.
---

# Minecraft MCP

Use the `minecraft_mcp` server's five tools. Use a task workspace outside this repository and the installed Skill for code, durable notes and outputs. Use ordinary filesystem/shell tools, and copy examples there before editing them. Do not build another shell or filesystem protocol inside Minecraft.

Use English for agent-authored in-game chat, marker labels and script diagnostics.

## Start with observation

Read the player's current state before acting. For example, call `execute` with:

```js
const p = Player.getPlayer();
console.log(p ? {x:p.getX(), y:p.getY(), z:p.getZ()} : 'No world loaded');
```

Use `screenshot` when the view matters. It returns the image directly over the connection; do not dump base64 or emit the same image again. Use the configured Minecraft instance and its installed capabilities; do not assume a particular launcher, world, server or modpack. If the bridge is unavailable, report the connection error and check the mod settings (F8 or `/mcp config`), MCP port/token and `/mcp status`; do not assume the game action succeeded.

## Execute, observe, stop

- `execute`: provide exactly one of `code` or an absolute local `file`. Write substantial scripts with normal file tools, then execute the file. `wait_ms` defaults to 1000 and is capped at 10000. Output may arrive before completion; keep the returned task ID.
- `read_output`: pass the task ID and optionally `wait_ms` up to 10000. This consumes only new output from an in-memory buffer; no file roundtrip is needed. Assign one reader per task. Inspect `dropped_chars` for overflow; don't treat truncated output as complete evidence.
- `stop`: omit `task` to stop all MCP-owned scripts, or specify one. Either form also cancels Baritone and releases scripted keys because they share one player. Stop ongoing control when the human takes over.
- `chat`: pass message text without the tag, e.g. `I have collected wood. Next, I will craft tools.` The configured colored `[AGENT]` tag and optional name are added automatically. This displays locally; it does not send multiplayer messages. Report useful milestones, not every poll.

Check result state and errors: `running` means script execution, `active` means native callbacks keep its context open, and `completed`, `stopped`, `error` are terminal. `active` does not prove movement; `completed` does not prove Baritone reached a goal. Verify the actual requested outcome with game state or screenshots. After an uncertain transport timeout, inspect before repeating a mutating action.

The player's `/mcp stop` disables further game actions. Respect it: do not re-enable control through another API. The player can resume with `/mcp start`. MCP `stop` cancels work without disabling the bridge. Screenshots remain available while disabled.

## Keep context small

Each execution is a fresh JsMacros GraalJS context, **not Node.js or a persistent REPL**. Variables do not survive across calls. Use `console.log` or `print` for explicit results; return short JSON-shaped observations instead of Java object dumps. Keep reusable code and durable state in files. Track only relevant task IDs and outcomes in conversational context.

For short game-thread operations use `mcp.mainThread(fn)`; it yields the JS context while waiting and propagates callback errors. Keep long work and tick waits outside its callback. Before scripting callbacks or overlays, read [scripting.md](references/scripting.md). To discover any installed mod, follow [mods.md](references/mods.md); it uses native metadata, local JAR inspection and direct Java calls. Read-only utilities are in [scripts](references/scripting.md#scripts); editable demonstrations are in [examples](references/scripting.md#examples). Search [api-index.txt](references/api-index.txt) with `rg` for a needed method; read only the matching signatures and follow their versioned source links when semantics are unclear. Its JsMacros Reloaded 2.2.1 signatures were checked against the 26.1, 26.2 and 26.3 source profiles; helper behavior and raw Minecraft APIs can differ. Check the running version and adapt to its API. No need to load the full index into context.
