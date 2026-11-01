const player = Player.getPlayer();
console.log({name:String(player.getName()), x:player.getX(), y:player.getY(), z:player.getZ()});
console.log('Mods:', Java.from(Client.getLoadedMods()).map(m => ({id:String(m.getId()), version:String(m.getVersion())})));
