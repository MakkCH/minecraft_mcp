package minecraft.mcp;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
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
    private final String version;
    private final ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor();
    private final BlockingQueue<Request> requests = new ArrayBlockingQueue<>(64);
    private final Map<String, Job> jobs = new LinkedHashMap<>();
    private volatile byte[] token;
    private volatile boolean enabled;

    public Bridge(String host, int port, String token, boolean enabled, String version) throws IOException {
        this.version = version;
        setToken(token);
        this.enabled = enabled;
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
        // Reclaim only the oldest consumed result, preserving unread output and errors.
        if (jobs.size() >= 128) {
            var iterator = jobs.values().iterator();
            while (iterator.hasNext()) if (iterator.next().discard()) { iterator.remove(); break; }
        }
        if (jobs.size() >= 128) throw new IllegalStateException("Task limit reached; stop active scripts and read their final output");
        Job job = new Job(UUID.randomUUID().toString());
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
                send(x, 200, Map.of("version", version, "enabled", enabled)); return;
            }
            if (path.equals("/output") && x.getRequestMethod().equals("GET")) {
                Map<String,String> q = query(x.getRequestURI().getRawQuery());
                Job job = getJob(q.get("task"));
                if (job == null) { send(x, 404, error("Unknown or expired task")); return; }
                int wait;
                try { wait = Integer.parseInt(q.getOrDefault("wait_ms", "0")); }
                catch (NumberFormatException e) { send(x, 400, error("wait_ms must be an integer from 0 to 30000")); return; }
                if (wait < 0 || wait > 30000) { send(x, 400, error("wait_ms must be an integer from 0 to 30000")); return; }
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
        private static final int OUTPUT_LIMIT = 65536;
        private final byte[] output = new byte[OUTPUT_LIMIT];
        private int outputHead, outputSize;
        private long dropped;
        private boolean mainDone, stopped, terminalRead;
        private String error;
        private BaseScriptContext<?> context;
        private final List<Object> tracked = new ArrayList<>();
        Job(String id) { this.id = id; }
        private synchronized boolean discard() {
            return terminalRead && outputSize == 0 && !isLive() && (context == null || context.isContextClosed());
        }
        public synchronized void attach(BaseScriptContext<?> context) { this.context = context; }
        public synchronized BaseScriptContext<?> getContext() { return context; }
        public synchronized void write(String text) {
            byte[] incoming = (text + '\n').getBytes(StandardCharsets.UTF_8);
            int start = Math.max(0, incoming.length - OUTPUT_LIMIT);
            while (start < incoming.length && (incoming[start] & 0xC0) == 0x80) start++;
            if (start > 0) {
                dropped += outputSize + start; outputHead = outputSize = 0;
            } else {
                int remove = Math.max(0, outputSize + incoming.length - OUTPUT_LIMIT);
                outputHead = (outputHead + remove) % OUTPUT_LIMIT;
                outputSize -= remove; dropped += remove;
                // Discard the rest of a partial UTF-8 character without moving retained bytes.
                while (outputSize > 0 && (output[outputHead] & 0xC0) == 0x80) {
                    outputHead = (outputHead + 1) % OUTPUT_LIMIT; outputSize--; dropped++;
                }
            }
            int count = incoming.length - start;
            int tail = (outputHead + outputSize) % OUTPUT_LIMIT;
            int first = Math.min(count, OUTPUT_LIMIT - tail);
            System.arraycopy(incoming, start, output, tail, first);
            System.arraycopy(incoming, start + first, output, 0, count - first);
            outputSize += count;
            notifyAll();
        }
        private static String truncation(long bytes) { return "[ …" + bytes + " bytes truncated… ]"; }
        public synchronized void finish(String error) {
            if (error != null) {
                byte[] bytes = error.getBytes(StandardCharsets.UTF_8);
                int keep = Math.min(bytes.length, 262144);
                while (keep < bytes.length && (bytes[keep] & 0xC0) == 0x80) keep--;
                error = new String(bytes, 0, keep, StandardCharsets.UTF_8)
                    + (keep < bytes.length ? "\n" + truncation(bytes.length - keep) : "");
            }
            this.error = error; mainDone = true; terminalRead = false; notifyAll();
        }
        public synchronized void track(Object obj) { tracked.add(obj); }
        public synchronized void stopped(boolean cancelled) {
            for (Object obj : tracked) try { obj.getClass().getMethod("unregister").invoke(obj); }
            catch (ReflectiveOperationException e) { write("[cleanup] " + e); }
            tracked.clear(); stopped |= cancelled; terminalRead &= !cancelled; notifyAll();
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
        public record Output(String task, String status, String error, String output) { }
        public synchronized Output read(int waitMs, boolean waitForCompletion) throws InterruptedException {
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(waitMs);
            // execute waits for the script body; read_output streams as soon as output arrives.
            // Native callbacks may keep a finished body active indefinitely.
            while (waitForCompletion ? status().equals("running")
                    : outputSize == 0 && isLive()) {
                long left = deadline - System.nanoTime();
                if (left <= 0) break;
                TimeUnit.NANOSECONDS.timedWait(this, left);
            }
            byte[] bytes = new byte[outputSize];
            int first = Math.min(outputSize, OUTPUT_LIMIT - outputHead);
            System.arraycopy(output, outputHead, bytes, 0, first);
            System.arraycopy(output, 0, bytes, first, outputSize - first);
            Output result = new Output(id, status(), error,
                (dropped > 0 ? truncation(dropped) + "\n" : "") + new String(bytes, StandardCharsets.UTF_8));
            terminalRead = !isLive();
            outputHead = outputSize = 0; dropped = 0;
            return result;
        }
    }
}
