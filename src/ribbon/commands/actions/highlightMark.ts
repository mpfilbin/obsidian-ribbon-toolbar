import type { EditorLike } from "./types";
import { wrapSelection } from "./helpers";

export interface HighlightColorConfig {
  name: string;
  color: string;
}

export function highlightWithColor(color: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void =>
    wrapSelection(editor, `<mark style="background-color: ${color};">`, "</mark>", "highlighted text");
}
