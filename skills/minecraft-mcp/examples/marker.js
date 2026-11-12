// Visual marker three blocks in front of the player. stop({task}) removes it.
const position = mcp.mainThread(() => {
  const player = Player.getPlayer();
  if (!player) throw new Error('No world loaded');
  const yaw = player.getYaw() * Math.PI / 180;
  const x = player.getX() - Math.sin(yaw) * 3;
  const y = player.getY();
  const z = player.getZ() + Math.cos(yaw) * 3;
  const draw = mcp.track(Hud.createDraw3D());
  draw.addBox(x - 0.5, y, z - 0.5, x + 0.5, y + 1, z + 0.5,
    0x00FFFF, 220, 0x00FFFF, 48, true);
  draw.register();
  return {x, y, z};
});
console.log({position});
