import type { EditorLike } from "./types";
import { wrapSelection } from "./helpers";

export interface HighlightColor {
  id: string;
  name: string;
  // The Obsidian 1.14 native color-highlight prefix emoji, or "" for a plain
  // uncolored highlight. Placed immediately after the opening "==" - Obsidian
  // hides it in reading view and shows it only while editing.
  emoji: string;
}

// The fixed set Obsidian's native color highlights recognize (1.14+). This is
// deliberately not user-configurable: Obsidian only tints these emoji, so
// an arbitrary palette has nothing to map to.
export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { id: "default", name: "Default", emoji: "" },
  { id: "red", name: "Red", emoji: "🔴" },
  { id: "orange", name: "Orange", emoji: "🟠" },
  { id: "yellow", name: "Yellow", emoji: "🟡" },
  { id: "green", name: "Green", emoji: "🟢" },
  { id: "blue", name: "Blue", emoji: "🔵" },
  { id: "purple", name: "Purple", emoji: "🟣" },
];

export function highlightWithColor(emoji: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void =>
    wrapSelection(editor, `==${emoji}`, "==", "highlighted text");
}
