import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { RibbonBarPluginLike } from "./plugin-contract";

type RibbonBarPluginInstance = Plugin & RibbonBarPluginLike;

export class RibbonBarSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: RibbonBarPluginInstance) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enable ribbon")
      .setDesc("Show the editing ribbon above Markdown panes.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ribbonEnabled).onChange(async (value) => {
          this.plugin.settings.ribbonEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.setRibbonEnabled(value);
        })
      );

    new Setting(containerEl)
      .setName("Collapse ribbon by default")
      .setDesc("New ribbons start collapsed to just the tab strip.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.defaultCollapsed).onChange(async (value) => {
          this.plugin.settings.defaultCollapsed = value;
          await this.plugin.saveSettings();
          this.plugin.setDefaultCollapsed(value);
        })
      );
  }
}
