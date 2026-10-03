import type { EditorLike } from "../commands/actions/types";
import { splitTemplate, type BaseFunction } from "./functions";

/**
 * Inserts a function call at the cursor, leaving the cursor where an argument
 * goes. Method-style templates (".contains(…)") attach to the end of the
 * current selection, so selecting `tags` and choosing contains gives
 * `tags.contains(…)`; everything else replaces the selection.
 */
export function insertFunction(fn: BaseFunction): (editor: EditorLike) => void {
  return (editor: EditorLike): void => {
    const { before, after } = splitTemplate(fn.template);
    const isMethod = fn.template.startsWith(".");

    if (isMethod && editor.somethingSelected()) {
      editor.setCursor(editor.getCursor("to"));
    }
    const at = editor.getCursor("from");
    editor.replaceSelection(before + after);
    editor.setCursor({ line: at.line, ch: at.ch + before.length });
  };
}

/** Inserts the same text at a caret position in a plain text field. */
export function insertIntoText(text: string, selectionStart: number, selectionEnd: number, fn: BaseFunction): { text: string; caret: number } {
  const { before, after } = splitTemplate(fn.template);
  const isMethod = fn.template.startsWith(".");
  const start = isMethod && selectionEnd > selectionStart ? selectionEnd : selectionStart;
  const end = isMethod ? start : selectionEnd;
  return {
    text: text.slice(0, start) + before + after + text.slice(end),
    caret: start + before.length,
  };
}
