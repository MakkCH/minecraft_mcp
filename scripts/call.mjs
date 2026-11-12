// Developer CLI: calls the real MCP server through the official client SDK.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const client = new Client({name: 'minecraft-mcp-cli', version: '0.1.0'});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('../src/server.mjs', import.meta.url))],
  env: Object.fromEntries(['MINECRAFT_MCP_URL', 'MINECRAFT_MCP_PORT', 'MINECRAFT_MCP_TOKEN']
    .filter(key => process.env[key]).map(key => [key, process.env[key]])),
  stderr: 'inherit'
});
try {
  await client.connect(transport);
  const result = await client.callTool({
    name: process.argv[2], arguments: JSON.parse(process.argv[3] || '{}')
  });
  for (const content of result.content) {
    if (content.type === 'text') console.log(content.text);
    else if (content.type === 'image') {
      console.log(`[image ${content.mimeType}, ${Math.round(content.data.length * 3 / 4)} bytes]`);
    }
  }
  if (result.isError) process.exitCode = 1;
} finally {
  await client.close();
}
