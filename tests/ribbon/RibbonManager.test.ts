// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { RibbonManager } from "../../src/ribbon/RibbonManager";
import { flushSync } from "svelte";
import { createMockEditor } from "../support/mockEditor";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

interface FakeView {
  containerEl: HTMLElement;
  editor: unknown;
  mode: "source" | "preview";
  getMode(): string;
}

function makeView(options: { injectionPoint?: boolean; mode?: "source" | "preview" } = {}): FakeView {
  const containerEl = document.body.appendChild(document.createElement("div"));
  if (options.injectionPoint !== false) containerEl.innerHTML = '<div class="view-content"><p>note</p></div>';
  const view: FakeView = {
    containerEl,
    editor: createMockEditor(""),
    mode: options.mode ?? "source",
    getMode() {
      return this.mode;
    },
  };
  return view;
}

function makeManager(overrides: Partial<ConstructorParameters<typeof RibbonManager>[0]> = {}) {
  return new RibbonManager({
    app: {} as never,
    enabled: true,
    defaultCollapsed: false,
    frontmatterProperties: [],
    ...overrides,
  });
}

const asViews = (...views: FakeView[]) => views as never[];
const hosts = (view: FakeView) => view.containerEl.querySelectorAll(".ribbon-bar-host");
const disabledButtons = (view: FakeView) =>
  [...view.containerEl.querySelectorAll<HTMLButtonElement>(".ribbon-panel button")].filter((b) => b.disabled).length;

describe("RibbonManager", () => {
  it("mounts a ribbon as the first child of the view's .view-content", () => {
    const view = makeView();
    makeManager().attach(view as never);
    const content = view.containerEl.querySelector(".view-content")!;
    expect(content.firstElementChild!.classList.contains("ribbon-bar-host")).toBe(true);
    expect(content.querySelector(".ribbon-tab")).not.toBeNull();
  });

  it("does not mount twice for the same view", () => {
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    manager.attach(view as never);
    expect(hosts(view)).toHaveLength(1);
  });

  it("does nothing while disabled", () => {
    const view = makeView();
    const manager = makeManager({ enabled: false });
    manager.attach(view as never);
    expect(hosts(view)).toHaveLength(0);
  });

  it("warns and skips views without an injection point", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView({ injectionPoint: false });
    makeManager().attach(view as never);
    expect(warn).toHaveBeenCalled();
    expect(hosts(view)).toHaveLength(0);
  });

  it("passes defaultCollapsed to new ribbons, picking up later changes for new ones only", () => {
    const first = makeView();
    const second = makeView();
    const manager = makeManager({ defaultCollapsed: true });
    manager.attach(first as never);
    expect(first.containerEl.querySelector(".ribbon-bar")!.classList.contains("collapsed")).toBe(true);

    manager.setDefaultCollapsed(false);
    manager.attach(second as never);
    expect(second.containerEl.querySelector(".ribbon-bar")!.classList.contains("collapsed")).toBe(false);
    expect(first.containerEl.querySelector(".ribbon-bar")!.classList.contains("collapsed")).toBe(true);
  });

  describe("remembering the selected tab", () => {
    const tabButton = (view: FakeView, label: string) =>
      [...view.containerEl.querySelectorAll<HTMLButtonElement>(".ribbon-tab")].find(
        (t) => t.textContent!.trim() === label
      )!;
    const activeTab = (view: FakeView) =>
      view.containerEl.querySelector(".ribbon-tab.active")!.textContent!.trim();

    it("opens new ribbons on the configured last tab", () => {
      const view = makeView();
      makeManager({ lastTab: "insert" }).attach(view as never);
      expect(activeTab(view)).toBe("Insert");
    });

    it("reports tab selections, and opens later ribbons on the latest one without moving existing ones", () => {
      const onLastTabChange = vi.fn();
      const manager = makeManager({ onLastTabChange });
      const first = makeView();
      const second = makeView();
      manager.attach(first as never);

      tabButton(first, "References").click();
      flushSync();
      expect(onLastTabChange).toHaveBeenCalledWith("references");

      manager.attach(second as never);
      expect(activeTab(second)).toBe("References");

      tabButton(second, "LaTeX").click();
      flushSync();
      expect(activeTab(first)).toBe("References");
      expect(onLastTabChange).toHaveBeenLastCalledWith("latex");
    });

    it("works without a callback or a starting tab", () => {
      const view = makeView();
      makeManager().attach(view as never);
      expect(activeTab(view)).toBe("Home");
      expect(() => {
        tabButton(view, "Layout").click();
        flushSync();
      }).not.toThrow();
    });
  });

  describe("editor availability", () => {
    it("disables buttons in Reading mode even though view.editor still exists", () => {
      const view = makeView({ mode: "preview" });
      makeManager().attach(view as never);
      expect(disabledButtons(view)).toBeGreaterThan(10);
    });

    it("re-enables buttons when an existing ribbon is re-attached after leaving Reading mode", () => {
      const view = makeView({ mode: "preview" });
      const manager = makeManager();
      manager.attach(view as never);
      view.mode = "source";
      manager.attach(view as never);
      flushSync();
      expect(disabledButtons(view)).toBe(0);
    });

    it("treats a view without an editor as unavailable", () => {
      const view = makeView();
      view.editor = undefined;
      makeManager().attach(view as never);
      expect(disabledButtons(view)).toBeGreaterThan(10);
    });
  });

  describe("syncAllLeaves", () => {
    it("attaches new views and removes ribbons from views that are gone", () => {
      const a = makeView();
      const b = makeView();
      const manager = makeManager();
      manager.syncAllLeaves(asViews(a, b));
      expect(hosts(a)).toHaveLength(1);
      expect(hosts(b)).toHaveLength(1);

      manager.syncAllLeaves(asViews(a));
      expect(hosts(a)).toHaveLength(1);
      expect(hosts(b)).toHaveLength(0);
    });

    it("removes every ribbon once disabled and restores them when re-enabled", () => {
      const view = makeView();
      const manager = makeManager();
      manager.syncAllLeaves(asViews(view));
      manager.setEnabled(false);
      manager.syncAllLeaves(asViews(view));
      expect(hosts(view)).toHaveLength(0);

      manager.setEnabled(true);
      manager.syncAllLeaves(asViews(view));
      expect(hosts(view)).toHaveLength(1);
    });
  });

  describe("detach", () => {
    it("unmounts the ribbon and removes its host, tolerating unknown views", () => {
      const view = makeView();
      const manager = makeManager();
      manager.attach(view as never);
      manager.detach(view as never);
      expect(hosts(view)).toHaveLength(0);
      expect(() => manager.detach(view as never)).not.toThrow();
    });

    it("detachAll removes the ribbons from all given views", () => {
      const a = makeView();
      const b = makeView();
      const manager = makeManager();
      manager.syncAllLeaves(asViews(a, b));
      manager.detachAll(asViews(a, b));
      expect(hosts(a)).toHaveLength(0);
      expect(hosts(b)).toHaveLength(0);
    });
  });

  describe("frontmatter properties", () => {
    const propertyButtons = (view: FakeView) => {
      const tab = [...view.containerEl.querySelectorAll<HTMLButtonElement>(".ribbon-tab")].find(
        (t) => t.textContent!.trim() === "References"
      )!;
      tab.click();
      flushSync();
      const groups = [...view.containerEl.querySelectorAll(".ribbon-group")];
      const group = groups.find((g) => g.querySelector(".ribbon-group-label")!.textContent === "Properties");
      return group ? [...group.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")) : [];
    };

    it("starts from the configured properties and live-updates every ribbon, even for in-place mutation", () => {
      const view = makeView();
      const properties = [{ name: "status", type: "text" as const }];
      const manager = makeManager({ frontmatterProperties: properties });
      manager.attach(view as never);
      expect(propertyButtons(view)).toEqual(["status"]);

      // The settings tab mutates its array in place, then republishes the same reference.
      properties.push({ name: "owner", type: "text" });
      manager.setFrontmatterProperties(properties);
      flushSync();
      expect(propertyButtons(view)).toEqual(["status", "owner"]);
    });
  });
});
