// Pass args.modId to inspect one mod's metadata and local JAR paths.
const modId = mcp.args.modId ?? null;
if (modId === null) {
  console.log(Java.from(Client.getLoadedMods()).map(m => ({
    id: String(m.getId()), name: String(m.getName()), version: String(m.getVersion())
  })));
} else {
  const info = Client.getMod(modId);
  if (!info) throw new Error('Mod not installed: ' + modId);
  const result = {id: String(info.getId()), version: String(info.getVersion()), description: String(info.getDescription())};
  if (Client.getModLoader() === 'Fabric') {
    const container = Java.type('net.fabricmc.loader.api.FabricLoader').getInstance().getModContainer(modId).get();
    result.paths = Java.from(container.getOrigin().getPaths()).map(String);
    result.links = Object.fromEntries(Java.from(container.getMetadata().getContact().asMap().entrySet().toArray())
      .map(e => [String(e.getKey()), String(e.getValue())]));
  }
  console.log(result);
}
