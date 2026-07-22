import type { EditorLike } from "./types";
import { insertAtCursor, wrapSelection } from "./helpers";
import { buildTableText } from "./tableText";

export const insertLink = (editor: EditorLike): void => wrapSelection(editor, "[", "](url)", "link text");

export function insertImage(editor: EditorLike): void {
  insertAtCursor(editor, "![alt text](url)");
}

export function insertTableGrid(editor: EditorLike, columns: number, rows: number): void {
  const cursor = editor.getCursor("from");
  editor.replaceSelection(buildTableText(columns, rows));
  editor.setSelection({ line: cursor.line, ch: cursor.ch + 1 }, { line: cursor.line, ch: cursor.ch + 2 });
}

export function insertHorizontalRule(editor: EditorLike): void {
  insertAtCursor(editor, "\n---\n");
}

export function insertCodeBlock(editor: EditorLike): void {
  const cursor = editor.getCursor();
  if (editor.somethingSelected()) {
    const selected = editor.getSelection();
    editor.replaceSelection(`\`\`\`\n${selected}\n\`\`\``);
    return;
  }
  editor.replaceSelection("```\ncode\n```");
  editor.setSelection({ line: cursor.line + 1, ch: 0 }, { line: cursor.line + 1, ch: 4 });
}

export const insertTag = (editor: EditorLike): void => wrapSelection(editor, "#", "", "tag");
