// Developer CLI: calls the real MCP server through the official client SDK.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const client=new Client({name:'minecraft-mcp-cli',version:'0.1.0'});
const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],env:process.env.MINECRAFT_MCP_CONFIG ? {MINECRAFT_MCP_CONFIG:process.env.MINECRAFT_MCP_CONFIG} : {},stderr:'inherit'});
try {
 await client.connect(transport);
 const result=await client.callTool({name:process.argv[2],arguments:JSON.parse(process.argv[3]||'{}')});
 for(const c of result.content) if(c.type==='text') console.log(c.text); else if(c.type==='image') console.log(`[image ${c.mimeType}, ${Math.round(c.data.length*3/4)} bytes]`);
 if(result.isError) process.exitCode=1;
} finally { await client.close(); }
