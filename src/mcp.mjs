import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pkg from '../package.json' with { type: 'json' };

// JSON-RPC already constrains nested values to JSON. Preserve all object keys
// instead of reconstructing records (which silently drops __proto__ fields).
const scriptArgs = z.unknown().refine(value => value !== null && typeof value === 'object' && !Array.isArray(value),
  'args must be a JSON object').meta({type:'object', additionalProperties:true});
export function createMcpServer({url, token}) {
  let connected = false;
  const server = new McpServer({name:'minecraft_mcp', version:pkg.version}, {
    instructions: "Controls the player's real Minecraft client. Player /mcp stop takes priority."
  });
  async function jsonRequest(path, body, timeout) {
    let response;
    try {
      response = await fetch(new URL(path, url), {
        method:body ? 'POST' : 'GET', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
        ...(body ? {body:JSON.stringify(body)} : {}), redirect:'error', signal:AbortSignal.timeout(timeout)
      });
    } catch (error) {
      throw new Error(`${error.message}${error.cause ? ': '+error.cause.message : ''}. Check the bridge URL/port and /mcp status.`);
    }
    let result;
    try { result = await response.json(); }
    catch { throw new Error(`HTTP ${response.status}: bridge returned a non-JSON response; check the bridge URL and reverse proxy.`); }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result?.error || response.statusText}`);
    if (result.error && !result.task) throw new Error(result.error);
    return result;
  }
  async function request(path, body, waitMs = 0) {
    if (!token) throw new Error('Set MINECRAFT_MCP_TOKEN to the token shown in the mod settings');
    if (!connected) {
      const info = await jsonRequest('status', undefined, 5000);
      const release = pkg.version.split('.').slice(0, 2).join('.');
      const modRelease = typeof info.version === 'string' ? info.version.split('.').slice(0, 2).join('.') : undefined;
      if (modRelease !== release) {
        throw new Error(`Incompatible Minecraft MCP versions: MCP server ${pkg.version}, mod ${info.version ?? 'unknown'}. Install mod ${release}.x or an MCP server matching the mod's major.minor version.`);
      }
      connected = true;
    }
    return jsonRequest(path, body, Math.max(20000, waitMs + 10000));
  }
  const text = result => ({content:[{type:'text', text:JSON.stringify(result)}]});
  const safe = fn => async args => {
    try { return await fn(args); }
    catch (error) { return {isError:true, content:[{type:'text', text:error.message}]}; }
  };
  server.registerTool('execute', {
    description:'Run JS code OR a .js file in a fresh JsMacros context. Relative file paths resolve from the MCP working directory. Native JsMacros and installed mod Java APIs are available. console.log/print are captured. Waits up to wait_ms for the script body to finish, then returns a task ID and buffered output; retain the ID for read_output or stop when running or active. args is available as mcp.args. Reaching the wait deadline leaves the script running.',
    inputSchema:{code:z.string().optional(), file:z.string().optional(), args:scriptArgs.optional(), wait_ms:z.number().int().min(0).max(30000).default(1000)}
  }, safe(async ({code,file,args,wait_ms}) => {
    if ((code === undefined) === (file === undefined)) throw new Error('Provide exactly one of code or file');
    if (file !== undefined) { file = resolve(file); code = await readFile(file, 'utf8'); }
    const body = {op:'execute', code, file, args};
    if (Buffer.byteLength(JSON.stringify(body)) > 1048576) throw new Error('Script and args exceed the 1 MiB request limit');
    const task = await request('command', body);
    return text(await request(`output?task=${encodeURIComponent(task.task)}&wait_ms=${wait_ms}&wait_for_completion=true`, undefined, wait_ms));
  }));
  server.registerTool('read_output', {
    description:'Read and consume newly buffered output for a task, plus its native execution state. Use one reader per task. Overflow is marked inline as [ …N bytes truncated… ]. Errors include script stack traces and precede output. Waits until output arrives, the task ends or wait_ms elapses.',
    inputSchema:{task:z.string(), wait_ms:z.number().int().min(0).max(30000).default(0)}
  }, safe(async ({task,wait_ms}) => text(await request(`output?task=${encodeURIComponent(task)}&wait_ms=${wait_ms}`, undefined, wait_ms))));
  server.registerTool('stop', {
    description:'Stop one MCP-owned JsMacros task, or all MCP tasks when task is omitted. Also cancel Baritone and release scripted input for player takeover.',
    inputSchema:{task:z.string().optional()}
  }, safe(async ({task}) => text(await request('command', {op:'stop',task}))));
  server.registerTool('screenshot', {
    description:'Capture the actual Minecraft framebuffer including HUD, menus and overlays. Returns the image directly.', inputSchema:{}
  }, safe(async () => {
    const result = await request('command', {op:'screenshot'});
    if (result.mimeType !== 'image/png' || typeof result.data !== 'string') throw new Error('Invalid screenshot response');
    return {content:[{type:'image', mimeType:result.mimeType, data:result.data}]};
  }));
  server.registerTool('chat', {
    description:'Display a progress message in the player’s local Minecraft chat. The configured tag, name and colors are added automatically. Only the local player sees it.',
    inputSchema:{message:z.string().min(1).max(2000)}
  }, safe(async ({message}) => text(await request('command', {op:'chat',message}))));
  return server;
}
