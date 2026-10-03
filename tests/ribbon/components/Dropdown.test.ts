// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import Dropdown from "../../../src/ribbon/components/Dropdown.svelte";
import type { CommandEntry } from "../../../src/ribbon/commands/registry";
import { createMockEditor } from "../../support/mockEditor";
import { click, render, unmountAll } from "../../support/svelte";

afterEach(() => vi.restoreAllMocks());

function command(overrides: Partial<CommandEntry> = {}): CommandEntry {
  return {
    id: "case",
    tab: "home",
    group: "Font",
    icon: "case-sensitive",
    label: "Change Case",
    options: [
      { id: "upper", label: "UPPERCASE", action: vi.fn() },
      { id: "lower", label: "lowercase", action: vi.fn() },
    ],
    ...overrides,
  };
}

const menu = () => document.body.querySelector<HTMLElement>(".ribbon-dropdown-menu");
const items = () => [...document.body.querySelectorAll<HTMLButtonElement>(".ribbon-dropdown-menu li button")];

function open(cmd: CommandEntry, editor = createMockEditor("")) {
  const target = render(Dropdown, { command: cmd, editor });
  const toggle = target.querySelector<HTMLButtonElement>("button.ribbon-button")!;
  click(toggle);
  flushSync();
  return { target, toggle, editor };
}

describe("Dropdown", () => {
  it("shows a toggle with the command's label and a caret, closed by default", () => {
    const target = render(Dropdown, { command: command(), editor: createMockEditor("") });
    expect(target.querySelector(".ribbon-button-label")!.textContent).toBe("Change Case ▾");
    expect(menu()).toBeNull();
  });

  it("is disabled without an editor", () => {
    const target = render(Dropdown, { command: command(), editor: null });
    expect(target.querySelector<HTMLButtonElement>("button.ribbon-button")!.disabled).toBe(true);
  });

  it("opens a menu of options, portaled to <body> to escape the clipped ribbon panel", () => {
    const { target } = open(command());
    expect(items().map((b) => b.textContent!.trim())).toEqual(["UPPERCASE", "lowercase"]);
    expect(target.contains(menu())).toBe(false);
    expect(menu()!.parentElement).toBe(document.body);
  });

  it("positions the menu just under the toggle", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 120, bottom: 60 } as DOMRect);
    open(command());
    expect(menu()!.style.top).toBe("62px");
    expect(menu()!.style.left).toBe("120px");
  });

  it("toggles closed when the toggle is clicked again", () => {
    const { toggle } = open(command());
    click(toggle);
    flushSync();
    expect(menu()).toBeNull();
  });

  it("runs the chosen option on the editor, refocuses it, and closes", () => {
    const cmd = command();
    const editor = createMockEditor("");
    const focus = vi.spyOn(editor, "focus");
    open(cmd, editor);
    click(items()[1]);
    flushSync();
    expect(cmd.options![1].action).toHaveBeenCalledWith(editor);
    expect(cmd.options![0].action).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(menu()).toBeNull();
  });

  it("closes on a click outside, but not on a click inside the menu", () => {
    open(command());
    click(menu()!);
    flushSync();
    expect(menu()).not.toBeNull();

    click(document.body);
    flushSync();
    expect(menu()).toBeNull();
  });

  it("removes the portaled menu when the component is destroyed", () => {
    open(command());
    expect(menu()).not.toBeNull();
    unmountAll();
    expect(menu()).toBeNull();
  });

  describe("grid layout", () => {
    const gridCommand = () =>
      command({
        label: "Symbols",
        optionColumns: 8,
        options: [
          { id: "dash", label: "—  Em Dash", display: "—", action: vi.fn() },
          { id: "plain", label: "Plain", action: vi.fn() },
        ],
      });

    it("uses the grid class and column count, showing compact glyphs with the label as tooltip", () => {
      open(gridCommand());
      expect(menu()!.classList.contains("ribbon-dropdown-menu-grid")).toBe(true);
      expect(menu()!.style.getPropertyValue("--ribbon-menu-columns")).toBe("8");
      const [dash, plain] = items();
      expect(dash.textContent!.trim()).toBe("—");
      expect(dash.title).toBe("—  Em Dash");
      expect(dash.getAttribute("aria-label")).toBe("—  Em Dash");
      expect(plain.textContent!.trim()).toBe("Plain");
    });

    it("keeps a wide menu inside the window's right edge", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 1000, bottom: 10 } as DOMRect);
      open(gridCommand());
      // 8 columns * 36px + 16px padding, with an 8px margin: 1024 - 304 - 8
      expect(menu()!.style.left).toBe("712px");
    });

    it("never pushes a wide menu past the left edge", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: -50, bottom: 10 } as DOMRect);
      open(gridCommand());
      expect(menu()!.style.left).toBe("8px");
    });

    it("sizes grid cells from optionCellWidth and uses text-cell styling", () => {
      const cmd = command({ optionColumns: 3, optionCellWidth: 120 });
      open(cmd);
      expect(menu()!.style.getPropertyValue("--ribbon-menu-cell-width")).toBe("120px");
      expect(menu()!.style.getPropertyValue("--ribbon-menu-columns")).toBe("3");
      expect(menu()!.classList.contains("ribbon-dropdown-menu-text")).toBe(true);
    });

    it("only tooltips options that show a compact glyph instead of their label", () => {
      open(command({ optionColumns: 3, optionCellWidth: 120 }));
      expect(items()[0].title).toBe("");
      expect(items()[0].textContent!.trim()).toBe("UPPERCASE");
    });

    it("accounts for a wide cell width when keeping the menu inside the window", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 1000, bottom: 10 } as DOMRect);
      open(command({ optionColumns: 3, optionCellWidth: 120 }));
      // 3 * (120 + 4) + 16 = 388; 1024 - 388 - 8
      expect(menu()!.style.left).toBe("628px");
    });

    it("leaves single-column menus unstyled by the grid", () => {
      open(command());
      expect(menu()!.classList.contains("ribbon-dropdown-menu-grid")).toBe(false);
      expect(items()[0].title).toBe("");
    });
  });
});
