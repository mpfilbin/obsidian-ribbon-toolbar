// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, MarkdownView, obsidianLog } from "obsidian";
import RibbonBarPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings";
import { RibbonBarSettingTab } from "../src/settings-tab";
import { createMockEditor } from "./support/mockEditor";

type Handler = () => void;

function makeApp(views: object[] = []) {
  const handlers = new Map<string, Handler[]>();
  let layoutReady: Handler | null = null;
  const app = new App() as any;
  app.workspace = {
    onLayoutReady: (cb: Handler) => {
      layoutReady = cb;
    },
    on: (name: string, cb: Handler) => {
      handlers.set(name, [...(handlers.get(name) ?? []), cb]);
      return { name };
    },
    getLeavesOfType: vi.fn(() => views.map((view) => ({ view }))),
  };
  return {
    app,
    fire: (name: string) => handlers.get(name)?.forEach((cb) => cb()),
    layoutReady: () => layoutReady?.(),
    handlers,
  };
}

/** A stand-in for a loaded MarkdownView (the plugin ignores anything that isn't one). */
const markdownView = (id: string) => Object.assign(Object.create(MarkdownView.prototype), { id });

async function loadPlugin(stored?: unknown, views: object[] = []) {
  const env = makeApp(views);
  const plugin = new RibbonBarPlugin(env.app) as any;
  plugin.data = stored ?? null;
  await plugin.onload();
  const manager = plugin.ribbonManager;
  const spies = {
    sync: vi.spyOn(manager, "syncAllLeaves").mockImplementation(() => {}),
    enabled: vi.spyOn(manager, "setEnabled"),
    collapsed: vi.spyOn(manager, "setDefaultCollapsed"),
    properties: vi.spyOn(manager, "setFrontmatterProperties"),
    detachAll: vi.spyOn(manager, "detachAll").mockImplementation(() => {}),
  };
  return { plugin, env, spies, views };
}

beforeEach(() => obsidianLog.reset());

describe("RibbonBarPlugin", () => {
  describe("onload", () => {
    it("falls back to default settings on a fresh install", async () => {
      const { plugin } = await loadPlugin();
      expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
    });

    it("merges stored settings over the defaults", async () => {
      const { plugin } = await loadPlugin({ ribbonEnabled: false });
      expect(plugin.settings.ribbonEnabled).toBe(false);
      expect(plugin.settings.defaultCollapsed).toBe(DEFAULT_SETTINGS.defaultCollapsed);
    });

    it("registers the custom table icons", async () => {
      await loadPlugin();
      expect(obsidianLog.icons.has("ribbon-bar-table-delete-row")).toBe(true);
      expect(obsidianLog.icons.has("ribbon-bar-table-insert-column-left")).toBe(true);
    });

    it("adds the settings tab", async () => {
      const { plugin } = await loadPlugin();
      expect(plugin.settingTabs).toHaveLength(1);
      expect(plugin.settingTabs[0]).toBeInstanceOf(RibbonBarSettingTab);
    });

    it("registers the ribbon's commands in the palette, running them against the active editor", async () => {
      const { plugin } = await loadPlugin();
      const bold = plugin.commands.find((c: any) => c.id === "bold");
      expect(bold.name).toBe("Home: Bold");
      expect(plugin.commands.length).toBeGreaterThan(40);

      const editor = createMockEditor("word");
      editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 4 });
      bold.editorCallback(editor, {});
      expect(editor.getValue()).toBe("**word**");
    });

    it("syncs ribbons once the layout is ready and on every workspace change event", async () => {
      const { env, spies } = await loadPlugin();
      env.layoutReady();
      expect(spies.sync).toHaveBeenCalledTimes(1);
      for (const event of ["active-leaf-change", "layout-change", "file-open"]) {
        spies.sync.mockClear();
        env.fire(event);
        expect(spies.sync, event).toHaveBeenCalledTimes(1);
      }
    });

    it("hands the manager the markdown views from the workspace", async () => {
      const view = markdownView("v1");
      const { plugin, spies } = await loadPlugin(undefined, [view]);
      plugin.syncRibbons();
      expect(spies.sync).toHaveBeenCalledWith([view]);
    });
  });

  it("skips background tabs that haven't loaded yet, whose view is only a placeholder", async () => {
    const loaded = markdownView("loaded");
    const placeholder = { id: "deferred" };
    const { plugin, spies } = await loadPlugin(undefined, [placeholder, loaded]);
    plugin.syncRibbons();
    expect(spies.sync).toHaveBeenCalledWith([loaded]);
  });

  it("detaches every ribbon on unload", async () => {
    const view = markdownView("v1");
    const { plugin, spies } = await loadPlugin(undefined, [view]);
    plugin.onunload();
    expect(spies.detachAll).toHaveBeenCalledWith([view]);
  });

  it("setRibbonEnabled updates the manager and re-syncs", async () => {
    const { plugin, spies } = await loadPlugin();
    plugin.setRibbonEnabled(false);
    expect(spies.enabled).toHaveBeenCalledWith(false);
    expect(spies.sync).toHaveBeenCalledTimes(1);
  });

  it("forwards default-collapsed and frontmatter property changes to the manager", async () => {
    const { plugin, spies } = await loadPlugin();
    plugin.setDefaultCollapsed(true);
    expect(spies.collapsed).toHaveBeenCalledWith(true);
    const properties = [{ name: "x", type: "text" }];
    plugin.setFrontmatterProperties(properties);
    expect(spies.properties).toHaveBeenCalledWith(properties);
  });

  it("opens ribbons on the saved tab and saves the tab the user selects", async () => {
    const { plugin } = await loadPlugin({ lastTab: "layout" });
    expect(plugin.settings.lastTab).toBe("layout");

    plugin.ribbonManager.rememberTab("latex");
    expect(plugin.settings.lastTab).toBe("latex");
    await vi.waitFor(() => expect(plugin.data).toMatchObject({ lastTab: "latex" }));
  });

  it("defaults the last tab to Home", async () => {
    const { plugin } = await loadPlugin();
    expect(plugin.settings.lastTab).toBe("home");
  });

  it("persists settings via saveData and reloads them", async () => {
    const { plugin } = await loadPlugin();
    plugin.settings.ribbonEnabled = false;
    plugin.settings.defaultCollapsed = true;
    await plugin.saveSettings();
    expect(plugin.data).toMatchObject({ ribbonEnabled: false, defaultCollapsed: true });

    plugin.settings = { ...DEFAULT_SETTINGS };
    await plugin.loadSettings();
    expect(plugin.settings.ribbonEnabled).toBe(false);
    expect(plugin.settings.defaultCollapsed).toBe(true);
  });
});
