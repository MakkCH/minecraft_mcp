package minecraft.mcp;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import java.util.function.Consumer;

/** Shared by 26.2 and 26.3. Called on the game thread. */
final class ClientPlatform {
    static Screen screen() { return Minecraft.getInstance().gui.screen(); }
    static void setScreen(Screen screen) { Minecraft.getInstance().gui.setScreen(screen); }
    static void chat(Component text) { Minecraft.getInstance().gui.hud.getChat().addClientSystemMessage(text); }
    static void capture(Consumer<NativeImage> callback) {
        Screenshot.takeScreenshot(Minecraft.getInstance().gameRenderer.mainRenderTarget(), callback);
    }
}
