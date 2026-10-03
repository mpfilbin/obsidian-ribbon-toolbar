import type { EditorLike } from "./types";
import { insertAtCursor, wrapSelection } from "./helpers";
import { buildTableText } from "./tableText";

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

export function insertCodeBlock(editor: EditorLike, language = ""): void {
  const fence = `\`\`\`${language}`;
  const cursor = editor.getCursor();
  if (editor.somethingSelected()) {
    const selected = editor.getSelection();
    editor.replaceSelection(`${fence}\n${selected}\n\`\`\``);
    return;
  }
  editor.replaceSelection(`${fence}\ncode\n\`\`\``);
  editor.setSelection({ line: cursor.line + 1, ch: 0 }, { line: cursor.line + 1, ch: 4 });
}

/** A code block whose opening fence names `language` (e.g. "typescript"). */
export function insertCodeBlockWithLanguage(language: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void => insertCodeBlock(editor, language);
}

export const insertTag = (editor: EditorLike): void => wrapSelection(editor, "#", "", "tag");

export function insertSymbol(symbol: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void => insertAtCursor(editor, symbol);
}
