package minecraft.mcp;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.network.chat.TextColor;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.HexFormat;

/** Owned exclusively by the mod. The MCP process never reads this file. */
public final class ClientConfig {
    static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    public int port = 28473;
    public String token = newToken();
    public boolean autoStart = true;
    public boolean allowRemote = false;
    public String tag = "AGENT", tagColor = "aqua", name = "", nameColor = "gold", messageColor = "white";

    public static String newToken() {
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
    public ClientConfig copy() { return JSON.fromJson(JSON.toJson(this), ClientConfig.class); }
    public String bindHost() { return allowRemote ? "0.0.0.0" : "127.0.0.1"; }
    public void validate() {
        if (port < 1024 || port > 65535) throw new IllegalArgumentException("Port must be 1024–65535");
        if (token == null || !token.matches("[!-~]{32,256}")) throw new IllegalArgumentException("Token must be 32–256 printable characters without spaces");
        if (tag == null || tag.isBlank() || tag.length() > 32 || name == null || name.length() > 64)
            throw new IllegalArgumentException("Tag: 1–32 characters; name: at most 64");
        for (String color : new String[]{tagColor, nameColor, messageColor})
            if (color == null || TextColor.parseColor(color).result().isEmpty())
                throw new IllegalArgumentException("Invalid Minecraft color: " + color);
    }
    public static ClientConfig load(Path path) throws IOException {
        if (!Files.exists(path)) { ClientConfig c = new ClientConfig(); c.save(path); return c; }
        ClientConfig c = JSON.fromJson(Files.readString(path), ClientConfig.class);
        if (c == null) throw new IOException("Empty Minecraft MCP settings");
        c.validate(); return c;
    }
    public void save(Path path) throws IOException {
        validate(); Files.createDirectories(path.getParent());
        Path tmp = Files.createTempFile(path.getParent(), "minecraft-mcp-", ".tmp");
        try {
            try { Files.setPosixFilePermissions(tmp, PosixFilePermissions.fromString("rw-------")); }
            catch (UnsupportedOperationException ignored) { }
            Files.writeString(tmp, JSON.toJson(this));
            try { Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException e) { Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING); }
        } finally { Files.deleteIfExists(tmp); }
    }
}
