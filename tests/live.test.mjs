// Requires the real configured Minecraft client in a disposable local world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const transport = new StdioClientTransport({command:process.execPath,args:[root+'src/server.mjs'],env:Object.fromEntries(['MINECRAFT_MCP_URL','MINECRAFT_MCP_TOKEN'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),stderr:'pipe'});
const client = new Client({name:'minecraft-mcp-live-check',version:'1.0.0'});
async function call(name,args={}) {
  const r = await client.callTool({name,arguments:args});
  assert.notEqual(r.isError,true, JSON.stringify(r));
  return r;
}
async function json(name,args) { return JSON.parse((await call(name,args)).content.find(c=>c.type==='text').text); }
async function collect(result, until = r => !['running'].includes(r.status)) {
  let output=result.output;
  for(let i=0;i<30 && !until({...result,output});i++) {
    result=await json('read_output',{task:result.task,wait_ms:1000}); output+=result.output;
  }
  return {...result,output};
}
test('Minecraft: native execution, output, cancellation, Baritone movement, overlays, commands, chat and screenshot', {timeout:90000}, async () => {
  await client.connect(transport);
  try {
    const running=await json('execute',{code:'console.log("FIRST"); Client.waitTick(30); console.log("SECOND");',wait_ms:0});
    let combined=running.output;
    let last=running;
    for (let i=0;i<8 && last.status==='running';i++) { last=await json('read_output',{task:running.task,wait_ms:1000}); combined+=last.output; }
    assert.equal(last.status,'completed');
    assert.equal((combined.match(/FIRST/g)||[]).length,1); assert.equal((combined.match(/SECOND/g)||[]).length,1);
    assert.equal((await json('read_output',{task:running.task})).output,'');
    // A targeted stop leaves the other task's input intact. Stop-all releases it.
    const key='key.keyboard.left.shift';
    const loop=await json('execute',{code:`KeyBind.pressKey(mcp.args.key); console.log("HELD"); while (true) Client.waitTick();`,args:{key}});
    const keyHeld=async () => JSON.parse((await collect(await json('execute',{
      code:'console.log(KeyBind.getPressedKeys().contains(mcp.args.key));',args:{key}
    }))).output);
    try {
      assert.match(loop.output,/HELD/);
      const busy=await json('execute',{code:'while (true) {}',wait_ms:0});
      await call('stop',{task:busy.task});
      assert.equal((await json('read_output',{task:busy.task})).status,'stopped');
      assert.equal(await keyHeld(),true);
    } finally { await call('stop'); }
    assert.equal((await json('read_output',{task:loop.task})).status,'stopped');
    assert.equal(await keyHeld(),false);
    const bad=await json('execute' ,{code:'throw new Error("live-test-error");',wait_ms:1000});
    assert.equal(bad.status,'error'); assert.match(bad.error,/live-test-error/);
    const syntax=await json('execute',{code:'const = ;',wait_ms:1000});
    assert.equal(syntax.status,'error');
    const playerState=async () => JSON.parse((await collect(await json('execute',{code:`
      console.log(mcp.mainThread(() => {
        const player=Player.getPlayer();
        return {x:player.getX(), z:player.getZ(), baritone:Client.isModLoaded('baritone')};
      }));`}))).output);
    const start=await playerState();
    if (start.baritone) {
      const destination={x:Math.floor(start.x)+2, z:Math.floor(start.z)};
      const nav=await json('execute',{file:root+'skills/minecraft-mcp/examples/baritone-goto.js',args:destination,wait_ms:0});
      try {
        const movement=await collect(nav);
        assert.equal(movement.status,'completed',movement.error);
        assert.deepEqual(JSON.parse(movement.output),{destination,reached:true});
        const end=await playerState();
        assert.deepEqual({x:Math.floor(end.x),z:Math.floor(end.z)},destination);
      } finally { await call('stop',{task:nav.task}); }
    }
    // Check renderer registration and teardown.
    const drawCount=async () => Number((await collect(await json('execute',{code:'console.log(Hud.listDraw3Ds().size());'}))).output.trim());
    const beforeDraw=await drawCount();
    const marker=await collect(await json('execute',{file:root+'skills/minecraft-mcp/examples/marker.js',keep_alive:true}));
    assert.equal(marker.error,null);
    assert.ok(Number.isFinite(JSON.parse(marker.output).position.x));
    assert.equal(await drawCount(),beforeDraw+1);
    const marked=await call('screenshot');
    assert.ok(marked.content.some(c=>c.type==='image'));
    await call('stop',{task:marker.task});
    assert.equal(await drawCount(),beforeDraw);
    // Route through Minecraft's real chat command dispatcher.
    const status=await collect(await json('execute',{code:'Chat.say("/mcp status",true); Client.waitTick(2); console.log(Chat.getHistory().getRecvLine(0).getText().getString());'}));
    assert.match(status.output,/^\[Minecraft_MCP\] MCP enabled · Active tasks: \d+\s*$/);
    const message='Client connection and output checks passed. Next, I will check the game view and Baritone.';
    await call('chat',{message});
    const chatText=await collect(await json('execute',{code:'console.log(Chat.getHistory().getRecvLine(0).getText().getJson());'}));
    const component=JSON.parse(chatText.output);
    assert.match(component.text,/^\[.{1,32}\]$/s);
    assert.match(component.color,/^(?:[a-z_]+|#[0-9a-f]{6})$/i);
    assert.equal(component.extra.at(-1).text,' '+message);
    const capture=await call('screenshot');
    const image=capture.content.find(c=>c.type==='image');
    assert.ok(image);
    assert.equal(image.mimeType,'image/jpeg');
    const jpeg=Buffer.from(image.data,'base64');
    assert.deepEqual([...jpeg.subarray(0,3)],[255,216,255]);
    assert.deepEqual([...jpeg.subarray(-2)],[255,217]);
  } finally { await client.close(); }
});
