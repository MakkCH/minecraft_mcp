// Real JsMacros/GraalJS threading and loaded mod APIs.
// Does not navigate, mine, change inventory or toggle the player's bridge state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile, mkdtemp, cp, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('real client: main-thread handoff, errors and mod discovery', {timeout:30000}, async t => {
  const client = new Client({name:'minecraft-mcp-runtime-check',version:'1.0.0'});
  const transport = new StdioClientTransport({command:process.execPath,args:[root+'src/server.mjs'],env:Object.fromEntries(['MINECRAFT_MCP_PORT','MINECRAFT_MCP_TOKEN'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),stderr:'pipe'});
  const tasks = [];
  async function call(name, args={}) {
    const r = await client.callTool({name,arguments:args});
    assert.notEqual(r.isError,true,JSON.stringify(r));
    return r;
  }
  async function execute(args) {
    let result = JSON.parse((await call('execute',args)).content[0].text);
    tasks.push(result.task);
    let output = result.output;
    for (let i=0; result.status==='running' && i<15; i++) {
      result = JSON.parse((await call('read_output',{task:result.task,wait_ms:1000})).content[0].text);
      output += result.output;
    }
    assert.notEqual(result.status,'running');
    return {...result,output};
  }
  await client.connect(transport);
  try {
    // A final log can wake the output reader before JsMacros reports completion.
    // execute must continue waiting; collecting via read_output would hide this race.
    const finalLog = JSON.parse((await call('execute', {
      code:'console.log("before"); Java.type("java.lang.Thread").sleep(150); console.log("last");',
      wait_ms:5000
    })).content[0].text);
    tasks.push(finalLog.task);
    assert.equal(finalLog.status, 'completed');
    assert.equal(finalLog.output, 'before\nlast\n');

    // Verify Java serialization through real HTTP, the MCP SDK and Node's parser.
    const special = 'JSON: "\\\n\r\t\b\f\u0000\u001f<>&=\'\u2028\u2029🧱漢字';
    const escaped = await execute({code:`console.log(${JSON.stringify(special)});`});
    assert.equal(escaped.output, special+'\n');
    assert.equal(escaped.error, null);
    const invalidWait = '"\\invalid';
    const rejected = await fetch(`http://127.0.0.1:${process.env.MINECRAFT_MCP_PORT||28473}/output?task=${escaped.task}&wait_ms=${encodeURIComponent(invalidWait)}`, {
      headers:{Authorization:`Bearer ${process.env.MINECRAFT_MCP_TOKEN}`},
      signal:AbortSignal.timeout(2000)
    });
    assert.equal(rejected.status,400);
    assert.equal((await rejected.json()).error,'wait_ms must be an integer from 0 to 30000');

    // If the caller retains GraalJS's lock while waiting, Minecraft cannot enter
    // this callback. Check the actual render thread and immediate return value.
    const handoff = await execute({code:`
      const times=[];
      for (let i=0;i<20;i++) {
        const start=Date.now();
        const value=mcp.mainThread(() => ({main:Client.getMinecraft().isSameThread(), seq:i}));
        if (!value.main || value.seq!==i) throw new Error('Wrong thread or lost callback result');
        times.push(Date.now()-start);
      }
      // Blocking Java work after the handoff must not strand a queued callback.
      Java.type('java.lang.Thread').sleep(250);
      console.log(JSON.stringify({times,world:World.isWorldLoaded()}));
    `});
    assert.equal(handoff.error,null);
    const data=JSON.parse(handoff.output);
    assert.equal(data.times.length,20);
    t.diagnostic('20 native main-thread handoffs (ms): '+data.times.join(','));
    const thrown=await execute({code:"mcp.mainThread(() => { throw new Error('main-thread-regression'); });"});
    assert.equal(thrown.status,'error');
    assert.match(thrown.error,/main-thread-regression/);
    const falsy=await execute({code:'mcp.mainThread(() => { throw null; }); console.log("must not reach");'});
    assert.equal(falsy.status,'error');
    assert.equal(falsy.output,'');

    const inventory=await execute({file:root+'skills/minecraft-mcp/scripts/discover-mods.js'});
    assert.equal(inventory.error,null);
    const mods=JSON.parse(inventory.output);
    assert.ok(mods.some(m=>m.id==='jsmacros' && m.version));
    // Discover the actual JAR and official source metadata through Fabric.
    const metadata=await execute({file:root+'skills/minecraft-mcp/scripts/discover-mods.js',args:{modId:'jsmacros'}});
    assert.equal(metadata.error,null);
    const info=JSON.parse(metadata.output);
    assert.equal(info.id,'jsmacros');
    assert.ok(info.paths.length>0);
    for(const path of info.paths) assert.equal((await readFile(path)).subarray(0,2).toString(),'PK');
    if(mods.some(m=>m.id==='baritone')) {
      // Public API access stays direct; avoid starting movement in the user's world.
      const api=await execute({code:`
        const b=Java.type('baritone.api.BaritoneAPI').getProvider().getPrimaryBaritone();
        console.log(mcp.mainThread(() => ({pathing:b.getPathingBehavior().isPathing(),
          mining:b.getMineProcess()!=null, building:b.getBuilderProcess()!=null,
          goal:b.getCustomGoalProcess()!=null, commands:b.getCommandManager()!=null})));
      `});
      assert.equal(api.error,null);
      const capabilities=JSON.parse(api.output);
      for(const key of ['mining','building','goal','commands']) assert.equal(capabilities[key],true);
    }
    const capture=await call('screenshot');
    const png=Buffer.from(capture.content.find(c=>c.type==='image').data,'base64');
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  } finally {
    // Native wrappers retain contexts: close only this test's tasks. As with all
    // stop calls, this also relinquishes shared scripted input/mod movement.
    for(const task of tasks) await call('stop',{task});
    await client.close();
  }
});

// Launch real package copies with different release versions against the installed mod.
test('real client: matching release line accepts patch differences and rejects major/minor differences', {timeout:15000}, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'minecraft-mcp-version-'));
  try {
    await cp(root+'src', join(folder, 'src'), {recursive:true});
    await symlink(root+'node_modules', join(folder, 'node_modules'), 'dir');
    const pkg = JSON.parse(await readFile(root+'package.json', 'utf8'));
    const [major, minor, patch] = pkg.version.split('.').map(Number);
    for (const [version, compatible] of [
      [`${major}.${minor}.${patch+1}`, true],
      [`${major}.${minor+1}.0`, false],
      [`${major+1}.${minor}.0`, false]
    ]) {
      await writeFile(join(folder, 'package.json'), JSON.stringify({...pkg, version}));
      const client = new Client({name:'minecraft-mcp-version-check', version:'1'});
      try {
        await client.connect(new StdioClientTransport({
          command:process.execPath, args:[join(folder, 'src/server.mjs')],
          env:Object.fromEntries(['MINECRAFT_MCP_PORT','MINECRAFT_MCP_TOKEN'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),
          stderr:'pipe'
        }));
        assert.equal(client.getServerVersion().version, version);
        const response = await client.callTool({name:'execute', arguments:{code:'console.log(mcp.args.value);', args:{value:'compatible'}}});
        if (compatible) {
          assert.notEqual(response.isError, true, JSON.stringify(response));
          const result = JSON.parse(response.content[0].text);
          assert.equal(result.error, null);
          assert.equal(result.output, 'compatible\n');
        } else {
          assert.equal(response.isError, true);
          assert.match(response.content[0].text, /Incompatible Minecraft MCP versions/);
          assert.ok(response.content[0].text.includes(`MCP server ${version}`));
        }
      } finally { await client.close(); }
    }
  } finally { await rm(folder, {recursive:true, force:true}); }
});
