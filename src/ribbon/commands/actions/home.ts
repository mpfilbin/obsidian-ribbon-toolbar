import type { EditorLike } from "./types";
import { togglePrefix, wrapSelection } from "./helpers";

export const toggleBold = (editor: EditorLike): void => wrapSelection(editor, "**", "**", "bold text");
export const toggleItalic = (editor: EditorLike): void => wrapSelection(editor, "*", "*", "italic text");
export const toggleStrikethrough = (editor: EditorLike): void =>
  wrapSelection(editor, "~~", "~~", "strikethrough text");
export const toggleHighlight = (editor: EditorLike): void => wrapSelection(editor, "==", "==", "highlighted text");
export const toggleInlineCode = (editor: EditorLike): void => wrapSelection(editor, "`", "`", "code");

export function setHeading(level: 1 | 2 | 3): (editor: EditorLike) => void {
  return (editor: EditorLike): void => {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const stripped = line.replace(/^#{1,6} /, "");
    editor.setLine(cursor.line, `${"#".repeat(level)} ${stripped}`);
    editor.setCursor({ line: cursor.line, ch: level + 1 + stripped.length });
  };
}

export const toggleBulletList = (editor: EditorLike): void => togglePrefix(editor, "- ");
export const toggleNumberedList = (editor: EditorLike): void => togglePrefix(editor, "1. ");
export const toggleChecklist = (editor: EditorLike): void => togglePrefix(editor, "- [ ] ");
export const toggleBlockquote = (editor: EditorLike): void => togglePrefix(editor, "> ");

const FORMATTING_MARKERS = [/\*\*(.*?)\*\*/g, /\*(.*?)\*/g, /~~(.*?)~~/g, /==(.*?)==/g, /`(.*?)`/g];

export function clearFormatting(editor: EditorLike): void {
  if (!editor.somethingSelected()) return;
  let text = editor.getSelection();
  for (const pattern of FORMATTING_MARKERS) {
    text = text.replace(pattern, "$1");
  }
  editor.replaceSelection(text);
}
