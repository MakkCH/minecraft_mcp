import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

test('real MCP SDK negotiates stdio and validates published tool schemas', async () => {
  const transport = new StdioClientTransport({command:process.execPath, args:[fileURLToPath(new URL('../src/server.mjs', import.meta.url))], stderr:'pipe'});
  const client = new Client({name:'minecraft-mcp-protocol-check',version:'1.0.0'});
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, 'minecraft_mcp');
    const {tools} = await client.listTools();
    assert.deepEqual(tools.map(t=>t.name).sort(), ['chat','execute','read_output','screenshot','stop']);
    // Validate boundary rejection through SDK JSON-RPC, not by calling implementation functions.
    const invalid = await client.callTool({name:'execute',arguments:{code:'1',wait_ms:-1}});
    assert.equal(invalid.isError,true);
  } finally { await client.close(); }
});
