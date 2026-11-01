// Run as an enabled JsMacros service. config.json lives beside this file.
const Files = Java.type('java.nio.file.Files');
const Path = Java.type('java.nio.file.Path');
const base = file.getParentFile().toPath();
const cfg = JSON.parse(String(Files.readString(base.resolve('config.json'))));
Reflection.loadJarFile(String(base.resolve('minecraft-mcp-bridge.jar')));
const bridge = Reflection.newInstance(Reflection.getClass('minecraft.mcp.Bridge'),
    cfg.port, cfg.token, cfg.autoStart !== false, cfg.outputLimit || 65536);
const BaritoneAPI = Java.type('baritone.api.BaritoneAPI');
const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
const contexts = new Map();
const text = value => String(value);

function log(message) { Chat.log('[minecraft_mcp] ' + message); }
function stopJob(job) {
    if (!job) throw new Error('Unknown task');
    const ctx = job.getContext();
    if (ctx && !ctx.isContextClosed()) {
        for (const entry of ctx.eventListeners.entrySet()) JsMacros.off(entry.getValue(), entry.getKey());
        ctx.closeContext();
    }
    job.stopped();
    contexts.delete(String(job.id));
}
function releaseControls() {
    let failure = null;
    Client.runOnMainThread(JavaWrapper.methodToJava(() => {
        try {
            baritone.getPathingBehavior().forceCancel();
            baritone.getInputOverrideHandler().clearAllKeys();
            for (const key of KeyBind.getPressedKeys()) KeyBind.releaseKey(String(key));
        } catch (e) { failure = String(e); }
    }), true, 500);
    if (failure) throw new Error('Could not release controls: ' + failure);
}
function stopAll() {
    for (const job of bridge.getJobs()) stopJob(job);
    releaseControls();
}
function status() {
    return { enabled: bridge.isEnabled(), baritone: true,
        activeTasks: Java.from(bridge.getJobs()).filter(j => ['running','active'].includes(String(j.status()))).length };
}
function announce(message) {
    const c = cfg.chat || {};
    // JSON components preserve literal message text; no commands or server chat are sent.
    const parts = [{text: '[' + (c.tag || 'AGENT') + ']', color: c.tagColor || 'aqua'}];
    if (c.name) parts.push({text: ' ' + c.name, color: c.nameColor || 'gold'});
    parts.push({text: ' ' + message, color: c.messageColor || 'white'});
    Chat.log(Chat.createTextHelperFromJSON(JSON.stringify({text:'', extra:parts})));
}
function execute(req) {
    if (typeof req.code !== 'string' || req.code.length > 900000) throw new Error('Invalid code');
    const job = bridge.createJob();
    const ev = JsMacros.createCustomEvent('MinecraftMcpExecute');
    ev.putObject('job', job);
    const prelude = `
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
globalThis.mcp = Object.freeze({ track: obj => { __mcpJob.track(obj); return obj; } });
`;
    const callback = JavaWrapper.methodToJavaAsync(error => job.finish(error == null ? null : String(error)));
    const container = JsMacros.runScript('js', prelude + '\n' + req.code,
        req.file || String(base.resolve('inline.js')), ev, callback);
    job.attach(container.getCtx());
    contexts.set(String(job.id), container);
    return {task: String(job.id)};
}
function handle(request) {
    let req;
    try {
        req = JSON.parse(String(request.body));
        if (!bridge.isEnabled() && req.op !== 'stop' && req.op !== 'screenshot') throw new Error('Agent control disabled. Use /mcp start in Minecraft.');
        if (req.op === 'execute') request.complete(JSON.stringify(execute(req)));
        else if (req.op === 'stop') {
            if (req.task) { stopJob(bridge.getJob(req.task)); releaseControls(); }
            else stopAll();
            request.complete(JSON.stringify(status()));
        } else if (req.op === 'chat') {
            if (typeof req.message !== 'string' || req.message.length > 2000) throw new Error('Message must be at most 2000 characters');
            announce(req.message);
            request.complete('{"displayed":true}');
        } else if (req.op === 'screenshot') {
            const name = 'mcp-' + Java.type('java.util.UUID').randomUUID() + '.png';
            const folder = 'minecraft_mcp/captures';
            Files.createDirectories(base.resolve('captures/screenshots'));
            Client.runOnMainThread(JavaWrapper.methodToJava(() => {
                try {
                    Player.takeScreenshot(folder, name, JavaWrapper.methodToJavaAsync(result => {
                        const target = base.resolve('captures/screenshots').resolve(name);
                        if (Files.exists(target)) request.complete(JSON.stringify({path:String(target)}));
                        else request.complete(JSON.stringify({error:'Screenshot failed: ' + result}));
                    }));
                } catch (e) { request.complete(JSON.stringify({error:String(e)})); }
            }));
        } else throw new Error('Unknown operation');
    } catch (e) { request.complete(JSON.stringify({error:String(e)})); }
}
const tick = JsMacros.on('Tick', JavaWrapper.methodToJava(() => {
    for (let i = 0; i < 4; i++) {
        const request = bridge.poll();
        if (!request) break;
        handle(request);
    }
    for (const [id, container] of contexts) {
        const job = bridge.getJob(id);
        if (!job || !['running','active'].includes(String(job.status()))) contexts.delete(id);
    }
}));
const command = Chat.createCommandBuilder('mcp')
    .executes(JavaWrapper.methodToJava(() => log(JSON.stringify(status()))))
    .literalArg('start').executes(JavaWrapper.methodToJava(() => { bridge.setEnabled(true); log('started'); })).or()
    .literalArg('stop').executes(JavaWrapper.methodToJava(() => { bridge.setEnabled(false); stopAll(); log('stopped; player has control'); })).or()
    .literalArg('status').executes(JavaWrapper.methodToJava(() => log(JSON.stringify(status()))))
    .register();
// World transitions cancel old tasks without changing the player-controlled enable flag.
JsMacros.on('Disconnect', JavaWrapper.methodToJava(() => stopAll()));
event.unregisterOnStop(true, command);
event.stopListener = JavaWrapper.methodToJava(() => {
    bridge.setEnabled(false);
    try { stopAll(); } finally { bridge.close(); }
});
log('ready on localhost:' + cfg.port + ' — /mcp start|stop|status');
