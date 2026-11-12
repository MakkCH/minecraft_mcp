package minecraft.mcp;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Vanilla UI shared by Mod Menu, F8 and /mcp config. */
public final class SettingsScreen extends Screen {
    private final Screen parent;
    private final MinecraftMcpClient owner;
    private final ClientConfig draft;
    private final List<Label> labels = new ArrayList<>();
    private String portText;
    private boolean chatPage;
    private String error = "";
    private record Label(String text, int x, int y) { }

    public SettingsScreen(Screen parent, MinecraftMcpClient owner) {
        super(Component.literal("Minecraft MCP"));
        this.parent = parent; this.owner = owner; this.draft = owner.config();
        this.portText = Integer.toString(draft.port);
    }
    @Override protected void init() {
        labels.clear();
        int left = width / 2 - 155, top = Math.max(47, (height - 210) / 2), y = top + 30;
        labels.add(new Label(chatPage ? "Colors accept names or #RRGGBB." : "Paste the same token into your MCP configuration.", left, top));
        labels.add(new Label("Apply stops active agent tasks.", left, top+12));
        button(chatPage ? "Connection" : "Chat appearance", left, y, 150, b -> {
            if (readPort()) { chatPage = !chatPage; rebuildWidgets(); }
        });
        button(owner.enabled() ? "Stop agent" : "Enable agent", left+160, y, 150, b -> {
            owner.setEnabled(!owner.enabled()); b.setMessage(Component.literal(owner.enabled() ? "Stop agent" : "Enable agent"));
        });
        if (chatPage) {
            field("Tag", draft.tag, left, y+29, value -> draft.tag = value);
            field("Tag color", draft.tagColor, left, y+53, value -> draft.tagColor = value);
            field("Name (optional)", draft.name, left, y+77, value -> draft.name = value);
            field("Name color", draft.nameColor, left, y+101, value -> draft.nameColor = value);
            field("Message color", draft.messageColor, left, y+125, value -> draft.messageColor = value);
        } else {
            field("Port", portText, left, y+29, value -> portText = value);
            EditBox token = field("Token", draft.token, left, y+53, value -> draft.token = value);
            button("Copy token", left, y+79, 150, b -> minecraft.keyboardHandler.setClipboard(token.getValue()));
            button("Generate token", left+160, y+79, 150, b -> token.setValue(ClientConfig.newToken()));
            toggle("Auto-start", left, y+105, () -> draft.autoStart, value -> draft.autoStart = value);
            toggle("Allow remote", left, y+129, () -> draft.allowRemote, value -> draft.allowRemote = value)
                .setTooltip(Tooltip.create(Component.literal("On: listen on all IPv4 interfaces. Your token is still required. Use a trusted network or encrypted tunnel.")));
        }
        button("Apply", left, y+157, 150, b -> {
            if (!readPort()) return;
            try { owner.apply(draft); error = "Saved"; }
            catch (Exception e) { error = e.getMessage(); }
        });
        button("Done", left+160, y+157, 150, b -> onClose());
    }
    private Button button(String label, int x, int y, int width, Button.OnPress action) {
        return addRenderableWidget(Button.builder(Component.literal(label), action).bounds(x, y, width, 20).build());
    }
    private Button toggle(String label, int x, int y, BooleanSupplier get, Consumer<Boolean> set) {
        return button(label + ": " + (get.getAsBoolean() ? "on" : "off"), x, y, 310, b -> {
            set.accept(!get.getAsBoolean());
            b.setMessage(Component.literal(label + ": " + (get.getAsBoolean() ? "on" : "off")));
        });
    }
    private EditBox field(String label, String value, int x, int y, Consumer<String> responder) {
        labels.add(new Label(label, x, y+6));
        EditBox box = new EditBox(font, x+150, y, 160, 20, Component.literal(label));
        box.setMaxLength(256); box.setValue(value); box.setResponder(responder);
        return addRenderableWidget(box);
    }
    private boolean readPort() {
        try {
            draft.port = Integer.parseInt(portText);
            error = ""; return true;
        } catch (NumberFormatException e) { error = "Port must be a number"; return false; }
    }
    @Override public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        super.extractRenderState(graphics, mouseX, mouseY, delta);
        graphics.centeredText(font, title, width/2, 14, 0xFFFFFFFF);
        graphics.centeredText(font, owner.connectionStatus(), width/2, 29, 0xFFAAAAAA);
        for (Label label : labels) graphics.text(font, label.text, label.x, label.y, 0xFFFFFFFF);
        if (!error.isEmpty()) graphics.centeredText(font, error, width/2, height-13, error.equals("Saved") ? 0xFF55FF55 : 0xFFFF5555);
    }
    @Override public boolean isPauseScreen() { return false; }
    @Override public void onClose() { ClientPlatform.setScreen(parent); }
}
