// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, createdSettings, obsidianLog, Plugin } from "obsidian";
import { RibbonBarSettingTab } from "../src/settings-tab";
import { mergeSettings } from "../src/settings";

function makeTab(settingsOverride: Parameters<typeof mergeSettings>[0] = null) {
  const app = new App();
  const plugin = Object.assign(new Plugin(app), {
    settings: mergeSettings(settingsOverride),
    saveSettings: vi.fn(async () => {}),
    setRibbonEnabled: vi.fn(),
    setDefaultCollapsed: vi.fn(),
    setFrontmatterProperties: vi.fn(),
  });
  const tab = new RibbonBarSettingTab(app, plugin as never);
  tab.display();
  return { tab, plugin };
}

const byName = (name: string) => createdSettings.find((s) => s.name === name)!;

beforeEach(() => obsidianLog.reset());

describe("settings tab", () => {
  it("shows the two toggles with their saved values", () => {
    makeTab({ ribbonEnabled: false, defaultCollapsed: true });
    expect(byName("Enable ribbon").toggles[0].getValue()).toBe(false);
    expect(byName("Collapse ribbon by default").toggles[0].getValue()).toBe(true);
  });

  it("saves and applies the enable toggle", async () => {
    const { plugin } = makeTab();
    await byName("Enable ribbon").toggles[0].changeHandler!(false);
    expect(plugin.settings.ribbonEnabled).toBe(false);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.setRibbonEnabled).toHaveBeenCalledWith(false);
  });

  it("saves and applies the collapse-by-default toggle", async () => {
    const { plugin } = makeTab();
    await byName("Collapse ribbon by default").toggles[0].changeHandler!(true);
    expect(plugin.settings.defaultCollapsed).toBe(true);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.setDefaultCollapsed).toHaveBeenCalledWith(true);
  });

  it("lists each configured frontmatter property with its type and default", () => {
    const { tab } = makeTab({ frontmatterProperties: [{ name: "status", type: "list", defaultValue: "draft" }] });
    const row = byName("status");
    expect(row.dropdowns[0].getValue()).toBe("list");
    expect([...row.dropdowns[0].options.keys()]).toEqual([
      "automatic",
      "text",
      "list",
      "number",
      "checkbox",
      "date",
      "datetime",
    ]);
    expect(row.texts[0].getValue()).toBe("draft");
    expect(tab.containerEl.querySelector("h3")!.textContent).toBe("Frontmatter properties");
  });

  it("updates a property's type, saving and republishing", async () => {
    const { plugin } = makeTab({ frontmatterProperties: [{ name: "status", type: "text" }] });
    await byName("status").dropdowns[0].changeHandler!("date");
    expect(plugin.settings.frontmatterProperties[0].type).toBe("date");
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.setFrontmatterProperties).toHaveBeenCalledWith(plugin.settings.frontmatterProperties);
  });

  it("sets and clears a property's default value", async () => {
    const { plugin } = makeTab({ frontmatterProperties: [{ name: "status", type: "text" }] });
    const text = byName("status").texts[0];
    await text.changeHandler!("todo");
    expect(plugin.settings.frontmatterProperties[0].defaultValue).toBe("todo");
    await text.changeHandler!("");
    expect(plugin.settings.frontmatterProperties[0].defaultValue).toBeUndefined();
    expect(plugin.setFrontmatterProperties).toHaveBeenCalledTimes(2);
  });

  it("removes a property and redraws the tab", async () => {
    const { plugin, tab } = makeTab({
      frontmatterProperties: [
        { name: "a", type: "text" },
        { name: "b", type: "text" },
      ],
    });
    const remove = byName("a").extraButtons[0];
    expect(remove.icon).toBe("trash");
    expect(remove.tooltip).toBe("Remove property");

    createdSettings.length = 0;
    await remove.clickHandler!();
    expect(plugin.settings.frontmatterProperties.map((p) => p.name)).toEqual(["b"]);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.setFrontmatterProperties).toHaveBeenCalled();
    // display() ran again: only "b" is listed now.
    expect(createdSettings.map((s) => s.name)).toContain("b");
    expect(createdSettings.map((s) => s.name)).not.toContain("a");
    expect(tab.containerEl.querySelectorAll("h3")).toHaveLength(1);
  });

  describe("add property", () => {
    function fillAndAdd(name: string, type?: string) {
      const row = byName("Add property");
      row.texts[0].inputEl.value = name;
      row.texts[0].inputEl.dispatchEvent(new Event("input"));
      if (type) row.dropdowns[0].changeHandler!(type);
      return row.buttons[0].clickHandler!();
    }

    it("defaults the new property's type to text", () => {
      makeTab();
      expect(byName("Add property").dropdowns[0].getValue()).toBe("text");
    });

    it("appends a trimmed, typed property then saves, republishes and redraws", async () => {
      const { plugin } = makeTab({ frontmatterProperties: [] });
      await fillAndAdd("  owner  ", "number");
      expect(plugin.settings.frontmatterProperties).toEqual([{ name: "owner", type: "number" }]);
      expect(plugin.saveSettings).toHaveBeenCalled();
      expect(plugin.setFrontmatterProperties).toHaveBeenCalled();
      expect(createdSettings.map((s) => s.name)).toContain("owner");
    });

    it("ignores blank names", async () => {
      const { plugin } = makeTab({ frontmatterProperties: [] });
      await fillAndAdd("   ");
      expect(plugin.settings.frontmatterProperties).toEqual([]);
      expect(plugin.saveSettings).not.toHaveBeenCalled();
    });
  });
});
