# From an empty inventory to the End Poem

[All projects](../README.md) · [Minecraft MCP](../../../README.md)

On **November 1–2, 2026**, a Codex agent running **`gpt-6-astra`** with **`high` reasoning effort** used Minecraft MCP to gather resources, reach the End, defeat the Ender Dragon and enter the End Poem. It wrote and revised its own JavaScript throughout the run: mining and trading, recovering equipment after deaths, building safer routes, and eventually timing bed explosions behind a protective wall.

![The dragon egg and active exit portal after the final fight](images/exit-portal.png)

*At about 8 hours 21 minutes, the dragon is defeated and the exit portal is open.*

| Run | Recorded result |
| --- | --- |
| Starting state | Survival mode, empty inventory |
| Difficulty | Normal |
| Environment | Local single-player world with an integrated server; Minecraft Java 26.3, Fabric Loader 0.19.5, JsMacros Reloaded 2.2.1, Baritone API Fabric 1.20.0 |
| Completion | Dragon health reached zero; the exit portal opened; the End Poem was confirmed on screen |
| Elapsed time | About **8 hours 25 minutes** |
| Script execution | **856 tasks**, with **2,060 task responses** including follow-up output reads |
| Milestone journal | **19 screenshots** with timestamps and captions; four are selected here |

Elapsed time includes planning, debugging, recovery and pauses, measured from the initial request to confirmation of the ending screen.

The agent could inspect structured game state and Java APIs, use Baritone, write scripts with the local filesystem and shell, capture screenshots, and pause the single-player game while handling dangerous situations. It also read integrated-server state when checking completion. The initial request was to finish Minecraft; a later request added the screenshot journal.

<details>
<summary><strong>Run timeline and selected screenshots</strong></summary>

The timeline combines timestamped task output, progress messages and the screenshot journal. Times below are approximate elapsed hours and minutes from the initial request. Screenshots are unedited captures from the player's client.

| Elapsed time (h:mm) | Milestone |
| --- | --- |
| 0:00 | Started with an empty inventory; gathered wood, food, iron and equipment. |
| 0:32 | Activated a Nether portal and entered the Nether. |
| 0:40 | Located a Nether fortress and approached its blaze spawner. |
| 0:43–2:14 | Died during the initial approach and recovery attempts. Rebuilt equipment, stored valuables, established a respawn point, and added a low-health pause guard. |
| 2:46–3:09 | Recovered equipment through sheltered routes, fought blazes, and banked the first two blaze rods. |
| 3:49 | Died after a ghast knocked the player down; previously banked pearls and rods remained safe. |
| 5:01 | Finished the pearl-gathering phase with **15 ender pearls**, after repeated gold-mining and piglin-bartering trips. |
| 5:24–5:33 | Reached **seven blaze rods**, returned to the Overworld and crafted **14 eyes of ender**. |
| 5:45–5:56 | Used two eye trajectories to estimate the stronghold's location, travelled there, and found the portal room. |
| 6:01–6:09 | Survived a fall into the portal room's lava, secured the room, set a respawn point and activated the End portal. |
| 6:11–6:57 | Entered the End and cleared all ten crystals. A fall into the void during the tower work required rebuilding equipment and returning from the stronghold. |
| 7:05–7:48 | Repeated melee, shelter and recovery attempts made little progress against the dragon. Switched to preparing beds for explosive attacks. |
| 7:53–8:05 | Collected wool, crafted **12 beds**, recovered equipment and prepared a protected position beneath the central fountain. |
| 8:10 | First effective bed explosion: dragon health fell from **185 to 133.4**; player health remained **19.58/20**. |
| 8:13–8:21 | Repaired the blast shield between attempts. Three more effective explosions reduced dragon health to **75.6 → 24.4 → 0**. |
| 8:25 | Confirmed the **End Poem**, saved the final screenshot, then stopped automated actions. |

![The activated End portal in the stronghold](images/end-portal.png)

*At about 6 hours 8 minutes, the stronghold portal opens, with a respawn point and supplies nearby.*

![The dragon taking damage above the protected bed-explosion position](images/bed-strategy.png)

*At about 8 hours 10 minutes, the first effective bed explosion deals about 52 damage to the dragon and less than one health point to the player.*

![The End Poem displayed after entering the exit portal](images/end-poem.png)

*The End Poem at about 8 hours 25 minutes.*

</details>

<details>
<summary><strong>How the agent adapted</strong></summary>

The agent developed routines for inventory handling, mining, trading, navigation and combat during play. Across seven context compactions, scripts and checkpoint notes on disk carried its work forward.

Early deaths led to expensive rebuilds. Stored valuables, spare equipment, respawn beds and enclosed routes made later failures easier to recover from. Four hours and 52 minutes elapsed between first entering the Nether and gathering enough blaze rods and pearls, including Overworld resupply trips.

After clearing the crystals, the agent spent roughly 50 minutes trying melee positions, rebuilding shelters and recovering equipment. It then prepared beds. Placing and detonating a bed in the same game-thread callback prevented the dragon from destroying it first. Checking the head's position and repairing the shield made the attack repeatable. Four effective explosions finished the remaining 185 health in about 11 minutes.

Health checks, hazard avoidance and attack timing ran in client scripts while the model planned between actions. The agent also paused the single-player game in dangerous situations; that option would be unavailable on a server that keeps running.

To confirm completion, the agent checked dragon health and the exit portal, then captured the End Poem. An initial screen lookup returned `null` even though the ending had begun, so it inspected the GUI before taking the final screenshot.

</details>
