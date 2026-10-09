// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";
import { flushSync } from "svelte";
import Group from "../../../src/ribbon/components/Group.svelte";
import RibbonPanel from "../../../src/ribbon/components/RibbonPanel.svelte";
import RibbonBar from "../../../src/ribbon/components/RibbonBar.svelte";
import { COMMAND_REGISTRY, TABS, type CommandEntry } from "../../../src/ribbon/commands/registry";
import { createMockEditor } from "../../support/mockEditor";
import { click, render } from "../../support/svelte";

const app = {} as never;

const entry = (overrides: Partial<CommandEntry>): CommandEntry => ({
  id: "c",
  tab: "home",
  group: "G",
  icon: "bold",
  label: "C",
  action: vi.fn(),
  ...overrides,
});

describe("Group", () => {
  it("renders the group label and picks a control type per command", () => {
    const commands = [
      entry({ id: "plain", label: "Plain" }),
      entry({ id: "drop", label: "Drop", options: [{ id: "o", label: "O", action: vi.fn() }] }),
      entry({ id: "grid", label: "Grid", action: undefined, grid: vi.fn() }),
    ];
    const target = render(Group, { label: "Font", commands, editor: createMockEditor(""), app });
    expect(target.querySelector(".ribbon-group-label")!.textContent).toBe("Font");
    const buttons = [...target.querySelectorAll<HTMLButtonElement>("button.ribbon-button")];
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Plain", "Drop", "Grid"]);
    // Dropdown and TablePicker wrap their toggle in .ribbon-dropdown; a plain Button does not.
    expect(buttons.map((b) => b.parentElement!.classList.contains("ribbon-dropdown"))).toEqual([false, true, true]);
  });

  it("collects compact commands into a separate icon-only grid", () => {
    const commands = [
      entry({ id: "big", label: "Big" }),
      entry({ id: "s1", label: "Small 1", compact: true }),
      entry({ id: "s2", label: "Small 2", compact: true }),
    ];
    const target = render(Group, { label: "Tables", commands, editor: null, app });
    const grid = target.querySelector(".ribbon-compact-grid")!;
    expect([...grid.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Small 1",
      "Small 2",
    ]);
    expect(grid.querySelector(".ribbon-button-label")).toBeNull();
    expect(target.querySelectorAll(".ribbon-group-buttons > button")).toHaveLength(1);
  });

  it("omits the compact grid when no command is compact", () => {
    const target = render(Group, { label: "G", commands: [entry({})], editor: null, app });
    expect(target.querySelector(".ribbon-compact-grid")).toBeNull();
  });
});

describe("RibbonPanel", () => {
  const props = (tab: string, properties: unknown[] = []) => ({
    tab,
    editor: createMockEditor(""),
    propertiesStore: writable(properties),
    app,
  });
  const groupLabels = (target: HTMLElement) =>
    [...target.querySelectorAll(".ribbon-group-label")].map((el) => el.textContent);

  it("renders one group per registry group for the tab, in registry order", () => {
    const target = render(RibbonPanel, props("home"));
    expect(groupLabels(target)).toEqual(["Font", "Paragraph"]);
    const homeCommands = COMMAND_REGISTRY.filter((c) => c.tab === "home");
    expect(target.querySelectorAll("button.ribbon-button")).toHaveLength(homeCommands.length);
  });

  const propertyGroup = (target: HTMLElement) =>
    [...target.querySelectorAll(".ribbon-group")].find((g) => g.querySelector(".ribbon-group-label")!.textContent === "Properties")!;
  const buttonNames = (el: Element) => [...el.querySelectorAll("button.ribbon-button")].map((b) => b.getAttribute("aria-label"));

  it("offers a single Properties menu plus Add Property, instead of a button per property", () => {
    const target = render(
      RibbonPanel,
      props("references", [
        { name: "status", type: "text" },
        { name: "tags", type: "list" },
      ])
    );
    expect(groupLabels(target).at(-1)).toBe("Properties");
    expect(buttonNames(propertyGroup(target))).toEqual(["Properties", "Add Property"]);
  });

  it("lists the predefined properties as the menu's options", () => {
    const target = render(
      RibbonPanel,
      props("references", [
        { name: "status", type: "text" },
        { name: "tags", type: "list" },
      ])
    );
    click(propertyGroup(target).querySelector("button.ribbon-button")!);
    const options = [...document.body.querySelectorAll(".ribbon-dropdown-menu li button")].map((b) => b.textContent!.trim());
    expect(options).toEqual(["status", "tags"]);
  });

  it("still offers Add Property when no predefined properties are configured, but no menu", () => {
    const target = render(RibbonPanel, props("references"));
    expect(buttonNames(propertyGroup(target))).toEqual(["Add Property"]);
  });

  it("has no Properties group on other tabs", () => {
    expect(groupLabels(render(RibbonPanel, props("insert", [{ name: "x", type: "text" }])))).not.toContain("Properties");
  });

  it("updates when the properties store changes", () => {
    const store = writable<unknown[]>([]);
    const target = render(RibbonPanel, { ...props("references"), propertiesStore: store });
    expect(buttonNames(propertyGroup(target))).toEqual(["Add Property"]);
    store.set([{ name: "late", type: "text" }]);
    flushSync();
    expect(buttonNames(propertyGroup(target))).toEqual(["Properties", "Add Property"]);
  });
});

describe("RibbonBar", () => {
  function mountBar(overrides: Record<string, unknown> = {}) {
    const editorStore = writable<unknown>(createMockEditor(""));
    const target = render(RibbonBar, {
      editorStore,
      defaultCollapsed: false,
      propertiesStore: writable([]),
      app,
      ...overrides,
    });
    return { target, editorStore };
  }
  const tabs = (t: HTMLElement) => [...t.querySelectorAll<HTMLButtonElement>(".ribbon-tab")];
  const activeLabel = (t: HTMLElement) => tabs(t).find((b) => b.classList.contains("active"))?.textContent?.trim();

  it("shows every tab, starting on Home, with its panel", () => {
    const { target } = mountBar();
    expect(tabs(target).map((b) => b.textContent!.trim())).toEqual(TABS.map((t) => t.label));
    expect(activeLabel(target)).toBe("Home");
    expect(target.querySelector(".ribbon-panel")).not.toBeNull();
  });

  it("opens on the given initial tab, falling back to Home for an unknown one", () => {
    expect(activeLabel(mountBar({ initialTab: "latex" }).target)).toBe("LaTeX");
    expect(activeLabel(mountBar({ initialTab: "nonsense" }).target)).toBe("Home");
  });

  it("reports each tab selection", () => {
    const ontabchange = vi.fn();
    const { target } = mountBar({ ontabchange });
    click(tabs(target)[3]);
    click(tabs(target)[5]);
    expect(ontabchange.mock.calls).toEqual([["layout"], ["latex"]]);
  });

  it("switches panels when a tab is clicked", () => {
    const { target } = mountBar();
    click(tabs(target)[2]);
    expect(activeLabel(target)).toBe("Insert");
    expect([...target.querySelectorAll(".ribbon-group-label")].map((e) => e.textContent)).toContain("Tables");
  });

  it("collapses to just the tab strip on tab double-click, and expands again", () => {
    const { target } = mountBar();
    const bar = target.querySelector(".ribbon-bar")!;
    tabs(target)[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    flushSync();
    expect(bar.classList.contains("collapsed")).toBe(true);
    expect(target.querySelector(".ribbon-panel")).toBeNull();
    expect(tabs(target)).toHaveLength(TABS.length);

    tabs(target)[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    flushSync();
    expect(target.querySelector(".ribbon-panel")).not.toBeNull();
  });

  it("starts collapsed when defaultCollapsed is set", () => {
    const { target } = mountBar({ defaultCollapsed: true });
    expect(target.querySelector(".ribbon-bar")!.classList.contains("collapsed")).toBe(true);
    expect(target.querySelector(".ribbon-panel")).toBeNull();
  });

  it("disables buttons when the editor goes away and re-enables them when it returns", () => {
    const { target, editorStore } = mountBar();
    const disabledCount = () => [...target.querySelectorAll<HTMLButtonElement>(".ribbon-panel button")].filter((b) => b.disabled).length;
    expect(disabledCount()).toBe(0);
    editorStore.set(null);
    flushSync();
    expect(disabledCount()).toBeGreaterThan(10);
    editorStore.set(createMockEditor(""));
    flushSync();
    expect(disabledCount()).toBe(0);
  });
});
