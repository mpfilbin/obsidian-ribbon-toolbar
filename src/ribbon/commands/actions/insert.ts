import type { EditorLike } from "./types";
import { insertAtCursor, wrapSelection } from "./helpers";

export const insertLink = (editor: EditorLike): void => wrapSelection(editor, "[", "](url)", "link text");
export const insertInternalLink = (editor: EditorLike): void => wrapSelection(editor, "[[", "]]", "note name");

export function insertImage(editor: EditorLike): void {
  insertAtCursor(editor, "![alt text](url)");
}

export function insertTable(editor: EditorLike): void {
  insertAtCursor(editor, "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n");
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
