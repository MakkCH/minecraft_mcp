// Real settings widgets + real HTTP authentication. Use a disposable client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const server=fileURLToPath(new URL('../src/server.mjs',import.meta.url));
const port=Number(process.env.MINECRAFT_MCP_PORT||28473);
const token=process.env.MINECRAFT_MCP_TOKEN;
const url=`http://127.0.0.1:${port}`;
const status=secret=>fetch(url+'/status',{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(2000)});
async function clientFor(secret) {
  const client=new Client({name:'minecraft-mcp-settings-check',version:'1'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[server],env:{MINECRAFT_MCP_PORT:String(port),MINECRAFT_MCP_TOKEN:secret}}));
  return client;
}
async function execute(client,code) {
  const r=await client.callTool({name:'execute',arguments:{code,wait_ms:1000}});
  assert.notEqual(r.isError,true,JSON.stringify(r));
  let task=JSON.parse(r.content[0].text), output=task.output;
  for(let i=0;task.status==='running' && i<15;i++) {task=JSON.parse((await client.callTool({name:'read_output',arguments:{task:task.task,wait_ms:1000}})).content[0].text);output+=task.output;}
  assert.notEqual(task.status,'running');
  assert.equal(task.error,null); return output;
}
async function applyToken(client,value) {
  // Native widgets are real. Apply runs in an unowned JsMacros context because
  // saving settings intentionally cancels all MCP-owned scripts, including us.
  const script=`Client.waitTick(5); Client.runOnMainThread(JavaWrapper.methodToJava(() => {
    const mc=Client.getMinecraft();
    const owner=Java.type('minecraft.mcp.MinecraftMcpClient').INSTANCE;
    mc.gui.setScreen(new (Java.type('minecraft.mcp.SettingsScreen'))(null, owner));
    const widgets=Java.from(mc.gui.screen().children());
    widgets.find(w=>String(w.getMessage().getString())==='Token').setValue(${JSON.stringify(value)});
    widgets.find(w=>String(w.getMessage().getString())==='Apply').onPress(null);
  }), true, 5000);`;
  await execute(client,`JsMacros.runScript('js',${JSON.stringify(script)}); console.log('scheduled');`);
}
async function awaitStatus(secret,expected) {
  for(let i=0;i<30;i++) { if((await status(secret)).status===expected)return; await delay(100); }
  assert.fail('Authentication state did not change');
}
test('real mod: auth, protocol gate and UI token rotation', {timeout:20000}, async () => {
  assert.ok(token,'Set MINECRAFT_MCP_TOKEN');
  assert.equal((await status(token)).status,200);
  assert.equal((await status('wrong-token')).status,401);
  const legacy=await fetch(url+'/command',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({op:'execute',code:'throw new Error("must not run")'})});
  assert.equal(legacy.status,426);
  const oldClient=await clientFor(token), next=randomBytes(32).toString('hex');
  let newClient;
  try {
    await applyToken(oldClient,next);
    await awaitStatus(token,401);
    await awaitStatus(next,200);
    newClient=await clientFor(next);
    assert.match(await execute(newClient,'console.log(mcp.mainThread(() => Client.getMinecraft().isSameThread()));'),/true/);
  } finally {
    // Restore the starting credential even when the assertion above fails.
    if((await status(next)).status===200) {
      if(!newClient)newClient=await clientFor(next);
      await applyToken(newClient,token);
      await awaitStatus(token,200);
    }
    await oldClient.close();
    if(newClient)await newClient.close();
  }
});
