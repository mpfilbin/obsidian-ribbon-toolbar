// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notices, obsidianLog } from "obsidian";
import { COMMAND_REGISTRY, commandsForTab, groupsForTab, TABS } from "../../../src/ribbon/commands/registry";
import { buildPaletteCommands } from "../../../src/ribbon/commands/paletteCommands";
import { createMockEditor } from "../../support/mockEditor";
import { makeBaseApp } from "../../support/baseEnv";

beforeEach(() => obsidianLog.reset());
afterEach(() => vi.restoreAllMocks());

const byId = (id: string) => COMMAND_REGISTRY.find((c) => c.id === id)!;
const block = "```base\nviews:\n  - type: table\n    name: Table\n```";

describe("Bases tab", () => {
  it("is the last tab, after LaTeX", () => {
    expect(TABS.at(-1)).toEqual({ id: "bases", label: "Bases" });
  });

  it("groups its commands by task, in order", () => {
    expect(groupsForTab("bases")).toEqual(["Base", "Views", "Filters", "Formulas", "Functions", "Columns"]);
  });

  it("has a one-click command for each way into a base", () => {
    expect(commandsForTab("bases").filter((c) => c.group === "Base").map((c) => c.label)).toEqual([
      "New Base",
      "Embed Base",
      "Edit Base",
    ]);
  });

  it.each([
    ["base-new", "Base"],
    ["base-embed", "Base"],
    ["base-edit", "Base"],
    ["base-views", "Views"],
    ["base-filters", "Filters"],
    ["base-formulas", "Formulas"],
    ["base-properties", "Columns"],
    ["base-summaries", "Columns"],
  ])("%s opens a dialog", (id, group) => {
    expect(byId(id).modal).toBeTypeOf("function");
    expect(byId(id).group).toBe(group);
  });
});

describe("Add View and Quick Filter menus", () => {
  it("offers every view type", () => {
    expect(byId("base-add-view").options!.map((o) => o.label)).toEqual(["Table", "Cards", "List", "Map"]);
  });

  it("adds a view to the base at the cursor when a type is chosen", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    byId("base-add-view").options!.find((o) => o.label === "Cards")!.action(editor, app);
    await vi.waitFor(() => expect(editor.getValue()).toContain("type: cards"));
    expect(notices[0]).toBe('Added the view "Cards".');
  });

  it("offers the quick filters, starting with the note's folder", () => {
    const labels = byId("base-quick-filter").options!.map((o) => o.label);
    expect(labels[0]).toBe("In this note's folder");
    expect(labels).toContain("Links to this note");
  });

  it("applies a quick filter to the base's filters", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    byId("base-quick-filter").options!.find((o) => o.label === "Links to this note")!.action(editor, app);
    await vi.waitFor(() => expect(editor.getValue()).toContain("file.hasLink(this.file)"));
  });

  it("reports a failure to load the quick-action code instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    vi.doMock("../../../src/ribbon/bases/quickActions", () => {
      throw new Error("load failed");
    });
    const { COMMAND_REGISTRY: registry } = await import("../../../src/ribbon/commands/registry");
    const option = registry.find((c) => c.id === "base-add-view")!.options![0];
    expect(() => option.action(createMockEditor(""), {} as never)).not.toThrow();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    vi.doUnmock("../../../src/ribbon/bases/quickActions");
    vi.resetModules();
  });
});

describe("function menus", () => {
  const menus = () => COMMAND_REGISTRY.filter((c) => c.id.startsWith("base-fn-"));

  it("has one text-grid menu per function group", () => {
    expect(menus().map((m) => m.label)).toEqual(["Functions", "Text", "Number", "List", "Date", "File"]);
    for (const menu of menus()) {
      expect(menu.group).toBe("Functions");
      expect(menu.optionColumns).toBe(3);
      expect(menu.optionCellWidth).toBeGreaterThan(32);
    }
  });

  it("shows each call in its cell and the signature as the tooltip", () => {
    const list = byId("base-fn-list").options!;
    const contains = list.find((o) => o.id === "fn-list-contains")!;
    expect(contains.display).toBe(".contains()");
    expect(contains.label).toContain("list.contains(value)");
    expect(byId("base-fn-global").options!.find((o) => o.id === "fn-global-if")!.display).toBe("if()");
  });

  it("inserts the function at the cursor in the note", () => {
    const editor = createMockEditor("formula: ", { line: 0, ch: 9 });
    byId("base-fn-global").options!.find((o) => o.id === "fn-global-date")!.action(editor, {} as never);
    expect(editor.getValue()).toBe('formula: date("")');
    expect(editor.getCursor()).toEqual({ line: 0, ch: 15 });
  });

  it("keeps the function menus out of the command palette", () => {
    const names = buildPaletteCommands(COMMAND_REGISTRY).map((c) => c.name);
    expect(names.some((n) => n.startsWith("Bases: Functions") || n.startsWith("Bases: Text"))).toBe(false);
  });
});

describe("palette", () => {
  it("includes the base commands for hotkeys", () => {
    const names = buildPaletteCommands(COMMAND_REGISTRY).map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(["Bases: New Base", "Bases: Embed Base", "Bases: Edit Base", "Bases: Filters", "Bases: Formulas", "Bases: Add View: Table", "Bases: Quick Filter: Links to this note"])
    );
  });
});

describe("lazy-loaded base dialogs", () => {
  afterEach(() => {
    for (const path of ["NewBaseModal", "EmbedBaseModal", "BaseManagerModal"]) vi.doUnmock(`../../../src/ribbon/bases/ui/${path}`);
    vi.resetModules();
  });

  const cases: [string, string, string, unknown[]][] = [
    ["base-new", "NewBaseModal", "openNewBaseModal", []],
    ["base-embed", "EmbedBaseModal", "openEmbedBaseModal", []],
    ["base-edit", "BaseManagerModal", "openBaseManager", ["views"]],
    ["base-views", "BaseManagerModal", "openBaseManager", ["views"]],
    ["base-filters", "BaseManagerModal", "openBaseManager", ["filters"]],
    ["base-formulas", "BaseManagerModal", "openBaseManager", ["formulas"]],
    ["base-properties", "BaseManagerModal", "openBaseManager", ["properties"]],
    ["base-summaries", "BaseManagerModal", "openBaseManager", ["summaries"]],
  ];

  it.each(cases)("%s opens its dialog with the editor and app", async (id, file, exportName, extra) => {
    const open = vi.fn();
    vi.resetModules();
    vi.doMock(`../../../src/ribbon/bases/ui/${file}`, () => ({ [exportName]: open }));
    const { COMMAND_REGISTRY: registry } = await import("../../../src/ribbon/commands/registry");
    const editor = createMockEditor("");
    const app = {} as never;
    registry.find((c) => c.id === id)!.modal!(editor, app);
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith(editor, app, ...extra));
  });

  it("logs instead of throwing when a dialog fails to load", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    vi.doMock("../../../src/ribbon/bases/ui/NewBaseModal", () => {
      throw new Error("load failed");
    });
    const { COMMAND_REGISTRY: registry } = await import("../../../src/ribbon/commands/registry");
    expect(() => registry.find((c) => c.id === "base-new")!.modal!(createMockEditor(""), {} as never)).not.toThrow();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
  });
});
