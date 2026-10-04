import { describe, expect, it, vi } from "vitest";
import { buildPaletteCommands } from "../../../src/ribbon/commands/paletteCommands";
import { COMMAND_REGISTRY } from "../../../src/ribbon/commands/registry";
import type { CommandEntry } from "../../../src/ribbon/commands/types";
import { createMockEditor } from "../../support/mockEditor";

const entry = (overrides: Partial<CommandEntry>): CommandEntry => ({
  id: "c",
  tab: "home",
  group: "G",
  icon: "bold",
  label: "Bold",
  ...overrides,
});

describe("buildPaletteCommands", () => {
  it("names commands after their tab so identical labels stay distinguishable", () => {
    const action = vi.fn();
    const commands = buildPaletteCommands([
      entry({ id: "a", tab: "home", label: "Superscript", action }),
      entry({ id: "b", tab: "latex", label: "Superscript", action }),
    ]);
    expect(commands.map((c) => c.name)).toEqual(["Home: Superscript", "LaTeX: Superscript"]);
  });

  it("runs a plain command's action against the editor", () => {
    const action = vi.fn();
    const [command] = buildPaletteCommands([entry({ action })]);
    const editor = createMockEditor("");
    command.run(editor, {} as never);
    expect(action).toHaveBeenCalledWith(editor);
  });

  it("opens a modal command's modal with the editor and app", () => {
    const modal = vi.fn();
    const [command] = buildPaletteCommands([entry({ modal })]);
    const editor = createMockEditor("");
    const app = {} as never;
    command.run(editor, app);
    expect(modal).toHaveBeenCalledWith(editor, app);
  });

  it("expands an ordinary dropdown into one command per option", () => {
    const red = vi.fn();
    const commands = buildPaletteCommands([
      entry({
        id: "highlight",
        label: "Highlight",
        options: [
          { id: "red", label: "🔴  Red", action: red },
          { id: "plain", label: "Default", action: vi.fn() },
        ],
      }),
    ]);
    expect(commands.map((c) => [c.id, c.name])).toEqual([
      ["highlight:red", "Home: Highlight: 🔴  Red"],
      ["highlight:plain", "Home: Highlight: Default"],
    ]);
    const editor = createMockEditor("");
    const app = {} as never;
    commands[0].run(editor, app);
    expect(red).toHaveBeenCalledWith(editor, app);
  });

  it("skips size-picker grids and glyph-only option menus", () => {
    const commands = buildPaletteCommands([
      entry({ id: "table", grid: vi.fn() }),
      entry({ id: "symbols", optionColumns: 8, options: [{ id: "x", label: "X  Mark", display: "X", action: vi.fn() }] }),
    ]);
    expect(commands).toEqual([]);
  });

  it("includes grid-layout menus whose cells are text labels", () => {
    const commands = buildPaletteCommands([
      entry({ id: "code", label: "Code Block", optionColumns: 3, optionCellWidth: 120, options: [{ id: "py", label: "Python", action: vi.fn() }] }),
    ]);
    expect(commands.map((c) => c.name)).toEqual(["Home: Code Block: Python"]);
  });

  describe("for the real registry", () => {
    const commands = buildPaletteCommands(COMMAND_REGISTRY);

    it("produces unique ids and names (Obsidian requires unique command ids)", () => {
      const ids = commands.map((c) => c.id);
      const names = commands.map((c) => c.name);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(names).size).toBe(names.length);
    });

    it("includes the everyday commands and leaves out the symbol picker", () => {
      const names = commands.map((c) => c.name);
      expect(names).toContain("Home: Bold");
      expect(names).toContain("Insert: Delete Row");
      expect(names).toContain("Home: Highlight: 🔴  Red");
      expect(names.some((n) => n.includes("Symbols"))).toBe(false);
      expect(names).not.toContain("Insert: Table");
      expect(names).toContain("Insert: Code Block: Python");
    });

    it("runs a real command end to end", () => {
      const bold = commands.find((c) => c.id === "bold")!;
      const editor = createMockEditor("word");
      editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 4 });
      bold.run(editor, {} as never);
      expect(editor.getValue()).toBe("**word**");
    });
  });
});

describe("Add Property in the palette", () => {
  it("is available for hotkeys, as a dialog command", () => {
    const names = buildPaletteCommands(COMMAND_REGISTRY).map((c) => c.name);
    expect(names).toContain("References: Add Property");
  });
});
