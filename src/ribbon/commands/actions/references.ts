import type { EditorLike } from "./types";

const FOOTNOTE_PATTERN = /\[\^(\d+)\]/g;

export function insertFootnote(editor: EditorLike): void {
  let maxIndex = 0;
  for (let line = 0; line <= editor.lastLine(); line++) {
    const matches = editor.getLine(line).matchAll(FOOTNOTE_PATTERN);
    for (const match of matches) {
      maxIndex = Math.max(maxIndex, Number(match[1]));
    }
  }
  const nextIndex = maxIndex + 1;

  const cursor = editor.getCursor();
  editor.replaceRange(`[^${nextIndex}]`, cursor);

  const endLine = editor.lastLine();
  const endCh = editor.getLine(endLine).length;
  editor.replaceRange(`\n\n[^${nextIndex}]: `, { line: endLine, ch: endCh });
}
