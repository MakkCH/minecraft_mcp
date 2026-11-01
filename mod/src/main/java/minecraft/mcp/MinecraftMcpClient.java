package minecraft.mcp;

import com.google.gson.*;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
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
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommands.literal;

public final class MinecraftMcpClient implements ClientModInitializer {
    private static final Logger LOG = LoggerFactory.getLogger("minecraft_mcp");
    public static MinecraftMcpClient INSTANCE;
    private final Path configPath = FabricLoader.getInstance().getConfigDir().resolve("minecraft_mcp.json");
    private ClientConfig config;
    private Bridge bridge;
    private String startupError;
    private String prelude;
    private boolean openSettings;
    private Object lastWorld;

    @Override public void onInitializeClient() {
        INSTANCE = this;
        try {
            try (InputStream in = getClass().getResourceAsStream("/minecraft-mcp-prelude.js")) {
                prelude = new String(Objects.requireNonNull(in).readAllBytes(), StandardCharsets.UTF_8);
            }
            config = ClientConfig.load(configPath);
        } catch (Exception e) { startupError = e.getMessage(); config = new ClientConfig(); LOG.error("Could not load Minecraft MCP settings", e); }
        KeyMapping settingsKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.minecraft_mcp.settings", InputConstants.KEY_F8, KeyMapping.Category.MISC));
        ClientLifecycleEvents.CLIENT_STARTED.register(mc -> {
            if (startupError == null) try { bridge = new Bridge(config.port, config.token, config.autoStart, 65536); }
            catch (IOException e) { startupError = e.getMessage(); LOG.error("Could not start Minecraft MCP listener", e); }
        });
        ClientLifecycleEvents.CLIENT_STOPPING.register(mc -> close());
        ClientTickEvents.END_CLIENT_TICK.register(mc -> {
            if (lastWorld != mc.level) { if (lastWorld != null) stopAll(); lastWorld = mc.level; }
            if (settingsKey.consumeClick() || openSettings) { openSettings = false; mc.gui.setScreen(new SettingsScreen(mc.gui.screen(), this)); }
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
    public String connectionStatus() { return bridge == null ? "Not listening: " + startupError : "127.0.0.1:" + config.port + " — " + (enabled() ? "Agent enabled" : "Player control"); }
    public void setEnabled(boolean enabled) { if (bridge != null) bridge.setEnabled(enabled); if (!enabled) stopAll(); }
    public void apply(ClientConfig next) throws IOException {
        next.validate();
        boolean enabled = bridge == null ? next.autoStart : bridge.isEnabled();
        // Bind a changed port before disturbing the existing connection.
        Bridge replacement = bridge == null || next.port != config.port ? new Bridge(next.port, next.token, enabled, 65536) : null;
        try { next.save(configPath); }
        catch (IOException e) { if (replacement != null) replacement.close(); throw e; }
        stopAll();
        if (replacement != null) { if (bridge != null) bridge.close(); bridge = replacement; }
        else bridge.setToken(next.token);
        config = next.copy(); startupError = null;
    }
    private JsonObject status() {
        JsonObject out = new JsonObject(); out.addProperty("enabled", enabled());
        out.addProperty("protocol", 1);
        out.addProperty("activeTasks", bridge == null ? 0 : Arrays.stream(bridge.getJobs()).filter(j -> Set.of("running","active").contains(j.status())).count());
        return out;
    }
    private int reportStatus() { localChat(Component.literal("[minecraft_mcp] " + status())); return 1; }
    private void handle(Bridge.Request request) {
        try {
            JsonObject req = JsonParser.parseString(request.body).getAsJsonObject();
            String op = req.get("op").getAsString();
            if (!enabled() && !Set.of("stop","screenshot","status").contains(op)) throw new IllegalStateException("Agent control disabled. Use /mcp start in Minecraft.");
            switch (op) {
                case "status" -> request.complete(status());
                case "execute" -> {
                    String code = req.get("code").getAsString();
                    if (code.length() > 900000) throw new IllegalArgumentException("Script too large");
                    Bridge.Job job = bridge.createJob();
                    var core = JsMacrosClient.clientCore;
                    EventCustom event = new EventCustom(core, "MinecraftMcpExecute"); event.putObject("job", job);
                    // file is a diagnostic name only. Script source arrives over the wire.
                    File file = req.has("file") && !req.get("file").isJsonNull() ? new File(req.get("file").getAsString()) : null;
                    try {
                        var container = core.exec("js", prelude + "\n" + code, file, event, () -> job.finish(null), e -> job.finish(e.toString()));
                        job.attach(container.getCtx());
                    } catch (Throwable e) { job.finish(e.toString()); }
                    JsonObject response = new JsonObject(); response.addProperty("task", job.id);
                    request.complete(response);
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
                    localChat(text.append(colored(" " + message, config.messageColor)));
                    JsonObject response = new JsonObject(); response.addProperty("displayed", true);
                    request.complete(response);
                }
                case "screenshot" -> capture(request);
                default -> throw new IllegalArgumentException("Unknown operation");
            }
        } catch (Throwable e) { request.complete(Bridge.error(e.toString())); }
    }
    private void capture(Bridge.Request request) {
        Screenshot.takeScreenshot(Minecraft.getInstance().gameRenderer.mainRenderTarget(), image -> {
            // GPU capture occurs on the client; PNG encoding/file I/O is off-thread.
            CompletableFuture.runAsync(() -> {
                Path path = null;
                try (image) {
                    path = Files.createTempFile("minecraft-mcp-capture-", ".png");
                    image.writeToFile(path);
                    String data = Base64.getEncoder().encodeToString(Files.readAllBytes(path));
                    JsonObject response = new JsonObject();
                    response.addProperty("mimeType", "image/png"); response.addProperty("data", data);
                    request.complete(response);
                } catch (Exception e) { request.complete(Bridge.error(e.toString())); }
                finally { if (path != null) try { Files.deleteIfExists(path); } catch (IOException e) { LOG.warn("Capture cleanup failed", e); } }
            });
        });
    }
    private static MutableComponent colored(String text, String color) {
        return Component.literal(text).withStyle(Style.EMPTY.withColor(TextColor.parseColor(color).getOrThrow()));
    }
    private static void localChat(Component text) { Minecraft.getInstance().gui.hud.getChat().addClientSystemMessage(text); }
    private void stopJob(Bridge.Job job) {
        if (job == null) throw new IllegalArgumentException("Unknown task");
        if (job.getContext() instanceof BaseScriptContext<?> ctx && !ctx.isContextClosed()) {
            for (var entry : new ArrayList<>(ctx.eventListeners.entrySet()))
                JsMacrosClient.clientCore.eventRegistry.removeListener(entry.getValue(), entry.getKey());
            ctx.closeContext();
        }
        job.stopped();
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
