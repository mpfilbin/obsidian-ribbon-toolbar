import { MarkdownView, Plugin } from "obsidian";
import { mergeSettings, type RibbonBarSettings } from "./settings";
import { RibbonBarSettingTab } from "./settings-tab";
import type { RibbonBarPluginLike } from "./plugin-contract";
import { RibbonManager } from "./ribbon/RibbonManager";
import { registerCustomIcons } from "./ribbon/icons";
import { COMMAND_REGISTRY } from "./ribbon/commands/registry";
import { buildPaletteCommands } from "./ribbon/commands/paletteCommands";
import type { EditorLike } from "./ribbon/commands/actions/types";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";

export default class RibbonBarPlugin extends Plugin implements RibbonBarPluginLike {
  settings: RibbonBarSettings = mergeSettings(null);
  ribbonManager!: RibbonManager;

  async onload(): Promise<void> {
    await this.loadSettings();
    registerCustomIcons();

    this.ribbonManager = new RibbonManager({
      app: this.app,
      enabled: this.settings.ribbonEnabled,
      defaultCollapsed: this.settings.defaultCollapsed,
      frontmatterProperties: this.settings.frontmatterProperties,
      lastTab: this.settings.lastTab,
      onLastTabChange: (tab) => {
        this.settings.lastTab = tab;
        void this.saveSettings();
      },
    });

    this.addSettingTab(new RibbonBarSettingTab(this.app, this));
    this.registerPaletteCommands();

    this.app.workspace.onLayoutReady(() => this.syncRibbons());
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncRibbons()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncRibbons()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncRibbons()));
  }

  onunload(): void {
    this.ribbonManager.detachAll(this.markdownViews());
  }

  syncRibbons(): void {
    this.ribbonManager.syncAllLeaves(this.markdownViews());
  }

  setRibbonEnabled(enabled: boolean): void {
    this.ribbonManager.setEnabled(enabled);
    this.syncRibbons();
  }

  setDefaultCollapsed(defaultCollapsed: boolean): void {
    this.ribbonManager.setDefaultCollapsed(defaultCollapsed);
  }

  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void {
    this.ribbonManager.setFrontmatterProperties(properties);
  }

  // Exposes the ribbon's commands in the command palette so they can be bound
  // to hotkeys. They only run in an editable Markdown editor, like the ribbon.
  private registerPaletteCommands(): void {
    for (const command of buildPaletteCommands(COMMAND_REGISTRY)) {
      this.addCommand({
        id: command.id,
        name: command.name,
        editorCallback: (editor) => command.run(editor as unknown as EditorLike, this.app),
      });
    }
  }

  private markdownViews(): MarkdownView[] {
    return this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view as MarkdownView);
  }

  async loadSettings(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
