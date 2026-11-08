# F36: a 3×3×4 6× shulker box loader

[All projects](../README.md) · [Minecraft MCP](../../../README.md)

A single-item 6× loader that fits in 3×3×4 including piston movement, 25% smaller by bounding volume than [HaJiYue (真-哈基月)’s original 3×4×4 design (BV1qP4y1G7mz)](https://www.bilibili.com/video/BV1qP4y1G7mz/). Carted modules tile every three blocks at the same height.

GPT-6 Astra developed the design in Minecraft Java 26.3 through Minecraft MCP; I set the requirements and reviewed the prototypes. The finished machine uses vanilla mechanics.

![The cartless F36 core in Minecraft](images/cartless-core.png)

*The standalone cartless core. The waterway and external storage are outside the 3×3×4 core.*

[Watch the F36 video on Bilibili](https://www.bilibili.com/video/BV1JBW76CEM5/).

## Download the schematics

The schematics were exported from Minecraft Java 26.3 on November 8, 2026. All dimensions below use X × Y × Z (width × height × depth). The array is 16 blocks wide, 4 high and 5 deep.

| Download | Dimensions | Use |
| --- | --- | --- |
| [F36-carted-array-water.litematic](schematics/F36-carted-array-water.litematic?raw=true) | 16 × 4 × 5 | Four adjacent modules with a shared waterway; one hopper minecart per module. |
| [F36-carted-single-core.litematic](schematics/F36-carted-single-core.litematic?raw=true) | 3 × 3 × 4 | One core with its hopper minecart; use this variant when tiling. Supply and storage are external. |
| [F36-cartless-single-core.litematic](schematics/F36-cartless-single-core.litematic?raw=true) | 3 × 3 × 4 | One standalone core without a minecart, for use on its own. |

[SHA-256 checksums](schematics/SHA256SUMS). Download a schematic and try it in your own setup; [reports and suggestions](https://github.com/MakkCH/minecraft_mcp/issues) are welcome.

The files include block states, inventories and minecarts. When pasting a carted schematic, include entities and preserve their NBT. For a survival build, follow the minecart placement steps below; Litematica’s block overlay covers only the blocks.

## What the design does

- 6× filling, with a pause to replace each full box.
- Three-block tiling: carted modules fit side by side at the same height and orientation.
- Single-layer waterway: the array shares a waterway, with excess input flowing downstream to an overflow collection point.
- Cartless standalone option: a single module can run without a minecart. Tiled modules use a disabled hopper minecart, with one wooden shovel in each slot, to keep incoming items from spilling during box changes.

The name F36 refers to the core’s 36-block bounding volume. Waterways, output storage and temporary scaffolding sit outside it. The schematics include one working shulker box and nine spares per module, plus the minecarts and shovels for the carted versions.

## Build and use

1. Load the appropriate schematic in Litematica. Use the cartless core only for an isolated machine, or the carted variant for adjacent tiling.
2. For carted builds, preserve the disabled hopper minecart's exact position and put **one wooden shovel in each of its five slots**. The placement procedure is below.
3. Connect output storage beneath each core's local (1, −1, 1). The output barrel is not included in the schematics.
4. Keep one empty working box at (1, 1, 2) and spare empty boxes in the rear bottom dropper at (1, 0, 3). The exports contain nine spares per module. Refill before they run out.
5. For the array waterway, use waterlogged top-half stone slabs, let water settle naturally, and feed one item type upstream. Connect the downstream end to overflow collection or disposal.

<details>
<summary><strong>Carted build: minecart placement and startup</strong></summary>

For an overview of F36, [watch the project video](https://www.bilibili.com/video/BV1JBW76CEM5/). The step-by-step placement coordinates are below.

Coordinates are relative to the core's northwest bottom corner: X points east, Y up and Z south. Rotate the scaffolding, rail shapes and block states together when rotating the build. Facing values below are literal block states. The temporary scaffolding is removed after construction.

Prepare a stone floor at x=0…5, z=0…4, y=0. Place a temporary downward hopper at (2,1,1) and a comparator with `facing=east` at (1,1,2). Make a curved rail at (3,1,2) with `shape=south_west`, using a north–south rail at (3,1,3) and an east–west rail at (2,1,2). Remove the rail at (2,1,2) and replace it with the permanent west-facing dropper. Do not remove this dropper after embedding the cart.

Place stone at (3,2,2), a north–south activator rail at (3,3,2), and a redstone block at (4,3,2) to power it. Put a hopper minecart on the powered activator rail and let it become disabled. **Use an activator rail, not a detector rail.**

Apply the following changes in order. Each step can be separated by at least one second (20 game ticks); `air` means remove the block.

| Step | Coordinate | Block/state |
| --- | --- | --- |
| 01 | (3,3,2) | air |
| 02 | (4,3,2) | air |
| 03 | (3,2,2) | air |
| 04 | (3,1,2) | air |
| 05 | (3,1,3) | air |
| 06 | (4,0,2) | white_glazed_terracotta |
| 07 | (5,1,2) | piston[facing=west] |
| 08 | (4,1,2) | stone |
| 09 | (5,2,2) | redstone_block |
| 10 | (5,2,2) | air |
| 11 | (5,1,2) | air |
| 12 | (4,1,2) | air |
| 13 | (3,1,2) | air |
| 14 | (2,0,2) | air |
| 15 | (3,0,2) | oak_fence |
| 16 | (4,0,2) | piston[facing=west] |
| 17 | (4,1,2) | redstone_block |
| 18 | (4,1,2) | air |
| 19 | (4,0,2) | air |
| 20 | (3,0,2) | air |
| 21 | (2,0,2) | air |
| 22 | (2,0,2) | stone |
| 23 | (2,0,3) | air |
| 24 | (2,0,3) | mud |
| 25 | (2,−1,3) | piston[facing=up] |
| 26 | (3,−1,3) | redstone_block |
| 27 | (1,1,2) | air |
| 28 | (1,1,2) | mud |
| 29 | (1,2,2) | comparator[facing=east] |
| 30 | (3,2,2) | piston[facing=west] |
| 31 | (3,2,3) | redstone_block |
| 32 | (3,2,3) | air |
| 33 | (2,0,2) | air |
| 34 | (2,0,2) | mud |
| 35 | (2,0,1) | air |
| 36 | (2,0,1) | glass |

The mud lift raises the cart's bottom to Y=1.875; the upper west-facing piston extends and retracts to create the required small X overlap. Install the final mud at (2,0,2) and glass at (2,0,1) before removing the remaining scaffolding. Keep the embedded dropper at (2,1,2).

After settling, the cart's bottom is Y=0.875 and its X center is about 2.49. Keep the cart placed by this procedure rather than summoning a replacement at rounded coordinates. Its Z center moves naturally from about 2.75 to about 2.51 during piston operation. Fill all five slots with wooden shovels, and avoid contact with an unpowered activator rail, which would re-enable collection.

Place and break one shulker box before installing the rear hopper at (2,1,3); the cart must first move out of that hopper's placement space:

1. Keep the embedded dropper, mud, glass and filled, disabled cart. Install a downward output hopper at (1,0,1), storage beneath it at (1,−1,1), and an upward dispenser at (1,0,2) with one empty box.
2. Temporarily power the dispenser with a redstone block at (0,0,2). Wait for it to place the box, then remove that power source.
3. Install the north-facing box-breaking piston at (1,1,3). Power it with a temporary redstone block at (1,2,3), then remove the power and let the piston retract.
4. Recover the empty box from the output. The cart moves naturally to Z≈2.49 and can later settle near Z≈2.51. Keep the output hopper, dispenser and piston; do not reposition the cart manually.
5. Temporarily power the clock at (0,0,−1), and the south-facing sticky piston at (0,0,1) with a redstone block at (−1,0,1). Complete the remaining schematic blocks, except the moving observer at (0,0,2), working box and spare boxes. Do not break and replace the embedded dropper.
6. With the sticky piston extended, place the observer at (0,0,3) with its observing face pointing west. Remove the temporary power at (−1,0,1), allowing the piston to pull it back to (0,0,2). Leave (0,0,3) empty.
7. Put the recovered working box at (1,1,2), and nine spare boxes in the dropper at (1,0,3). Remove the temporary power at (0,0,−1), then start upstream input.

The three loading droppers are at (0,1,2) facing east, (1,2,2) facing down, and (2,1,2) facing west. Temporary rails, activator rail, pistons, fence, glazed terracotta, redstone blocks and stone supports are reusable construction tools and are not permanent additions to the core.

</details>

The downloadable design is covered by this repository's [MIT license](../../../LICENSE).
