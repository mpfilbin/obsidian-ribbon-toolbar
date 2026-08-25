import type { EditorLike } from "./types";
import { formatMarkdown } from "./formatMarkdown";
import { buildHeadingLinkText } from "./headingLinkText";

const HEADING_PATTERN = /^(#{1,6}) /;

export function promoteHeading(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const match = line.match(HEADING_PATTERN);
  if (!match) return;
  const level = match[1].length;
  if (level <= 1) return;
  editor.setLine(cursor.line, line.replace(HEADING_PATTERN, `${"#".repeat(level - 1)} `));
}

export function demoteHeading(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const match = line.match(HEADING_PATTERN);
  if (!match) return;
  const level = match[1].length;
  if (level >= 6) return;
  editor.setLine(cursor.line, line.replace(HEADING_PATTERN, `${"#".repeat(level + 1)} `));
}

// Widths checked largest-first: a line already indented 4 spaces is treated
// as one 4-space level rather than two 2-space levels, matching Obsidian's
// historical default tab size. Ambiguous without knowing the vault's actual
// tab settings (not exposed by Obsidian's public API), but this keeps
// indent/outdent as inverses of each other for both common conventions.
const SPACE_INDENT_WIDTHS = [4, 2];

/**
 * The indent unit to use for this line: a tab if the line already starts
 * with one, the matching space-run if it starts with a recognized
 * space-indent width, or a tab as the default for an unindented line.
 */
function detectIndentUnit(line: string): string {
  if (line.startsWith("\t")) return "\t";
  for (const width of SPACE_INDENT_WIDTHS) {
    if (line.startsWith(" ".repeat(width))) return " ".repeat(width);
  }
  return "\t";
}

export function indentList(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const unit = detectIndentUnit(line);
  editor.setLine(cursor.line, `${unit}${line}`);
  editor.setCursor({ line: cursor.line, ch: cursor.ch + unit.length });
}

export function outdentList(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  if (line.startsWith("\t")) {
    editor.setLine(cursor.line, line.slice(1));
    editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - 1) });
    return;
  }
  for (const width of SPACE_INDENT_WIDTHS) {
    if (line.startsWith(" ".repeat(width))) {
      editor.setLine(cursor.line, line.slice(width));
      editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - width) });
      return;
    }
  }
}

export function moveLineUp(editor: EditorLike): void {
  const cursor = editor.getCursor();
  if (cursor.line === 0) return;
  const current = editor.getLine(cursor.line);
  const above = editor.getLine(cursor.line - 1);
  editor.setLine(cursor.line - 1, current);
  editor.setLine(cursor.line, above);
  editor.setCursor({ line: cursor.line - 1, ch: cursor.ch });
}

export function moveLineDown(editor: EditorLike): void {
  const cursor = editor.getCursor();
  if (cursor.line >= editor.lastLine()) return;
  const current = editor.getLine(cursor.line);
  const below = editor.getLine(cursor.line + 1);
  editor.setLine(cursor.line + 1, current);
  editor.setLine(cursor.line, below);
  editor.setCursor({ line: cursor.line + 1, ch: cursor.ch });
}

export function insertTableOfContents(editor: EditorLike): void {
  const entries: string[] = [];
  for (let line = 0; line <= editor.lastLine(); line++) {
    const match = editor.getLine(line).match(HEADING_PATTERN);
    if (!match) continue;
    const level = match[1].length;
    const text = editor.getLine(line).slice(match[0].length);
    entries.push(`${"  ".repeat(level - 1)}- ${buildHeadingLinkText(text, null)}`);
  }
  const toc = entries.length > 0 ? entries.join("\n") : "- (no headings found)";
  editor.replaceSelection(`${toc}\n`);
}

export function formatDocument(editor: EditorLike): void {
  const lines: string[] = [];
  for (let line = 0; line <= editor.lastLine(); line++) {
    lines.push(editor.getLine(line));
  }
  const original = lines.join("\n");
  const formatted = formatMarkdown(original);
  if (formatted === original) return;

  const cursor = editor.getCursor();
  const lastLine = editor.lastLine();
  editor.replaceRange(formatted, { line: 0, ch: 0 }, { line: lastLine, ch: editor.getLine(lastLine).length });

  const newLines = formatted.split("\n");
  const clampedLine = Math.min(cursor.line, newLines.length - 1);
  const clampedCh = Math.min(cursor.ch, newLines[clampedLine].length);
  editor.setCursor({ line: clampedLine, ch: clampedCh });
}
