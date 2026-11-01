// Requires the real configured Minecraft client in a disposable local world.
// No mock transports, substituted game APIs or fake task runners.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const transport = new StdioClientTransport({command:process.execPath,args:[root+'src/server.mjs'],env:Object.fromEntries(['MINECRAFT_MCP_PORT','MINECRAFT_MCP_TOKEN'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),stderr:'pipe'});
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
    const probe=await json('execute',{code:'console.log("PLAYER=" + Player.getPlayer().getName()); console.log("BARITONE=" + Java.type("baritone.api.BaritoneAPI").getProvider().getPrimaryBaritone());',wait_ms:1000});
    let probeText=probe.output; let probeEnd=probe;
    for(let i=0;i<10 && probeEnd.status==='running';i++) { probeEnd=await json('read_output',{task:probe.task,wait_ms:1000}); probeText+=probeEnd.output; }
    assert.match(probeText,/PLAYER=/); assert.match(probeText,/BARITONE=/); assert.equal(probeEnd.error,null);
    const running=await json('execute',{code:'console.log("FIRST"); Client.waitTick(30); console.log("SECOND");',wait_ms:0});
    let combined=running.output;
    let last=running;
    for (let i=0;i<8 && last.status==='running';i++) { last=await json('read_output',{task:running.task,wait_ms:1000}); combined+=last.output; }
    assert.equal(last.status,'completed');
    assert.equal((combined.match(/FIRST/g)||[]).length,1); assert.equal((combined.match(/SECOND/g)||[]).length,1);
    assert.equal((await json('read_output',{task:running.task})).output,'');
    const loop=await json('execute',{code:'KeyBind.pressKey("key.keyboard.left.shift"); console.log("HELD"); while (true) Client.waitTick();',wait_ms:1000});
    assert.match(loop.output,/HELD/);
    await call('stop',{task:loop.task});
    assert.equal((await json('read_output',{task:loop.task})).status,'stopped');
    const released=await collect(await json('execute',{code:'console.log([...KeyBind.getPressedKeys()]);'}));
    assert.deepEqual(JSON.parse(released.output),[]);
    // Non-cooperative GraalJS loop must be cancellable without freezing the client.
    const busy=await json('execute',{code:'while (true) {}',wait_ms:0});
    await call('stop',{task:busy.task});
    assert.equal((await json('read_output',{task:busy.task})).status,'stopped');
    const bad=await json('execute' ,{code:'throw new Error("live-test-error");',wait_ms:1000});
    assert.equal(bad.status,'error'); assert.match(bad.error,/live-test-error/);
    const syntax=await json('execute',{code:'const = ;',wait_ms:1000});
    assert.equal(syntax.status,'error');
    // Real Baritone pathfinding must move the actual player to the requested goal.
    const nav=await collect(await json('execute',{file:root+'skills/minecraft-mcp/examples/baritone-nearby.js',wait_ms:0}), r=>r.output.includes('NAVIGATION=') || r.status==='error');
    await call('stop',{task:nav.task});
    const movement=JSON.parse(nav.output.trim().split('NAVIGATION=').at(-1));
    assert.equal(movement.reached,true,JSON.stringify(movement));
    assert.ok(Math.hypot(movement.end.x-movement.start.x,movement.end.z-movement.start.z)>1);
    // Check real renderer registration and teardown, not a simulated resource list.
    const drawCount=async () => Number((await collect(await json('execute',{code:'console.log(Hud.listDraw3Ds().size());'}))).output.trim());
    const beforeDraw=await drawCount();
    const marker=await collect(await json('execute',{file:root+'skills/minecraft-mcp/examples/marker.js'}));
    assert.match(marker.output,/MARKER_REGISTERED/);
    assert.equal(await drawCount(),beforeDraw+1);
    const marked=await call('screenshot');
    assert.ok(marked.content.some(c=>c.type==='image'));
    await call('stop',{task:marker.task});
    assert.equal(await drawCount(),beforeDraw);
    // Route through Minecraft's real chat command dispatcher, including stop/start.
    const status=await collect(await json('execute',{code:'Chat.say("/mcp status",true); Client.waitTick(2); console.log(Chat.getHistory().getRecvLine(0).getText().getString());'}));
    assert.match(status.output,/"enabled":true/);
    await json('execute',{code:`JsMacros.runScript("js", 'Chat.say("/mcp stop",true); Client.waitTick(60); Chat.say("/mcp start",true);');`,wait_ms:0});
    await delay(300);
    const disabled=await client.callTool({name:'execute',arguments:{code:'console.log("must not execute")'}});
    assert.equal(disabled.isError,true); assert.match(disabled.content[0].text,/disabled/);
    await delay(3500);
    const resumed=await collect(await json('execute',{code:'console.log("RESUMED");'}));
    assert.match(resumed.output,/RESUMED/);
    await call('chat',{message:'已完成客戶端連線與輸出測試，下一步確認畫面與 Baritone。'});
    const chatText=await collect(await json('execute',{code:'console.log(Chat.getHistory().getRecvLine(0).getText().getJson());'}));
    const component=JSON.parse(chatText.output);
    assert.match(JSON.stringify(component),/AGENT/); assert.match(JSON.stringify(component),/aqua/);
    const capture=await call('screenshot');
    const image=capture.content.find(c=>c.type==='image');
    assert.ok(image); const png=Buffer.from(image.data,'base64');
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  } finally { await client.close(); }
});
