import type { EditorLike } from "./types";
import { insertAtCursor, wrapSelection } from "./helpers";
import { buildMatrixText } from "./latexText";

export const toggleInlineMath = (editor: EditorLike): void => wrapSelection(editor, "$", "$", "x");
export const toggleBlockMath = (editor: EditorLike): void => wrapSelection(editor, "$$\n", "\n$$", "x");
export const toggleLatexSuperscript = (editor: EditorLike): void => wrapSelection(editor, "^{", "}", "n");
export const toggleLatexSubscript = (editor: EditorLike): void => wrapSelection(editor, "_{", "}", "i");
export const insertSquareRoot = (editor: EditorLike): void => wrapSelection(editor, "\\sqrt{", "}", "x");

export function insertFraction(editor: EditorLike): void {
  if (editor.somethingSelected()) {
    const selected = editor.getSelection();
    const from = editor.getCursor("from");
    const before = `\\frac{${selected}}{`;
    editor.replaceSelection(`${before}}`);
    editor.setCursor({ line: from.line, ch: from.ch + before.length });
    return;
  }

  const cursor = editor.getCursor();
  editor.replaceSelection("\\frac{}{}");
  editor.setCursor({ line: cursor.line, ch: cursor.ch + "\\frac{".length });
}

export const insertSummation = (editor: EditorLike): void => insertAtCursor(editor, "\\sum_{i=1}^{n} ");
export const insertIntegral = (editor: EditorLike): void => insertAtCursor(editor, "\\int_{a}^{b} ");
export const insertLimit = (editor: EditorLike): void => insertAtCursor(editor, "\\lim_{x \\to 0} ");

export function insertCases(editor: EditorLike): void {
  const cursor = editor.getCursor();
  editor.replaceSelection(
    "\\begin{cases}\n  a & \\text{if } x > 0 \\\\\n  b & \\text{otherwise}\n\\end{cases}"
  );
  editor.setSelection({ line: cursor.line + 1, ch: 2 }, { line: cursor.line + 1, ch: 3 });
}

export function insertAlign(editor: EditorLike): void {
  const cursor = editor.getCursor();
  editor.replaceSelection("\\begin{align}\n  x &= y \\\\\n  z &= w\n\\end{align}");
  editor.setSelection({ line: cursor.line + 1, ch: 2 }, { line: cursor.line + 1, ch: 3 });
}

export function insertMatrixGrid(editor: EditorLike, columns: number, rows: number): void {
  const cursor = editor.getCursor("from");
  editor.replaceSelection(buildMatrixText(columns, rows));
  editor.setSelection({ line: cursor.line + 1, ch: 2 }, { line: cursor.line + 1, ch: 3 });
}

export function insertLatexSymbol(command: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void => insertAtCursor(editor, `${command} `);
}
