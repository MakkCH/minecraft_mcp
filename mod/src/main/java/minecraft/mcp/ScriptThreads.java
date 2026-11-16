package minecraft.mcp;

import java.util.concurrent.Executor;
import xyz.wagyourtail.jsmacros.core.MethodWrapper;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;

public final class ScriptThreads {
    private ScriptThreads() { }

    public static void runOnServer(Executor server, MethodWrapper<?, ?, ?, ?> callback) throws InterruptedException {
        FutureTask<Void> task = new FutureTask<>(callback, null);
        server.execute(task);
        // Waiting in native Java lets JsMacros yield and reacquire the Graal context.
        callback.getCtx().wrapSleep(() -> {
            try { task.get(); }
            catch (ExecutionException e) { throw new RuntimeException(e.getCause()); }
        });
    }
}
