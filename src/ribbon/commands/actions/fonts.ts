import type { EditorLike } from "./types";
import { wrapSelection } from "./helpers";

export interface FontOption {
  id: string;
  name: string;
  // CSS font-family value, including fallbacks, used both for the <span>
  // wrapped around the selection and to preview the name in its own face.
  family: string;
}

// Fonts widely available across Windows/macOS/Linux without needing a web
// font to be loaded, so the preview and the rendered note look the same
// regardless of the reader's system.
export const FONT_OPTIONS: FontOption[] = [
  { id: "arial", name: "Arial", family: "Arial, Helvetica, sans-serif" },
  { id: "helvetica", name: "Helvetica", family: "Helvetica, Arial, sans-serif" },
  { id: "verdana", name: "Verdana", family: "Verdana, Geneva, sans-serif" },
  { id: "tahoma", name: "Tahoma", family: "Tahoma, Geneva, sans-serif" },
  { id: "trebuchet-ms", name: "Trebuchet MS", family: "'Trebuchet MS', sans-serif" },
  { id: "georgia", name: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  { id: "times-new-roman", name: "Times New Roman", family: "'Times New Roman', Times, serif" },
  { id: "garamond", name: "Garamond", family: "Garamond, serif" },
  { id: "courier-new", name: "Courier New", family: "'Courier New', Courier, monospace" },
  { id: "consolas", name: "Consolas", family: "Consolas, 'Courier New', monospace" },
  { id: "comic-sans-ms", name: "Comic Sans MS", family: "'Comic Sans MS', cursive, sans-serif" },
  { id: "impact", name: "Impact", family: "Impact, 'Arial Narrow', sans-serif" },
];

export function applyFont(family: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void =>
    wrapSelection(editor, `<span style="font-family: ${family};">`, "</span>", "text");
}
