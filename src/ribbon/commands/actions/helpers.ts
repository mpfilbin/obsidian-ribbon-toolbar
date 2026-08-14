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
 * Toggles a bullet/numbered/checklist marker on the current line. Unlike
 * togglePrefix, this recognizes the other two list marker kinds (including
 * numbered markers with any digit count) and replaces them instead of
 * stacking a second marker in front.
 */
export function toggleListPrefix(editor: EditorLike, kind: ListMarkerKind, prefix: string): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const existing = detectListMarker(line);

  if (existing && existing.kind === kind) {
    editor.setLine(cursor.line, line.slice(existing.length));
    editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - existing.length) });
    return;
  }

  const rest = existing ? line.slice(existing.length) : line;
  editor.setLine(cursor.line, `${prefix}${rest}`);
  const removedLength = existing ? existing.length : 0;
  editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - removedLength + prefix.length) });
}

export function insertAtCursor(editor: EditorLike, text: string): void {
  editor.replaceSelection(text);
}
