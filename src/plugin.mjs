// Plugin settings live outside the installed package so updates keep pairing intact.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const path = process.env.MINECRAFT_MCP_CONNECTION || join(homedir(), '.config', 'minecraft-mcp', 'connection.json');
try {
  const config = JSON.parse(await readFile(path, 'utf8'));
  if (!config || typeof config.token !== 'string' || config.token.length < 32 ||
      !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) {
    throw new Error('Expected a port (1024–65535) and a token of at least 32 characters');
  }
  process.env.MINECRAFT_MCP_PORT ??= String(config.port);
  process.env.MINECRAFT_MCP_TOKEN ??= config.token;
} catch (error) {
  if (error.code !== 'ENOENT' || process.env.MINECRAFT_MCP_CONNECTION) {
    // JSON parse errors may contain the token: do not echo their input or message.
    throw new Error(`Cannot load Minecraft MCP connection settings at ${path}. Check the port/token JSON.`);
  }
}
await import('./server.mjs');
