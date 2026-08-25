import type { EditorLike } from "./types";
import { wrapSelection } from "./helpers";

export interface HighlightColorConfig {
  name: string;
  color: string;
}

export function buildMarkStyle(color: string): string {
  return `background-color: ${color}; border-radius: 0.2em; padding: 0.1em 0.2em;`;
}

export function highlightWithColor(color: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void =>
    wrapSelection(editor, `<mark style="${buildMarkStyle(color)}">`, "</mark>", "highlighted text");
}
