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

export type ListMarkerKind = "bullet" | "numbered" | "checklist";

const LIST_MARKER_PATTERNS: { kind: ListMarkerKind; pattern: RegExp }[] = [
  { kind: "checklist", pattern: /^- \[[ xX]\] / },
  { kind: "numbered", pattern: /^\d+\. / },
  { kind: "bullet", pattern: /^- / },
];

function detectListMarker(line: string): { kind: ListMarkerKind; length: number } | null {
  for (const { kind, pattern } of LIST_MARKER_PATTERNS) {
    const match = line.match(pattern);
    if (match) return { kind, length: match[0].length };
  }
  return null;
}

/**
 * Toggles a bullet/numbered/checklist marker on the current line, or on every
 * non-blank line touched by a multi-line selection. Unlike togglePrefix, this
 * recognizes the other two list marker kinds (including numbered markers with
 * any digit count) and replaces them instead of stacking a second marker in
 * front.
 *
 * For a multi-line selection, the lines are turned off together only when
 * every one of them already has this marker kind; otherwise they're all set
 * to this kind, so a mixed selection normalizes to the toggled-on kind rather
 * than leaving some lines in their old kind.
 */
export function toggleListPrefix(editor: EditorLike, kind: ListMarkerKind, prefix: string): void {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");

  if (from.line === to.line) {
    toggleListPrefixOnLine(editor, from.line, kind, prefix);
    return;
  }

  toggleListPrefixOnLines(editor, from.line, to.line, kind, prefix);
}

function toggleListPrefixOnLine(editor: EditorLike, lineNumber: number, kind: ListMarkerKind, prefix: string): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(lineNumber);
  const existing = detectListMarker(line);

  if (existing && existing.kind === kind) {
    editor.setLine(lineNumber, line.slice(existing.length));
    editor.setCursor({ line: lineNumber, ch: Math.max(0, cursor.ch - existing.length) });
    return;
  }

  const rest = existing ? line.slice(existing.length) : line;
  editor.setLine(lineNumber, `${prefix}${rest}`);
  const removedLength = existing ? existing.length : 0;
  const contentOffset = Math.max(0, cursor.ch - removedLength);
  editor.setCursor({ line: lineNumber, ch: prefix.length + contentOffset });
}

function toggleListPrefixOnLines(
  editor: EditorLike,
  startLine: number,
  endLine: number,
  kind: ListMarkerKind,
  prefix: string
): void {
  const targetLines: number[] = [];
  for (let line = startLine; line <= endLine; line++) {
    if (editor.getLine(line).trim() !== "") targetLines.push(line);
  }
  if (targetLines.length === 0) return;

  const allAlreadyThisKind = targetLines.every(
    (line) => detectListMarker(editor.getLine(line))?.kind === kind
  );

  for (const line of targetLines) {
    const text = editor.getLine(line);
    const existing = detectListMarker(text);
    if (allAlreadyThisKind) {
      if (existing) editor.setLine(line, text.slice(existing.length));
    } else {
      const rest = existing ? text.slice(existing.length) : text;
      editor.setLine(line, `${prefix}${rest}`);
    }
  }

  editor.setSelection({ line: startLine, ch: 0 }, { line: endLine, ch: editor.getLine(endLine).length });
}

export function insertAtCursor(editor: EditorLike, text: string): void {
  editor.replaceSelection(text);
}
