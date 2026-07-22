import { markdownTable } from "markdown-table";
import type { EditorLike } from "./types";
import { findEnclosingTable, splitTableRow } from "./tableParsing";

function readLines(editor: EditorLike): string[] {
  const lines: string[] = [];
  for (let i = 0; i <= editor.lastLine(); i++) lines.push(editor.getLine(i));
  return lines;
}

function rowsFromBlock(lines: string[], start: number, end: number): string[][] {
  const rows: string[][] = [splitTableRow(lines[start])];
  for (let i = start + 2; i < end; i++) rows.push(splitTableRow(lines[i]));
  return rows;
}

function replaceBlock(
  editor: EditorLike,
  start: number,
  end: number,
  lines: string[],
  rows: string[][],
  align: string[]
): string[] {
  const rendered = markdownTable(rows, { align }).split("\n");
  editor.replaceRange(rendered.join("\n"), { line: start, ch: 0 }, { line: end - 1, ch: lines[end - 1].length });
  return rendered;
}

export function insertRowAbove(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const block = findEnclosingTable(editor, cursor.line);
  if (!block) return;
  const { start, end, align } = block;
  const dataRowStart = start + 2;
  if (cursor.line < dataRowStart) return;

  const lines = readLines(editor);
  const rows = rowsFromBlock(lines, start, end);
  const columns = rows[0].length;
  const dataIndex = cursor.line - dataRowStart;
  rows.splice(dataIndex + 1, 0, new Array(columns).fill(""));

  replaceBlock(editor, start, end, lines, rows, align);
  editor.setCursor({ line: cursor.line, ch: 2 });
}

export function insertRowBelow(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const block = findEnclosingTable(editor, cursor.line);
  if (!block) return;
  const { start, end, align } = block;
  const dataRowStart = start + 2;

  const lines = readLines(editor);
  const rows = rowsFromBlock(lines, start, end);
  const columns = rows[0].length;
  const insertAt = cursor.line < dataRowStart ? 1 : cursor.line - dataRowStart + 2;
  rows.splice(insertAt, 0, new Array(columns).fill(""));

  replaceBlock(editor, start, end, lines, rows, align);
  editor.setCursor({ line: start + insertAt + 1, ch: 2 });
}
