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

describe("ribbons that Obsidian removes from the page", () => {
  // Obsidian can rebuild a view's DOM (for example while loading a large paste),
  // taking our host element with it while the manager still thinks it is mounted.
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const content = (view: FakeView) => view.containerEl.querySelector(".view-content")!;
  const hostCount = (view: FakeView) => view.containerEl.querySelectorAll(".ribbon-bar-host").length;

  it("puts the ribbon back on the next sync when its host was removed", () => {
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    view.containerEl.querySelector(".ribbon-bar-host")!.remove();
    expect(hostCount(view)).toBe(0);

    manager.syncAllLeaves(asViews(view));
    expect(hostCount(view)).toBe(1);
    expect(content(view).firstElementChild!.classList.contains("ribbon-bar-host")).toBe(true);
  });

  it("restores a removed ribbon by itself, without waiting for a workspace event", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    makeManager().attach(view as never);
    view.containerEl.querySelector(".ribbon-bar-host")!.remove();
    await settle();
    expect(hostCount(view)).toBe(1);
  });

  it("keeps the same mounted ribbon, including its selected tab, when restoring it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    makeManager().attach(view as never);
    const tab = [...view.containerEl.querySelectorAll<HTMLButtonElement>(".ribbon-tab")].find((t) => t.textContent!.trim() === "Insert")!;
    tab.click();
    flushSync();
    view.containerEl.querySelector(".ribbon-bar-host")!.remove();
    await settle();
    expect(view.containerEl.querySelector(".ribbon-tab.active")!.textContent!.trim()).toBe("Insert");
  });

  it("moves the ribbon into a replacement .view-content when Obsidian swaps it out", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    makeManager().attach(view as never);
    const replacement = document.createElement("div");
    replacement.className = "view-content";
    content(view).replaceWith(replacement);
    await settle();
    expect(replacement.firstElementChild!.classList.contains("ribbon-bar-host")).toBe(true);
    expect(hostCount(view)).toBe(1);
  });

  it("restores a ribbon when the whole .view-content is emptied", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    makeManager().attach(view as never);
    content(view).replaceChildren();
    await settle();
    expect(hostCount(view)).toBe(1);
  });

  it("says in the console when it had to restore a ribbon", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    makeManager().attach(view as never);
    view.containerEl.querySelector(".ribbon-bar-host")!.remove();
    await settle();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Ribbon Bar: restored a ribbon");
  });

  it("leaves a healthy ribbon alone, however much else changes in the view", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    makeManager().attach(view as never);
    for (let i = 0; i < 50; i++) content(view).querySelector("p")!.append(document.createElement("span"));
    content(view).append(document.createElement("div"));
    await settle();
    expect(hostCount(view)).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not bring a ribbon back after it was detached on purpose", async () => {
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    manager.detach(view as never);
    content(view).append(document.createElement("div"));
    await settle();
    expect(hostCount(view)).toBe(0);
  });

  it("gives up quietly when the view has no .view-content to restore into", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    content(view).remove();
    await settle();
    expect(hostCount(view)).toBe(0);
    expect(() => manager.syncAllLeaves(asViews(view))).not.toThrow();
  });
});

describe("keeping the ribbon visible", () => {
  // .view-content only holds the editor and the ribbon, so it should never scroll.
  // If it does (the browser scrolling to the caret after a huge paste), the ribbon
  // is carried off the top, so the manager scrolls it back.
  const content = (view: FakeView) => view.containerEl.querySelector<HTMLElement>(".view-content")!;

  /** jsdom doesn't scroll, so give the element a scrollTop that behaves like a browser's. */
  function scrollable(el: HTMLElement) {
    let top = 0;
    Object.defineProperty(el, "scrollTop", { get: () => top, set: (value: number) => (top = value), configurable: true });
    return { scrollTo: (value: number) => { top = value; el.dispatchEvent(new Event("scroll")); }, get: () => top };
  }

  it("marks the container it lives in so styles.css can lay it out around the ribbon", () => {
    const view = makeView();
    makeManager().attach(view as never);
    expect(content(view).classList.contains("ribbon-bar-active")).toBe(true);
  });

  it("removes the mark when the ribbon is detached", () => {
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    manager.detach(view as never);
    expect(content(view).classList.contains("ribbon-bar-active")).toBe(false);
  });

  it("scrolls the container back to the top if something scrolls it", () => {
    const view = makeView();
    makeManager().attach(view as never);
    const scroll = scrollable(content(view));
    scroll.scrollTo(123);
    expect(scroll.get()).toBe(0);
  });

  it("leaves a container that is already at the top alone", () => {
    const view = makeView();
    makeManager().attach(view as never);
    const scroll = scrollable(content(view));
    scroll.scrollTo(0);
    expect(scroll.get()).toBe(0);
  });

  it("stops guarding the scroll position once the ribbon is detached", () => {
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    const scroll = scrollable(content(view));
    manager.detach(view as never);
    scroll.scrollTo(80);
    expect(scroll.get()).toBe(80);
  });

  it("moves the mark and the scroll guard to a replacement container", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    makeManager().attach(view as never);
    const old = content(view);
    const replacement = document.createElement("div");
    replacement.className = "view-content";
    old.replaceWith(replacement);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(replacement.classList.contains("ribbon-bar-active")).toBe(true);
    expect(old.classList.contains("ribbon-bar-active")).toBe(false);
    const scroll = scrollable(replacement);
    scroll.scrollTo(50);
    expect(scroll.get()).toBe(0);
  });
});

describe("restoring through attach() before the page watcher runs", () => {
  const content = (view: FakeView) => view.containerEl.querySelector<HTMLElement>(".view-content")!;
  function scrollable(el: HTMLElement) {
    let top = 0;
    Object.defineProperty(el, "scrollTop", { get: () => top, set: (value: number) => (top = value), configurable: true });
    return { scrollTo: (value: number) => { top = value; el.dispatchEvent(new Event("scroll")); }, get: () => top };
  }

  it("re-binds the scroll guard to the new container, not the discarded one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    const old = content(view);
    const oldScroll = scrollable(old);

    const replacement = document.createElement("div");
    replacement.className = "view-content";
    old.replaceWith(replacement);
    // A workspace event syncs before the page watcher's microtask has run.
    manager.attach(view as never);

    const scroll = scrollable(replacement);
    scroll.scrollTo(90);
    expect(scroll.get()).toBe(0);
    oldScroll.scrollTo(40);
    expect(oldScroll.get()).toBe(40); // the discarded container is no longer guarded
  });

  it("keeps watching the new container for later removals", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    const replacement = document.createElement("div");
    replacement.className = "view-content";
    content(view).replaceWith(replacement);
    manager.attach(view as never);

    replacement.replaceChildren();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(view.containerEl.querySelectorAll(".ribbon-bar-host")).toHaveLength(1);
    expect(replacement.firstElementChild!.classList.contains("ribbon-bar-host")).toBe(true);
  });

  it("does not stack watchers when it re-arms", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = makeView();
    const manager = makeManager();
    manager.attach(view as never);
    for (let i = 0; i < 3; i++) {
      const next = document.createElement("div");
      next.className = "view-content";
      content(view).replaceWith(next);
      manager.attach(view as never);
    }
    const target = content(view);
    const add = vi.spyOn(target, "addEventListener");
    const remove = vi.spyOn(target, "removeEventListener");
    manager.detach(view as never);
    expect(add).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
