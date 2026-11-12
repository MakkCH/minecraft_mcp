package minecraft.mcp;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import java.util.ArrayList;
import java.util.List;

/** Vanilla UI shared by Mod Menu, F8 and /mcp config. */
public final class SettingsScreen extends Screen {
    private final Screen parent;
    private final MinecraftMcpClient owner;
    private final ClientConfig draft;
    private final List<Label> labels = new ArrayList<>();
    private EditBox port, token, tag, tagColor, name, nameColor, messageColor;
    private boolean chatPage;
    private String error = "";
    private record Label(String text, int x, int y) { }

    public SettingsScreen(Screen parent, MinecraftMcpClient owner) {
        super(Component.literal("Minecraft MCP"));
        this.parent = parent; this.owner = owner; this.draft = owner.config();
    }
    @Override protected void init() {
        labels.clear();
        int left = width / 2 - 155, top = Math.max(47, (height - 210) / 2), y = top + 30;
        labels.add(new Label(chatPage ? "Colors accept names or #RRGGBB." : "Paste the same token into your MCP configuration.", left, top));
        labels.add(new Label("Apply stops active agent tasks.", left, top+12));
        addRenderableWidget(Button.builder(Component.literal(chatPage ? "Connection" : "Chat appearance"), b -> {
            if (readFields()) { chatPage = !chatPage; rebuildWidgets(); }
        }).bounds(left, y, 150, 20).build());
        addRenderableWidget(Button.builder(Component.literal(owner.enabled() ? "Stop agent" : "Enable agent"), b -> {
            owner.setEnabled(!owner.enabled()); b.setMessage(Component.literal(owner.enabled() ? "Stop agent" : "Enable agent"));
        }).bounds(left + 160, y, 150, 20).build());
        if (chatPage) {
            tag = field("Tag", draft.tag, left, y+29, 160);
            tagColor = field("Tag color", draft.tagColor, left, y+53, 160);
            name = field("Name (optional)", draft.name, left, y+77, 160);
            nameColor = field("Name color", draft.nameColor, left, y+101, 160);
            messageColor = field("Message color", draft.messageColor, left, y+125, 160);
        } else {
            port = field("Port", Integer.toString(draft.port), left, y+29, 160);
            token = field("Token", draft.token, left, y+53, 160);
            addRenderableWidget(Button.builder(Component.literal("Copy token"), b -> minecraft.keyboardHandler.setClipboard(token.getValue()))
                .bounds(left, y+79, 150, 20).build());
            addRenderableWidget(Button.builder(Component.literal("Generate token"), b -> token.setValue(ClientConfig.newToken()))
                .bounds(left+160, y+79, 150, 20).build());
            addRenderableWidget(Button.builder(Component.literal("Auto-start: " + (draft.autoStart ? "on" : "off")), b -> {
                draft.autoStart = !draft.autoStart; b.setMessage(Component.literal("Auto-start: " + (draft.autoStart ? "on" : "off")));
            }).bounds(left, y+105, 310, 20).build());
            addRenderableWidget(Button.builder(Component.literal("Allow remote: " + (draft.allowRemote ? "on" : "off")), b -> {
                draft.allowRemote = !draft.allowRemote;
                b.setMessage(Component.literal("Allow remote: " + (draft.allowRemote ? "on" : "off")));
            }).bounds(left, y+129, 310, 20)
                .tooltip(Tooltip.create(Component.literal("On: listen on all IPv4 interfaces. Your token is still required. Use a trusted network or encrypted tunnel.")))
                .build());
        }
        addRenderableWidget(Button.builder(Component.literal("Apply"), b -> {
            if (!readFields()) return;
            try { owner.apply(draft); error = "Saved"; }
            catch (Exception e) { error = e.getMessage(); }
        }).bounds(left, y+157, 150, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Done"), b -> onClose()).bounds(left+160, y+157, 150, 20).build());
    }
    private EditBox field(String label, String value, int x, int y, int size) {
        labels.add(new Label(label, x, y+6));
        EditBox box = new EditBox(font, x+150, y, size, 20, Component.literal(label));
        box.setMaxLength(256); box.setValue(value); addRenderableWidget(box); return box;
    }
    private boolean readFields() {
        try {
            if (chatPage) {
                draft.tag = tag.getValue(); draft.tagColor = tagColor.getValue(); draft.name = name.getValue();
                draft.nameColor = nameColor.getValue(); draft.messageColor = messageColor.getValue();
            } else { draft.port = Integer.parseInt(port.getValue()); draft.token = token.getValue(); }
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
