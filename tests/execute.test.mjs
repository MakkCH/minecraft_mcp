// Real MCP SDK and JsMacros module loader; run against a local Minecraft client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
test('real client: script inputs, diagnostics and 30-second waits', {timeout:80000}, async t => {
  const client = new Client({name:'minecraft-mcp-execute-check',version:'1.0.0'});
  const workspace = await mkdtemp(join(tmpdir(), 'minecraft-mcp-execute-test-'));
  const transport = new StdioClientTransport({command:process.execPath,args:[root+'src/server.mjs'],cwd:workspace,
    env:Object.fromEntries(['MINECRAFT_MCP_PORT','MINECRAFT_MCP_TOKEN'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),stderr:'pipe'});
  const tasks = [];
  async function call(name, args={}) {
    const response = await client.callTool({name,arguments:args});
    assert.notEqual(response.isError,true,JSON.stringify(response));
    const result = JSON.parse(response.content[0].text);
    if (name === 'execute') tasks.push(result.task);
    return result;
  }
  await client.connect(transport);
  try {
    await t.test('JSON arguments stay data and default to an empty object', async () => {
      const args = JSON.parse('{"seed":1099,"phaseOffset":2,"nested":[true,null,"漢字\\n\\\""],"__proto__":{"safe":true}}');
      const result = await call('execute',{code:'console.log(JSON.stringify(mcp.args));',args});
      assert.equal(result.status,'completed');
      assert.deepEqual(JSON.parse(result.output),args);
      assert.equal((await call('execute',{code:'console.log(mcp.args);'})).output,'{}\n');
    });
    const entry = join(workspace,'app','test.js');
    const helper = join(workspace,'lib','observe.js');
    const nested = join(workspace,'lib','nested.js');
    await mkdir(join(workspace,'app'));
    await mkdir(join(workspace,'lib'));
    await writeFile(helper, `globalThis.moduleLoads=(globalThis.moduleLoads||0)+1;
module.exports={value:require('./nested.js')+mcp.args.seed,dir:__dirname};`);
    await writeFile(nested,'module.exports=4;');
    await t.test('relative files use native nested imports and fresh module caches', async () => {
      await writeFile(entry, `const helper=require('../lib/observe.js');
console.log({value:helper.value,dir:helper.dir,cached:helper===require('../lib/observe.js'),loads:moduleLoads});`);
      for (const file of ['app/test.js',entry]) {
        const result = await call('execute',{file,args:{seed:1099}});
        assert.equal(result.status,'completed',result.error);
        const data = JSON.parse(result.output);
        assert.equal(data.value,1103);
        assert.equal(data.cached,true);
        assert.equal(data.loads,1);
        assert.equal(await realpath(data.dir),await realpath(join(workspace,'lib')));
      }
    });
    await t.test('inline and file scripts share the UTF-8 request limit', async () => {
      const code = '//'+ 'a'.repeat(950000)+'\nconsole.log("large script");';
      await writeFile(entry,code);
      for (const input of [{code},{file:entry}]) {
        const result = await call('execute',input);
        assert.equal(result.status,'completed',result.error);
        assert.equal(result.output,'large script\n');
      }
    });
    await t.test('entry and module stack traces use original source lines', async () => {
      const inline = await call('execute',{code:'throw new Error("first-line");'});
      assert.equal(inline.status,'error');
      assert.match(inline.error,/inline\.js:1:7/);
      assert.equal(inline.error.split('\n').length,2);
      assert.doesNotMatch(inline.error,/mcp-runtime|minecraft-mcp:bootstrap/);
      const syntax = await call('execute',{code:'// syntax fixture\nconst answer = ;'});
      assert.equal(syntax.status,'error');
      assert.match(syntax.error,/inline\.js:2:/);
      for (const value of ['null', '0', '"primitive"']) {
        const thrown = await call('execute',{code:`throw ${value};`});
        assert.equal(thrown.status,'error');
        assert.ok(thrown.error.includes(String(JSON.parse(value))));
      }
      await writeFile(entry,'function inspect() {\n  throw new Error("file-line");\n}\ninspect();');
      const fileError = await call('execute',{file:entry});
      assert.match(fileError.error,/inspect \(test\.js:2:9\)/);
      assert.match(fileError.error,/test\.js:4:1/);
      assert.equal(fileError.error.split('\n').length,3);
      await writeFile(helper,'function inspect() {\n  const player = null;\n  return player.getX();\n}\nmodule.exports = inspect;');
      await writeFile(entry,"const inspect = require('../lib/observe.js');\nfunction main() {\n  return inspect();\n}\nmain();");
      const moduleError = await call('execute',{file:entry});
      assert.equal(moduleError.status,'error');
      assert.match(moduleError.error,/TypeError/);
      assert.match(moduleError.error,/inspect \(.*observe\.js:3:\d+\)/);
      assert.match(moduleError.error,/main \(test\.js:3:\d+\)/);
      assert.doesNotMatch(moduleError.error,/mcp-runtime|mcp-bootstrap/);
      assert.equal(moduleError.error.split('\n').length,4);
      t.diagnostic(moduleError.error);
    });
    await t.test('structured frames preserve message paths and ignore a forged stack', async () => {
      await writeFile(helper, `module.exports = function inspect() {
  const message = __dirname + '/original-path\\n    at ' + __dirname + '/../app/test.js:1:1';
  console.log(JSON.stringify(message));
  const error = new Error(message);
  error.stack = 'forged stack without source locations';
  throw error;
};`);
      await writeFile(entry,"require('../lib/observe.js')();");
      const result = await call('execute',{file:entry});
      assert.equal(result.status,'error');
      const original = JSON.parse(result.output);
      assert.ok(original.includes(await realpath(workspace)));
      assert.ok(result.error.startsWith('Error: '+original+'\n'));
      assert.match(result.error,/inspect \(.*observe\.js:\d+:\d+\)/);
      assert.match(result.error,/test\.js:1:/);
      assert.doesNotMatch(result.error,/forged stack/);
    });
    await t.test('UTF-8 truncation keeps error first and counts removed bytes', async () => {
      const response = await client.callTool({name:'execute',arguments:{
        code:'console.log("🧱".repeat(20000)); throw new Error("E".repeat(70000));',wait_ms:5000
      }});
      assert.notEqual(response.isError,true);
      const raw = response.content[0].text;
      const result = JSON.parse(raw);
      tasks.push(result.task);
      assert.equal(result.status,'error');
      assert.ok(raw.indexOf('"error":') < raw.indexOf('"output":'));
      assert.ok(result.error.startsWith('Error: '+ 'E'.repeat(70000)));
      assert.doesNotMatch(result.error,/bytes truncated/);
      const marker = result.output.match(/^\[ …(\d+) bytes truncated… \]\n/);
      assert.ok(marker);
      const retained = result.output.slice(marker[0].length);
      assert.equal(Number(marker[1])+Buffer.byteLength(retained),80001);
      assert.ok(Buffer.byteLength(retained)<=65536);
      assert.doesNotMatch(retained,/\uFFFD/);
      assert.match(retained,/^(?:🧱)+\n$/u);
      const reread = await call('read_output',{task:result.task});
      assert.equal(reread.output,'');
      assert.equal(reread.error,result.error);
      const oversized = await call('execute',{code:'throw new Error("🧱".repeat(70000));'});
      assert.equal(oversized.status,'error');
      assert.match(oversized.error,/\n\[ …\d+ bytes truncated… \]$/);
      assert.ok(Buffer.byteLength(oversized.error)<262200);
      assert.doesNotMatch(oversized.error,/\uFFFD/);
    });
    await t.test('execute waits beyond the old HTTP deadline', async () => {
      const start = performance.now();
      const result = await call('execute',{code:'Java.type("java.lang.Thread").sleep(21000); console.log("done");',wait_ms:30000});
      assert.equal(result.status,'completed');
      assert.equal(result.output,'done\n');
      assert.ok(performance.now()-start>=21000);
    });
    await t.test('read_output waits a full 30 seconds without stopping the task', async () => {
      const started = await call('execute',{code:'Java.type("java.lang.Thread").sleep(40000);',wait_ms:0});
      const start = performance.now();
      const result = await call('read_output',{task:started.task,wait_ms:30000});
      const elapsed = performance.now()-start;
      assert.equal(result.status,'running');
      assert.equal(result.output,'');
      assert.ok(elapsed>=29500 && elapsed<38000,`Wait was ${elapsed} ms`);
      await call('stop',{task:started.task});
      t.diagnostic(`30-second wait returned after ${Math.round(elapsed)} ms`);
    });
  } finally {
    for (const task of tasks) await call('stop',{task});
    await client.close();
    await rm(workspace,{recursive:true,force:true});
  }
});
