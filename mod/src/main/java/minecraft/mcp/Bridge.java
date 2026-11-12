package minecraft.mcp;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import xyz.wagyourtail.jsmacros.core.language.BaseScriptContext;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** Transport and bounded output only. JsMacros owns script execution and cancellation. */
public final class Bridge implements AutoCloseable {
    private static final Gson JSON = new GsonBuilder().serializeNulls().create();
    private final HttpServer server;
    private final ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor();
    private final BlockingQueue<Request> requests = new ArrayBlockingQueue<>(64);
    private final Map<String, Job> jobs = new LinkedHashMap<>();
    private volatile byte[] token;
    private volatile boolean enabled;
    private final int outputLimit;

    public Bridge(String host, int port, String token, boolean enabled, int outputLimit) throws IOException {
        setToken(token);
        this.enabled = enabled;
        this.outputLimit = Math.clamp(outputLimit, 4096, 1048576);
        server = HttpServer.create(new InetSocketAddress(host, port), 16);
        server.setExecutor(workers);
        server.createContext("/", this::handle);
        server.start();
    }
    public void setToken(String value) {
        if (value.length() < 32) throw new IllegalArgumentException("Token must have at least 32 characters");
        token = ("Bearer " + value).getBytes(StandardCharsets.UTF_8);
    }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public Request poll() {
        Request r;
        while ((r = requests.poll()) != null) if (!r.reply.isDone()) return r;
        return null;
    }
    public synchronized Job createJob() {
        // Evict only finished tasks; never silently lose control of a running context.
        if (jobs.size() >= 128) jobs.values().removeIf(j -> !j.isLive());
        if (jobs.size() >= 128) throw new IllegalStateException("Too many active scripts; stop some first");
        Job job = new Job(UUID.randomUUID().toString(), outputLimit);
        jobs.put(job.id, job);
        return job;
    }
    public synchronized Job getJob(String id) { return jobs.get(id); }
    public synchronized Job[] getJobs() { return jobs.values().toArray(Job[]::new); }

    private void handle(HttpExchange x) throws IOException {
        try {
            byte[] supplied = Objects.toString(x.getRequestHeaders().getFirst("Authorization"), "").getBytes(StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(token, supplied)) { send(x, 401, error("Unauthorized")); return; }
            if (x.getRequestHeaders().containsKey("Origin")) { send(x, 403, error("Browser requests are not accepted")); return; }
            String path = x.getRequestURI().getPath();
            if (path.equals("/status") && x.getRequestMethod().equals("GET")) {
                send(x, 200, Map.of("protocol", 1, "enabled", enabled)); return;
            }
            if (!"1".equals(x.getRequestHeaders().getFirst("X-Minecraft-Mcp-Protocol"))) {
                send(x, 426, error("Incompatible MCP protocol; update the MCP server")); return;
            }
            if (path.equals("/output") && x.getRequestMethod().equals("GET")) {
                Map<String,String> q = query(x.getRequestURI().getRawQuery());
                Job job = getJob(q.get("task"));
                if (job == null) { send(x, 404, error("Unknown or expired task")); return; }
                int wait = Math.clamp(Integer.parseInt(q.getOrDefault("wait_ms", "0")), 0, 10000);
                send(x, 200, job.read(wait, Boolean.parseBoolean(q.getOrDefault("wait_for_completion", "false"))));
            } else if (path.equals("/command") && x.getRequestMethod().equals("POST")) {
                byte[] bytes = x.getRequestBody().readNBytes(1048577);
                if (bytes.length > 1048576) { send(x, 413, error("Request too large")); return; }
                Request r = new Request(new String(bytes, StandardCharsets.UTF_8));
                if (!requests.offer(r)) { send(x, 503, error("Client queue full")); return; }
                try { send(x, 200, r.reply.get(15, TimeUnit.SECONDS)); }
                catch (TimeoutException e) {
                    r.reply.cancel(false); requests.remove(r);
                    send(x, 504, error("Minecraft did not respond. Check the Minecraft MCP mod settings. A dispatched action may still have executed; do not blindly retry."));
                }
            } else send(x, 404, error("Unknown endpoint"));
        } catch (Exception e) { send(x, 500, error(e.toString())); }
        finally { x.close(); }
    }
    private static Map<String,String> query(String raw) {
        Map<String,String> out = new HashMap<>();
        if (raw != null) for (String pair : raw.split("&")) {
            String[] p = pair.split("=", 2);
            out.put(URLDecoder.decode(p[0], StandardCharsets.UTF_8), p.length == 2 ? URLDecoder.decode(p[1], StandardCharsets.UTF_8) : "");
        }
        return out;
    }
    private static void send(HttpExchange x, int status, Object body) throws IOException {
        byte[] bytes = JSON.toJson(body).getBytes(StandardCharsets.UTF_8);
        x.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        x.sendResponseHeaders(status, bytes.length);
        x.getResponseBody().write(bytes);
    }
    static Map<String, String> error(String message) { return Collections.singletonMap("error", message); }
    public void close() {
        enabled = false;
        server.stop(0);
        workers.shutdownNow();
        for (Request r : requests) r.reply.cancel(false);
        requests.clear();
    }
    public static final class Request {
        public final String body;
        private final CompletableFuture<Object> reply = new CompletableFuture<>();
        Request(String body) { this.body = body; }
        public void complete(Object json) { reply.complete(json); }
    }
    public static final class Job {
        public final String id;
        private final int limit;
        private final StringBuilder output = new StringBuilder();
        private long dropped;
        private boolean mainDone, stopped;
        private String error;
        private BaseScriptContext<?> context;
        private final List<Object> tracked = new ArrayList<>();
        Job(String id, int limit) { this.id = id; this.limit = limit; }
        public synchronized void attach(BaseScriptContext<?> context) { this.context = context; }
        public synchronized BaseScriptContext<?> getContext() { return context; }
        public synchronized void write(String text) {
            output.append(text).append('\n');
            if (output.length() > limit) {
                int remove = output.length() - limit;
                if (remove < output.length() && Character.isLowSurrogate(output.charAt(remove))) remove++;
                output.delete(0, remove); dropped += remove;
            }
            notifyAll();
        }
        public synchronized void finish(String error) { this.error = error; mainDone = true; notifyAll(); }
        public synchronized void track(Object obj) { tracked.add(obj); }
        public synchronized void stopped(boolean cancelled) {
            for (Object obj : tracked) try { obj.getClass().getMethod("unregister").invoke(obj); }
            catch (ReflectiveOperationException e) { write("[cleanup] " + e); }
            tracked.clear(); stopped |= cancelled; notifyAll();
        }
        public synchronized String status() {
            if (stopped) return "stopped";
            if (error != null) return "error";
            if (!mainDone) return "running";
            if (context != null && !context.isContextClosed() && context.shouldKeepAlive()) return "active";
            return "completed";
        }
        public synchronized boolean isLive() {
            return switch (status()) { case "running", "active" -> true; default -> false; };
        }
        public record Output(String task, String status, String output,
                             @SerializedName("dropped_chars") long droppedChars, String error) { }
        public synchronized Output read(int waitMs, boolean waitForCompletion) throws InterruptedException {
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(waitMs);
            // execute waits for the script body; read_output streams as soon as output arrives.
            // Native callbacks may keep a finished body active indefinitely.
            while (waitForCompletion ? status().equals("running")
                    : output.isEmpty() && isLive()) {
                long left = deadline - System.nanoTime();
                if (left <= 0) break;
                TimeUnit.NANOSECONDS.timedWait(this, left);
            }
            Output result = new Output(id, status(), output.toString(), dropped, error);
            output.setLength(0); dropped = 0;
            return result;
        }
    }
}
