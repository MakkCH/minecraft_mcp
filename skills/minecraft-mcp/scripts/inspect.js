console.log(mcp.mainThread(() => {
  const player = Player.getPlayer();
  return player ? {
    name: String(player.getName()),
    x: player.getX(), y: player.getY(), z: player.getZ()
  } : null;
}));
