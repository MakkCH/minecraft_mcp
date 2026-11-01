#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = process.env.MINECRAFT_MCP_CONFIG || resolve(root, '.runtime/config.json');
const server = new McpServer({name:'minecraft_mcp', version:'0.1.0'}, {
  instructions: `Controls the player's real Minecraft client. Follow the minecraft-mcp skill at ${root}/skills/minecraft-mcp/SKILL.md for workflows and API lookup. Player /mcp stop takes priority.`
});
async function request(path, body) {
  const cfg = JSON.parse(await readFile(configPath, 'utf8'));
  if (!Number.isInteger(cfg.port) || cfg.port < 1024 || cfg.port > 65535) throw new Error('Invalid bridge port');
  const response = await fetch(`http://127.0.0.1:${cfg.port}${path}`, {
    method: body ? 'POST' : 'GET', headers: {Authorization:`Bearer ${cfg.token}`, 'Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(20000)
  });
  const result = await response.json();
  if (!response.ok || result.error && !result.task) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
const text = result => ({content:[{type:'text', text:JSON.stringify(result)}]});
const safe = fn => async args => {
  try { return await fn(args); }
  catch (error) { return {isError:true, content:[{type:'text', text:`${error.message}${error.cause ? ': '+error.cause.message : ''}. Check Minecraft and /mcp status. Config: ${configPath}`} ]}; }
};
server.registerTool('execute', {
  description:'Run JS code OR an absolute local .js file in a fresh JsMacros context. Native Player/World/Hud/Java APIs and Baritone are available. console.log/print are captured. Returns early with task ID when still running; use read_output. This is GraalJS, not Node.js.',
  inputSchema:{code:z.string().max(900000).optional(), file:z.string().optional(), wait_ms:z.number().int().min(0).max(10000).default(1000)}
}, safe(async ({code,file,wait_ms}) => {
  if ((code === undefined) === (file === undefined)) throw new Error('Provide exactly one of code or file');
  if (file) { file = resolve(file); code = await readFile(file, 'utf8'); }
  const task = await request('/command', {op:'execute', code, file});
  return text(await request(`/output?task=${encodeURIComponent(task.task)}&wait_ms=${wait_ms}`));
}));
server.registerTool('read_output', {
  description:'Read and consume newly buffered output for a task, plus its native execution state. No filesystem needed. Single-reader stream; no output is repeated. Bounded buffer reports dropped_chars on overflow.',
  inputSchema:{task:z.string(), wait_ms:z.number().int().min(0).max(10000).default(0)}
}, safe(async ({task,wait_ms}) => text(await request(`/output?task=${encodeURIComponent(task)}&wait_ms=${wait_ms}`))));
server.registerTool('stop', {
  description:'Stop one MCP-owned JsMacros task or all MCP tasks. Also cancel Baritone and release scripted input for player takeover. Does not stop the bridge service.',
  inputSchema:{task:z.string().optional()}
}, safe(async ({task}) => text(await request('/command', {op:'stop',task}))));
server.registerTool('screenshot', {
  description:'Capture the actual Minecraft framebuffer including HUD, menus and overlays. Returns the image directly and its absolute local path.', inputSchema:{}
}, safe(async () => {
  const result = await request('/command', {op:'screenshot'});
  const image = await readFile(result.path);
  return {content:[{type:'image', mimeType:'image/png', data:image.toString('base64')}, {type:'text',text:JSON.stringify(result)}]};
}));
server.registerTool('chat', {
  description:'Display a progress message in the player’s local Minecraft chat as [AGENT] message. Tag, optional name, and colors come from config. Does NOT send server chat or execute chat commands.',
  inputSchema:{message:z.string().min(1).max(2000)}
}, safe(async ({message}) => text(await request('/command', {op:'chat',message}))));
await server.connect(new StdioServerTransport());
