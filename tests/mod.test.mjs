// Real settings widgets + real HTTP authentication. Use a disposable client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { readConfig } from '../src/config.mjs';

const server=fileURLToPath(new URL('../src/server.mjs',import.meta.url));
const {url,token}=readConfig();
// Exercise Minecraft's real screen API, independently of the bridge adapter.
const screenApi=`
const currentScreen = () => String(Client.getMod('minecraft').getVersion()).startsWith('26.1')
  ? Client.getMinecraft().screen : Client.getMinecraft().gui.screen();
const openScreen = screen => String(Client.getMod('minecraft').getVersion()).startsWith('26.1')
  ? Client.getMinecraft().setScreen(screen) : Client.getMinecraft().gui.setScreen(screen);
`;
const status=secret=>fetch(new URL('status',url),{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(2000)});
async function clientFor(secret) {
  const client=new Client({name:'minecraft-mcp-settings-check',version:'1'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[server],env:{MINECRAFT_MCP_URL:url.href,MINECRAFT_MCP_TOKEN:secret}}));
  return client;
}
async function execute(client,code) {
  const r=await client.callTool({name:'execute',arguments:{code:screenApi+code,wait_ms:1000}});
  assert.notEqual(r.isError,true,JSON.stringify(r));
  let task=JSON.parse(r.content[0].text), output=task.output;
  for(let i=0;task.status==='running' && i<15;i++) {task=JSON.parse((await client.callTool({name:'read_output',arguments:{task:task.task,wait_ms:1000}})).content[0].text);output+=task.output;}
  assert.notEqual(task.status,'running');
  assert.equal(task.error,null); return output;
}
async function applyToken(from, to) {
  // The token changes between submitting the script and reading its result.
  const code=screenApi+`console.log(mcp.mainThread(() => {
    const owner=Java.type('minecraft.mcp.MinecraftMcpClient').INSTANCE;
    const previous=currentScreen();
    openScreen(new (Java.type('minecraft.mcp.SettingsScreen'))(previous, owner));
    try {
      const widgets=Java.from(currentScreen().children());
      const tokenField=widgets.find(w=>String(w.getMessage().getString())==='Token');
      tokenField.setFocused(true);
      const fieldState={native:Java.type('net.minecraft.client.gui.components.EditBox').class.isInstance(tokenField),
        visible:tokenField.isVisible(), editable:tokenField.canConsumeInput()};
      tokenField.setValue(''); tokenField.insertText(${JSON.stringify(to)});
      widgets.find(w=>String(w.getMessage().getString())==='Apply').onPress(null);
      return fieldState;
    } finally { openScreen(previous); }
  }));`;
  const submission=await fetch(new URL('command', url), {
    method:'POST', headers:{Authorization:`Bearer ${from}`, 'Content-Type':'application/json'},
    body:JSON.stringify({op:'execute', code}), signal:AbortSignal.timeout(5000)
  });
  assert.equal(submission.status,200);
  const {task}=await submission.json();
  assert.ok(task);
  await awaitStatus(to,200);
  const response=await fetch(new URL(`output?task=${task}&wait_ms=3000&wait_for_completion=true`,url), {
    headers:{Authorization:`Bearer ${to}`}, signal:AbortSignal.timeout(5000)
  });
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.status,'completed',result.error);
  assert.deepEqual(JSON.parse(result.output),{native:true,visible:true,editable:true});
}
async function awaitStatus(secret,expected) {
  for(let i=0;i<30;i++) { if((await status(secret)).status===expected)return; await delay(100); }
  assert.fail('Authentication state did not change');
}
test('real mod: auth, settings entrypoints and UI token rotation', {timeout:20000}, async t => {
  assert.ok(token,'Set MINECRAFT_MCP_TOKEN');
  assert.equal((await status(token)).status,200);
  assert.equal((await status('wrong-token')).status,401);
  const oldClient=await clientFor(token), next=randomBytes(32).toString('hex');
  let newClient;
  try {
    const menu=JSON.parse(await execute(oldClient,`console.log(mcp.mainThread(() => {
      if (!Java.type('net.fabricmc.loader.api.FabricLoader').getInstance().isModLoaded('modmenu')) return {installed:false};
      const mc=Client.getMinecraft(), previous=currentScreen();
      const api=Java.type('com.terraformersmc.modmenu.ModMenu');
      const parent=Java.type('com.terraformersmc.modmenu.api.ModMenuApi').createModsScreen(previous);
      try {
        const screen=api.getConfigScreen('minecraft_mcp',parent);
        openScreen(screen);
        const settings=Java.type('minecraft.mcp.SettingsScreen').class.isInstance(screen);
        screen.onClose();
        return {installed:true,registered:api.hasConfigScreen('minecraft_mcp'),settings,returned:parent.equals(currentScreen())};
      } finally { openScreen(previous); }
    }));`));
    if (menu.installed) assert.deepEqual(menu,{installed:true,registered:true,settings:true,returned:true});
    else t.diagnostic('Mod Menu not installed; its integration check was skipped.');
    await applyToken(token,next);
    assert.equal((await status(token)).status,401);
    newClient=await clientFor(next);
    assert.match(await execute(newClient,'console.log(mcp.mainThread(() => Client.getMinecraft().isSameThread()));'),/true/);
  } finally {
    // Restore the starting credential even when the assertion above fails.
    if((await status(next)).status===200) {
      await applyToken(next,token);
    }
    await oldClient.close();
    if(newClient)await newClient.close();
  }
});
