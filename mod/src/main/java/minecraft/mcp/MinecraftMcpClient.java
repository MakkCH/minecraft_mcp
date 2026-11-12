package minecraft.mcp;

import com.google.gson.*;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.*;
import net.minecraft.network.chat.*;
import com.mojang.blaze3d.platform.InputConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import xyz.wagyourtail.jsmacros.client.JsMacrosClient;
import xyz.wagyourtail.jsmacros.client.api.library.impl.FKeyBind;
import xyz.wagyourtail.jsmacros.core.event.impl.EventCustom;
import xyz.wagyourtail.jsmacros.core.language.BaseScriptContext;
import xyz.wagyourtail.jsmacros.core.language.BaseWrappedException.GuestLocation;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommands.literal;

public final class MinecraftMcpClient implements ClientModInitializer {
    private static final Logger LOG = LoggerFactory.getLogger("minecraft_mcp");
    public static MinecraftMcpClient INSTANCE;
    private static final String VERSION = FabricLoader.getInstance().getModContainer("minecraft_mcp").orElseThrow().getMetadata().getVersion().getFriendlyString();
    private final Path configPath = FabricLoader.getInstance().getConfigDir().resolve("minecraft_mcp.json");
    private ClientConfig config;
    private Bridge bridge;
    private String startupError;
    private String prelude, bootstrap;
    private boolean openSettings;

    @Override public void onInitializeClient() {
        INSTANCE = this;
        try {
            try (InputStream in = getClass().getResourceAsStream("/minecraft-mcp-prelude.js")) {
                prelude = new String(Objects.requireNonNull(in).readAllBytes(), StandardCharsets.UTF_8);
            }
            try (InputStream in = getClass().getResourceAsStream("/minecraft-mcp-bootstrap.js")) {
                bootstrap = new String(Objects.requireNonNull(in).readAllBytes(), StandardCharsets.UTF_8);
            }
            config = ClientConfig.load(configPath);
        } catch (Exception e) { startupError = e.getMessage(); config = new ClientConfig(); LOG.error("Could not load Minecraft MCP settings", e); }
        KeyMapping settingsKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.minecraft_mcp.settings", InputConstants.KEY_F8, KeyMapping.Category.MISC));
        ClientLifecycleEvents.CLIENT_STARTED.register(mc -> {
            if (startupError == null) try { bridge = new Bridge(config.bindHost(), config.port, config.token, config.autoStart, VERSION); }
            catch (IOException e) { startupError = e.getMessage(); LOG.error("Could not start Minecraft MCP listener", e); }
        });
        ClientLifecycleEvents.CLIENT_STOPPING.register(mc -> close());
        ClientPlayConnectionEvents.DISCONNECT.register((handler, mc) -> stopAll());
        ClientTickEvents.END_CLIENT_TICK.register(mc -> {
            if (settingsKey.consumeClick() || openSettings) { openSettings = false; ClientPlatform.setScreen(new SettingsScreen(ClientPlatform.screen(), this)); }
            if (bridge == null) return;
            for (int i = 0; i < 4; i++) {
                Bridge.Request r = bridge.poll(); if (r == null) break;
                handle(r);
            }
        });
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, access) -> dispatcher.register(literal("mcp")
            .executes(c -> reportStatus())
            .then(literal("status").executes(c -> reportStatus()))
            .then(literal("config").executes(c -> { openSettings = true; return 1; }))
            .then(literal("start").executes(c -> { setEnabled(true); return reportStatus(); }))
            .then(literal("stop").executes(c -> { setEnabled(false); return reportStatus(); }))));
    }
    public ClientConfig config() { return config.copy(); }
    public boolean enabled() { return bridge != null && bridge.isEnabled(); }
    public String connectionStatus() { return bridge == null ? "Not listening: " + startupError : config.bindHost() + ":" + config.port + " — " + (enabled() ? "Agent enabled" : "Player control"); }
    public void setEnabled(boolean enabled) { if (bridge != null) bridge.setEnabled(enabled); if (!enabled) stopAll(); }
    public void apply(ClientConfig next) throws IOException {
        next.validate();
        boolean enabled = bridge == null ? next.autoStart : bridge.isEnabled();
        boolean rebind = bridge == null || next.port != config.port || next.allowRemote != config.allowRemote;
        // A wildcard and loopback listener cannot share the same port. Release it
        // before changing scope; restore the old listener if binding or saving fails.
        boolean released = bridge != null && next.port == config.port && next.allowRemote != config.allowRemote;
        if (released) { stopAll(); bridge.close(); bridge = null; }
        Bridge replacement = null;
        try {
            if (rebind) replacement = new Bridge(next.bindHost(), next.port, next.token, enabled, VERSION);
            next.save(configPath);
        } catch (IOException e) {
            if (replacement != null) replacement.close();
            if (released) {
                try { bridge = new Bridge(config.bindHost(), config.port, config.token, enabled, VERSION); }
                catch (IOException restoreError) { startupError = restoreError.getMessage(); e.addSuppressed(restoreError); }
            }
            throw e;
        }
        if (!released) stopAll();
        if (replacement != null) { if (bridge != null) bridge.close(); bridge = replacement; }
        else bridge.setToken(next.token);
        config = next.copy(); startupError = null;
    }
    private record Status(boolean enabled, String version, long activeTasks) { }
    private Status status() {
        return new Status(enabled(), VERSION, bridge == null ? 0 : Arrays.stream(bridge.getJobs()).filter(Bridge.Job::isLive).count());
    }
    private int reportStatus() {
        Status current = status();
        ClientPlatform.chat(Component.empty().withStyle(Style.EMPTY.withColor(0xFFFFFF))
            .append(colored("[Minecraft_MCP]", "#FFAA00"))
            .append(" MCP ")
            .append(current.enabled() ? "enabled" : "disabled")
            .append(" · Active tasks: ")
            .append(colored(Long.toString(current.activeTasks()), "#5555FF")));
        return 1;
    }
    private void handle(Bridge.Request request) {
        try {
            JsonObject req = JsonParser.parseString(request.body).getAsJsonObject();
            String op = req.get("op").getAsString();
            if (!enabled() && !Set.of("stop","screenshot","status").contains(op)) throw new IllegalStateException("Agent control disabled. Use /mcp start in Minecraft.");
            switch (op) {
                case "status" -> request.complete(status());
                case "execute" -> {
                    String code = req.get("code").getAsString();
                    JsonObject args = req.has("args") ? req.getAsJsonObject("args") : new JsonObject();
                    Bridge.Job job = bridge.createJob();
                    var core = JsMacrosClient.clientCore;
                    EventCustom event = new EventCustom(core, "MinecraftMcpExecute"); event.putObject("job", job); event.putString("args", args.toString());
                    event.putString("runtime", prelude); event.putString("code", code);
                    File file = req.has("file") && !req.get("file").isJsonNull() ? new File(req.get("file").getAsString()) : null;
                    try {
                        File sourceFile = (file == null ? new File("inline.js") : file).getCanonicalFile();
                        event.putObject("sourceFile", sourceFile);
                        event.putString("scriptName", file == null ? "inline.js" : file.getName());
                        var container = core.exec("js", bootstrap, file == null ? null : sourceFile, event, () -> job.finish(null),
                            e -> job.finish(scriptError(e, sourceFile.toPath())));
                        job.attach(container.getCtx());
                    } catch (Throwable e) { job.finish(e.toString()); }
                    request.complete(Map.of("task", job.id));
                }
                case "stop" -> {
                    if (req.has("task")) { stopJob(bridge.getJob(req.get("task").getAsString())); releaseControls(); }
                    else stopAll();
                    request.complete(status());
                }
                case "chat" -> {
                    String message = req.get("message").getAsString();
                    if (message.isEmpty() || message.length() > 2000) throw new IllegalArgumentException("Message must be 1–2000 characters");
                    MutableComponent text = colored("[" + config.tag + "]", config.tagColor);
                    if (!config.name.isEmpty()) text.append(colored(" " + config.name, config.nameColor));
                    ClientPlatform.chat(text.append(colored(" " + message, config.messageColor)));
                    request.complete(Map.of("displayed", true));
                }
                case "screenshot" -> capture(request);
                default -> throw new IllegalArgumentException("Unknown operation");
            }
        } catch (Throwable e) { request.complete(Bridge.error(e.toString())); }
    }
    private static String scriptError(Throwable error, Path entry) {
        // JsMacros supplies structured locations and ends the stack at Context.eval.
        // Only location paths are formatted; exception messages are left untouched.
        var result = new StringBuilder();
        for (var frame = JsMacrosClient.clientCore.wrapException(error); frame != null; frame = frame.next) {
            if (!result.isEmpty()) result.append("\n   ");
            result.append(frame.message);
            if (frame.location instanceof GuestLocation location) {
                Path path = location.file.toPath().toAbsolutePath().normalize();
                Path display = path.equals(entry) ? path.getFileName() : path;
                result.append(" (").append(display.toString().replace(File.separatorChar, '/'))
                    .append(':').append(location.line).append(':').append(location.column).append(')');
            } else if (frame.location != null) result.append(" (").append(frame.location).append(')');
        }
        return result.toString();
    }
    private void capture(Bridge.Request request) {
        ClientPlatform.capture(image -> {
            // GPU capture occurs on the client; PNG encoding/file I/O is off-thread.
            CompletableFuture.runAsync(() -> {
                Path path = null;
                try (image) {
                    path = Files.createTempFile("minecraft-mcp-capture-", ".png");
                    image.writeToFile(path);
                    String data = Base64.getEncoder().encodeToString(Files.readAllBytes(path));
                    request.complete(Map.of("mimeType", "image/png", "data", data));
                } catch (Exception e) { request.complete(Bridge.error(e.toString())); }
                finally { if (path != null) try { Files.deleteIfExists(path); } catch (IOException e) { LOG.warn("Capture cleanup failed", e); } }
            });
        });
    }
    private static MutableComponent colored(String text, String color) {
        return Component.literal(text).withStyle(Style.EMPTY.withColor(TextColor.parseColor(color).getOrThrow()));
    }
    private void stopJob(Bridge.Job job) {
        if (job == null) throw new IllegalArgumentException("Unknown task");
        // Closing a callback context can change active to completed; capture it first.
        boolean cancelled = job.isLive();
        BaseScriptContext<?> ctx = job.getContext();
        if (ctx != null && !ctx.isContextClosed()) {
            for (var entry : new ArrayList<>(ctx.eventListeners.entrySet()))
                JsMacrosClient.clientCore.eventRegistry.removeListener(entry.getValue(), entry.getKey());
            ctx.closeContext();
        }
        job.stopped(cancelled);
    }
    private void stopAll() {
        if (bridge != null) for (Bridge.Job job : bridge.getJobs()) {
            try { stopJob(job); } catch (Throwable e) { LOG.warn("Task cleanup failed", e); }
        }
        releaseControls();
    }
    private void releaseControls() {
        // This optional takeover hook is necessary because autonomous movement outlives scripts.
        if (FabricLoader.getInstance().isModLoaded("baritone")) try {
            Class<?> api = Class.forName("baritone.api.BaritoneAPI");
            Object provider = api.getMethod("getProvider").invoke(null);
            Object bot = Class.forName("baritone.api.IBaritoneProvider").getMethod("getPrimaryBaritone").invoke(provider);
            Class<?> type = Class.forName("baritone.api.IBaritone");
            Object pathing = type.getMethod("getPathingBehavior").invoke(bot);
            Object input = type.getMethod("getInputOverrideHandler").invoke(bot);
            try { Class.forName("baritone.api.behavior.IPathingBehavior").getMethod("forceCancel").invoke(pathing); }
            finally { Class.forName("baritone.api.utils.IInputOverrideHandler").getMethod("clearAllKeys").invoke(input); }
        } catch (ReflectiveOperationException e) { LOG.warn("Baritone takeover cleanup failed", e); }
        FKeyBind keys = new FKeyBind(JsMacrosClient.clientCore);
        for (String key : new ArrayList<>(keys.getPressedKeys())) keys.releaseKey(key);
    }
    private void close() { try { stopAll(); } finally { if (bridge != null) bridge.close(); bridge = null; } }
}
