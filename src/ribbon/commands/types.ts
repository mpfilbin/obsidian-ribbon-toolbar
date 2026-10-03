import type { App } from "obsidian";
import type { EditorLike } from "./actions/types";

export type TabId = "home" | "insert" | "layout" | "references" | "latex";

export interface CommandOption {
  id: string;
  label: string;
  // Compact text shown in place of the label when the menu is a grid; the
  // label is then only the tooltip.
  display?: string;
  action: (editor: EditorLike) => void;
}

export interface CommandEntry {
  id: string;
  tab: TabId;
  group: string;
  icon: string;
  label: string;
  action?: (editor: EditorLike) => void;
  options?: CommandOption[];
  // When set, the dropdown lays its options out in this many columns.
  optionColumns?: number;
  // Width in px of each grid cell. Omit for the narrow glyph cells used by the
  // Symbols menu; set it for grids of text labels.
  optionCellWidth?: number;
  modal?: (editor: EditorLike, app: App) => void;
  grid?: (editor: EditorLike, columns: number, rows: number) => void;
  compact?: boolean;
}
