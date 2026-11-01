const __mcpJob = event.getObject('job');
function __mcpFormat(x) {
  if (typeof x === 'string') return x;
  try { const s = JSON.stringify(x); return s === undefined ? String(x) : s; }
  catch (_) { return String(x); }
}
globalThis.console = Object.freeze(Object.fromEntries(['log','info','warn','error','debug'].map(k =>
  [k, (...args) => __mcpJob.write((k === 'log' ? '' : '[' + k + '] ') + args.map(__mcpFormat).join(' '))])));
globalThis.print = (...args) => console.log(...args);
// Track native Draw2D/Draw3D/CommandBuilder registrations for stop cleanup.
globalThis.mcp = Object.freeze({
  track: obj => { __mcpJob.track(obj); return obj; },
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
