const player = Player.getPlayer();
console.log({name:String(player.getName()), x:player.getX(), y:player.getY(), z:player.getZ()});
console.log('Baritone available:', Java.type('baritone.api.BaritoneAPI').getProvider().getPrimaryBaritone() != null);
