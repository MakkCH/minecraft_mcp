Error.stackTraceLimit = 100;
const __mcpJob = event.getObject('job');
__mcpJob.attach(context.getCtx());
function __mcpFormat(x) {
  if (typeof x === 'string') return x;
  try { const s = JSON.stringify(x); return s === undefined ? String(x) : s; }
  catch (_) { return String(x); }
}
globalThis.console = Object.freeze(Object.fromEntries(['log','info','warn','error','debug'].map(k =>
  [k, (...args) => __mcpJob.write((k === 'log' ? '' : '[' + k + '] ') + args.map(__mcpFormat).join(' '))])));
globalThis.print = (...args) => console.log(...args);
globalThis.mcp = Object.freeze({
  args: JSON.parse(event.getString('args')),
  track: (obj, method = 'unregister') => { __mcpJob.track(obj, method); return obj; },
  serverThread: fn => {
    if (typeof fn !== 'function') throw new TypeError('mcp.serverThread expects a function');
    const server = Client.getMinecraft().getSingleplayerServer();
    if (server === null) throw new Error('No integrated server is running');
    if (server.isSameThread()) return fn();
    let result, failure, failed = false;
    Java.type('minecraft.mcp.ScriptThreads').runOnServer(server, JavaWrapper.methodToJava(() => {
      try { result = fn(); }
      catch (e) { failed = true; failure = e; }
    }));
    if (failed) throw failure;
    return result;
  },
  mainThread: fn => {
    if (typeof fn !== 'function') throw new TypeError('mcp.mainThread expects a function');
    let result, failure, failed = false;
    // await=true yields GraalJS's context lock while Minecraft runs this callback.
    Client.runOnMainThread(JavaWrapper.methodToJava(() => {
      try { result = fn(); }
      catch (e) { failed = true; failure = e; }
    }), true, 5000);
    if (failed) throw failure;
    return result;
  }
});
