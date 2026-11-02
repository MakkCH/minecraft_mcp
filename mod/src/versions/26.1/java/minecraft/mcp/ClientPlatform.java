package minecraft.mcp;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import java.util.function.Consumer;

/** Client entrypoints before the 26.2 GUI reorganization. Called on the game thread. */
final class ClientPlatform {
    static Screen screen() { return Minecraft.getInstance().screen; }
    static void setScreen(Screen screen) { Minecraft.getInstance().setScreen(screen); }
    static void chat(Component text) { Minecraft.getInstance().gui.getChat().addClientSystemMessage(text); }
    static void capture(Consumer<NativeImage> callback) {
        Screenshot.takeScreenshot(Minecraft.getInstance().getMainRenderTarget(), callback);
    }
}
