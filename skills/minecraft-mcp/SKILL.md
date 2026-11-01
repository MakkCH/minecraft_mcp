---
name: minecraft-mcp
description: Control and inspect the player's real Minecraft client through the minecraft_mcp MCP server, JsMacros scripts and Baritone. Use for Minecraft gameplay, navigation, visual markers, screenshots, script debugging, incremental task output, and player takeover. Use normal filesystem and shell tools for writing scripts and looking up APIs.
---

# Minecraft MCP

Use the `minecraft_mcp` server's five tools. Keep files, code editing, searches and durable notes in the local filesystem through ordinary agent tools. Do not build another shell or filesystem protocol inside Minecraft.

## Start with observation

Read the player's current state before acting. For example, call `execute` with:

```js
const p = Player.getPlayer();
console.log(p ? {x:p.getX(), y:p.getY(), z:p.getZ()} : 'No world loaded');
```

Use `screenshot` when the view matters. It returns an image directly and an absolute PNG path for local inspection; do not dump base64 or emit the same image again. If the bridge is unavailable, report the connection error and check the instance and `/mcp status`; do not assume the game action succeeded.

## Execute, observe, stop

- `execute`: provide exactly one of `code` or an absolute local `file`. Write substantial scripts with normal file tools, then execute the file. `wait_ms` defaults to 1000 and is capped at 10000. Output may arrive before completion; keep the returned task ID.
- `read_output`: pass the task ID and optionally `wait_ms` up to 10000. This consumes only new output from an in-memory buffer; no file roundtrip is needed. Assign one reader per task. Inspect `dropped_chars` for overflow; don't treat truncated output as complete evidence.
- `stop`: omit `task` to stop all MCP-owned scripts, or specify one. Either form also cancels Baritone and releases scripted keys because they share one player. Stop ongoing control when the human takes over.
- `chat`: pass message text without the tag, e.g. `我已經收集了木材，下一步製作工具。` The configured colored `[AGENT]` tag and optional name are added automatically. This displays locally; it does not send multiplayer messages. Report useful milestones, not every poll.

Check result state and errors: `running` means script execution, `active` means native callbacks keep its context open, and `completed`, `stopped`, `error` are terminal. `active` does not prove movement; `completed` does not prove Baritone reached a goal. Verify the actual requested outcome with game state or screenshots. After an uncertain transport timeout, inspect before repeating a mutating action.

The player's `/mcp stop` disables further game actions. Respect it: do not re-enable control through another API. The player can resume with `/mcp start`. MCP `stop` cancels work without disabling the bridge. Screenshots remain available while disabled.

## Keep context small

Each execution is a fresh JsMacros GraalJS context, **not Node.js or a persistent REPL**. Variables do not survive across calls. Use `console.log` or `print` for explicit results; return short JSON-shaped observations instead of Java object dumps. Keep reusable code and durable state in files. Track only relevant task IDs and outcomes in conversational context.

Before scripting callbacks, Baritone navigation or overlays, read [scripting.md](references/scripting.md). Search [api-index.txt](references/api-index.txt) with `rg` for a needed method; read only the matching signatures and follow their versioned source links when semantics are unclear. The index targets JsMacros Reloaded 2.2.1 / Minecraft 26.3; do not assume older online JsMacros examples match. No need to load the full index into context.
