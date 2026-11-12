---
name: minecraft-mcp
description: Control and inspect the player's real Minecraft client through MCP, JsMacros and installed mods. Use for gameplay, navigation, markers, screenshots, script debugging and player takeover.
---

# Minecraft MCP

Use ordinary filesystem/shell tools and a task workspace outside this repository and the installed Skill. Copy bundled scripts/examples there before editing; use files for substantial scripts. Do not build a shell or filesystem protocol inside Minecraft.

The MCP server and Skill run alongside the agent. Use `execute(file=...)` for scripts in the agent workspace: Node reads the file and sends its contents to the configured game bridge, whether Minecraft runs locally or on another computer. Use `execute(code=...)` for short inline scripts. Game screenshots and task output return through MCP; remote game access uses the same tools and file workflow.

Use English for in-game chat, marker labels and diagnostics. Send `chat` useful milestones without adding its tag.

## Observe and control

Read the player's state before acting; use `screenshot` when the view matters, without dumping base64 or re-emitting the image. Use the configured instance and discover its capabilities. If the bridge is unavailable, report the error and follow its diagnostics; settings are at F8 or `/mcp config`. Direct remote access requires the player to enable Allow remote and use the game computer's address; loopback access through a tunnel also works. Do not change network exposure without the player's instruction.

`running` means the script body is executing; `active` means native callbacks keep its context open. Keep either task ID for output and cleanup. `completed`, `stopped` and `error` are terminal. The execute wait deadline does not stop the script. Assign one output reader per task and check `dropped_chars` before relying on its output.

Verify outcomes with game state: script completion does not mean an autonomous mod reached its goal. After an uncertain transport timeout, inspect before repeating a mutating action.

Stop control when the human takes over. Even task-specific `stop` cancels shared Baritone movement and releases scripted keys. The player's `/mcp stop` also disables game actions: never bypass it; the player can resume with `/mcp start`. Screenshots remain available while disabled.

## Scripting

Variables do not survive executions. Return short JSON observations instead of Java object dumps; keep durable state in files.

Use `mcp.mainThread(fn)` for short game-thread operations; keep long work and tick waits outside its callback. Read [scripting.md](references/scripting.md) for thread semantics, callbacks, resource cleanup, [inspection scripts](references/scripting.md#scripts) and [examples](references/scripting.md#examples).

Use [mods.md](references/mods.md) to discover installed mod APIs. Search [api-index.txt](references/api-index.txt) with `rg` and read only relevant signatures and source links. The index covers JsMacros Reloaded 2.2.1 on 26.1–26.3; check the running version because helper behavior and raw Minecraft APIs can differ.
