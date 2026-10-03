import type { App } from "obsidian";
import type { EditorLike } from "./actions/types";
import type { CommandEntry } from "./types";
import { TABS } from "./registry";

export interface PaletteCommand {
  id: string;
  name: string;
  run(editor: EditorLike, app: App): void;
}

/**
 * Derives command-palette (and so hotkey-bindable) commands from the ribbon's
 * command definitions, so the two never drift apart.
 *
 * Included: plain buttons, modal-backed buttons, and the options of ordinary
 * dropdowns (e.g. "Highlight: Red", "Code Block: Python"). Left out:
 * size-picker grids (they need a size) and glyph-only menus such as Symbols,
 * whose dozens of one-character entries would crowd the palette.
 */
export function buildPaletteCommands(registry: CommandEntry[]): PaletteCommand[] {
  const tabLabels = new Map(TABS.map((tab) => [tab.id, tab.label]));
  const commands: PaletteCommand[] = [];

  for (const entry of registry) {
    const prefix = `${tabLabels.get(entry.tab) ?? entry.tab}: ${entry.label}`;

    if (entry.action) {
      const action = entry.action;
      commands.push({ id: entry.id, name: prefix, run: (editor) => action(editor) });
    } else if (entry.modal) {
      const modal = entry.modal;
      commands.push({ id: entry.id, name: prefix, run: (editor, app) => modal(editor, app) });
    } else if (entry.options && !entry.options.some((option) => option.display)) {
      for (const option of entry.options) {
        const action = option.action;
        commands.push({
          id: `${entry.id}:${option.id}`,
          name: `${prefix}: ${option.label.trim()}`,
          run: (editor, app) => action(editor, app),
        });
      }
    }
  }
  return commands;
}
