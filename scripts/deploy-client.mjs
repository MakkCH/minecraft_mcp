// Update only this project's files in the specified Minecraft instance.
import { copyFile, mkdir, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const instance=process.argv[2];
if(!instance) throw new Error('Usage: node scripts/deploy-client.mjs /absolute/instance');
const target=join(resolve(instance),'config/jsMacros/Macros/minecraft_mcp');
await mkdir(target,{recursive:true});
for(const name of ['bootstrap.js','minecraft-mcp-bridge.jar']) await copyFile(new URL('../dist/'+name,import.meta.url),join(target,name));
await chmod(join(target,'config.json'),0o600);
console.log(target);
