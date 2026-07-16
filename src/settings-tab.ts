import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { RibbonBarPluginLike } from "./plugin-contract";
import type { PropertyType } from "./ribbon/commands/actions/frontmatter";

type RibbonBarPluginInstance = Plugin & RibbonBarPluginLike;

const PROPERTY_TYPE_OPTIONS: [PropertyType, string][] = [
  ["automatic", "Automatic (Text)"],
  ["text", "Text"],
  ["list", "List"],
  ["number", "Number"],
  ["checkbox", "Checkbox"],
  ["date", "Date"],
  ["datetime", "Date & time"],
];

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

    containerEl.createEl("h3", { text: "Frontmatter properties" });
    containerEl.createEl("p", {
      text: "Each property below becomes a button in the References tab's Properties group.",
      cls: "setting-item-description",
    });

    this.plugin.settings.frontmatterProperties.forEach((property, index) => {
      new Setting(containerEl)
        .setName(property.name)
        .addDropdown((dropdown) => {
          for (const [value, label] of PROPERTY_TYPE_OPTIONS) dropdown.addOption(value, label);
          dropdown.setValue(property.type);
          dropdown.onChange(async (value) => {
            property.type = value as PropertyType;
            await this.plugin.saveSettings();
            this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
          });
        })
        .addText((text) => {
          text.setPlaceholder("Default value (optional)");
          text.setValue(property.defaultValue ?? "");
          text.onChange(async (value) => {
            property.defaultValue = value.length > 0 ? value : undefined;
            await this.plugin.saveSettings();
            this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
          });
        })
        .addExtraButton((button) => {
          button.setIcon("trash");
          button.setTooltip("Remove property");
          button.onClick(async () => {
            this.plugin.settings.frontmatterProperties.splice(index, 1);
            await this.plugin.saveSettings();
            this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
            this.display();
          });
        });
    });

    let newPropertyName = "";
    let newPropertyType: PropertyType = "text";

    new Setting(containerEl)
      .setName("Add property")
      .addText((text) => {
        text.setPlaceholder("Property name");
        text.onChange((value) => {
          newPropertyName = value;
        });
      })
      .addDropdown((dropdown) => {
        for (const [value, label] of PROPERTY_TYPE_OPTIONS) dropdown.addOption(value, label);
        dropdown.setValue(newPropertyType);
        dropdown.onChange((value) => {
          newPropertyType = value as PropertyType;
        });
      })
      .addButton((button) => {
        button.setButtonText("Add");
        button.onClick(async () => {
          const trimmed = newPropertyName.trim();
          if (trimmed.length === 0) return;
          this.plugin.settings.frontmatterProperties.push({ name: trimmed, type: newPropertyType });
          await this.plugin.saveSettings();
          this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
          this.display();
        });
      });
  }
}
