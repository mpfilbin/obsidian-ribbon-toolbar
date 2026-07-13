import type { EditorLike } from "./types";

export function wrapSelection(
  editor: EditorLike,
  before: string,
  after: string = before,
  placeholder: string = ""
): void {
  if (editor.somethingSelected()) {
    const selected = editor.getSelection();
    editor.replaceSelection(`${before}${selected}${after}`);
    return;
  }

  const cursor = editor.getCursor();
  editor.replaceSelection(`${before}${placeholder}${after}`);
  editor.setSelection(
    { line: cursor.line, ch: cursor.ch + before.length },
    { line: cursor.line, ch: cursor.ch + before.length + placeholder.length }
  );
}

export function togglePrefix(editor: EditorLike, prefix: string): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);

  if (line.startsWith(prefix)) {
    editor.setLine(cursor.line, line.slice(prefix.length));
    editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - prefix.length) });
  } else {
    editor.setLine(cursor.line, `${prefix}${line}`);
    editor.setCursor({ line: cursor.line, ch: cursor.ch + prefix.length });
  }
}

export function insertAtCursor(editor: EditorLike, text: string): void {
  editor.replaceSelection(text);
}
