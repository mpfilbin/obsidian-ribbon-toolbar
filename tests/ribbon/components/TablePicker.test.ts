// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import TablePicker from "../../../src/ribbon/components/TablePicker.svelte";
import type { CommandEntry } from "../../../src/ribbon/commands/registry";
import { createMockEditor } from "../../support/mockEditor";
import { click, render, unmountAll } from "../../support/svelte";
import { flushSync } from "svelte";

function command(grid = vi.fn()): CommandEntry {
  return { id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", grid };
}

const menu = () => document.body.querySelector<HTMLElement>(".ribbon-table-picker-menu");
const cells = () => [...document.body.querySelectorAll<HTMLButtonElement>(".ribbon-table-picker-cell")];
const label = () => document.body.querySelector(".ribbon-table-picker-label")!.textContent!.trim();

function open(cmd: CommandEntry, editor = createMockEditor("")) {
  const target = render(TablePicker, { command: cmd, editor });
  click(target.querySelector("button.ribbon-button")!);
  return { target, editor };
}

function hoverCell(cell: HTMLElement) {
  cell.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
  flushSync();
}

describe("TablePicker", () => {
  it("is closed by default and disabled without an editor", () => {
    const target = render(TablePicker, { command: command(), editor: null });
    expect(menu()).toBeNull();
    expect(target.querySelector<HTMLButtonElement>("button.ribbon-button")!.disabled).toBe(true);
    expect(target.querySelector(".ribbon-button-label")!.textContent).toBe("Table ▾");
  });

  it("opens an 8-row by 10-column size grid portaled to <body>", () => {
    const { target } = open(command());
    expect(cells()).toHaveLength(80);
    expect(target.contains(menu())).toBe(false);
    expect(label()).toBe("Select table size");
  });

  it("labels each cell as rows × columns", () => {
    open(command());
    expect(cells()[0].getAttribute("aria-label")).toBe("1 × 1 table");
    // Row-major: second row, third column.
    expect(cells()[10 + 2].getAttribute("aria-label")).toBe("2 × 3 table");
  });

  it("highlights the rectangle from the corner to the hovered cell and reports its size", () => {
    open(command());
    hoverCell(cells()[10 * 2 + 3]); // row 3, column 4
    expect(label()).toBe("3 × 4 Table");
    const active = cells().filter((c) => c.classList.contains("active"));
    expect(active).toHaveLength(12);
    expect(cells()[0].classList.contains("active")).toBe(true);
    expect(cells()[10 * 3].classList.contains("active")).toBe(false);
  });

  it("inserts a table of the clicked size (columns, rows), refocuses the editor and closes", () => {
    const grid = vi.fn();
    const editor = createMockEditor("");
    const focus = vi.spyOn(editor, "focus");
    open(command(grid), editor);
    click(cells()[10 * 1 + 4]); // row 2, column 5
    expect(grid).toHaveBeenCalledWith(editor, 5, 2);
    expect(focus).toHaveBeenCalled();
    expect(menu()).toBeNull();
  });

  it("closes on an outside click but stays open for clicks inside the menu", () => {
    open(command());
    click(menu()!);
    expect(menu()).not.toBeNull();
    click(document.body);
    expect(menu()).toBeNull();
  });

  it("resets the hover highlight each time it reopens", () => {
    const { target } = open(command());
    hoverCell(cells()[5]);
    click(target.querySelector("button.ribbon-button")!); // close
    click(target.querySelector("button.ribbon-button")!); // reopen
    expect(label()).toBe("Select table size");
  });

  it("removes the portaled menu when unmounted", () => {
    open(command());
    unmountAll();
    expect(menu()).toBeNull();
  });
});
