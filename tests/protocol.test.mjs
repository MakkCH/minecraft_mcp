import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

test('real MCP SDK negotiates stdio and validates published tool schemas', async () => {
  const transport = new StdioClientTransport({command:process.execPath, args:[fileURLToPath(new URL('../src/server.mjs', import.meta.url))], cwd:tmpdir(), env:{MINECRAFT_MCP_TOKEN:''}, stderr:'pipe'});
  const client = new Client({name:'minecraft-mcp-protocol-check',version:'1.0.0'});
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, 'minecraft_mcp');
    const {tools} = await client.listTools();
    assert.deepEqual(tools.map(t=>t.name).sort(), ['chat','execute','read_output','screenshot','stop']);
    // Validate boundary rejection through SDK JSON-RPC, not by calling implementation functions.
    const invalid = await client.callTool({name:'execute',arguments:{code:'1',wait_ms:-1}});
    assert.equal(invalid.isError,true);
    for (const args of [null, [], 'not an object']) {
      const invalidArgs = await client.callTool({name:'execute',arguments:{code:'1',args}});
      assert.equal(invalidArgs.isError,true);
      assert.match(invalidArgs.content[0].text,/args/);
    }
    const executeSchema = tools.find(tool=>tool.name==='execute').inputSchema;
    assert.equal(executeSchema.properties.args.type,'object');
    assert.equal(executeSchema.properties.args.additionalProperties,true);
    for (const name of ['execute','read_output']) {
      const tooLong = await client.callTool({name,arguments:{code:'1',task:'unused',wait_ms:30001}});
      assert.equal(tooLong.isError,true);
      assert.match(tooLong.content[0].text,/30000/);
    }
    const ambiguous = await client.callTool({name:'execute',arguments:{code:'1',file:'/unused.js'}});
    assert.equal(ambiguous.isError,true);
    assert.equal(ambiguous.content[0].text,'Provide exactly one of code or file');
    const oversized = await client.callTool({name:'execute',arguments:{code:'漢'.repeat(350000)}});
    assert.equal(oversized.isError,true);
    assert.match(oversized.content[0].text,/1 MiB request limit/);
    // A caller without an instance must not silently reach a developer's config.
    const unconfigured = await client.callTool({name:'execute',arguments:{code:'console.log(1)'}});
    assert.equal(unconfigured.isError,true);
    assert.match(unconfigured.content[0].text,/Set MINECRAFT_MCP_TOKEN/);
  } finally { await client.close(); }
});
