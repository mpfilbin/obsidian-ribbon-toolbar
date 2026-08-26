import { MarkdownView, Plugin } from "obsidian";
import { mergeSettings, type RibbonBarSettings } from "./settings";
import { RibbonBarSettingTab } from "./settings-tab";
import type { RibbonBarPluginLike } from "./plugin-contract";
import { RibbonManager } from "./ribbon/RibbonManager";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";
import type { HighlightColorConfig } from "./ribbon/commands/actions/highlightMark";

export default class RibbonBarPlugin extends Plugin implements RibbonBarPluginLike {
  settings: RibbonBarSettings = mergeSettings(null);
  ribbonManager!: RibbonManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.ribbonManager = new RibbonManager({
      app: this.app,
      enabled: this.settings.ribbonEnabled,
      defaultCollapsed: this.settings.defaultCollapsed,
      frontmatterProperties: this.settings.frontmatterProperties,
      highlightColors: this.settings.highlightColors,
    });

    this.addSettingTab(new RibbonBarSettingTab(this.app, this));

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

  setHighlightColors(colors: HighlightColorConfig[]): void {
    this.ribbonManager.setHighlightColors(colors);
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
