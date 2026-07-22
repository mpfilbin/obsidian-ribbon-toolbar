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

function columnAt(line: string, ch: number, columns: number): number {
  let pipesBeforeCh = 0;
  for (let i = 0; i < ch && i < line.length; i++) {
    if (line[i] === "|") pipesBeforeCh++;
  }
  const column = line.startsWith("|") ? pipesBeforeCh - 1 : pipesBeforeCh;
  return Math.min(Math.max(column, 0), columns - 1);
}

function cellStartCh(line: string, column: number): number {
  let pipesSeen = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "|") {
      pipesSeen++;
      if (pipesSeen === column + 1) return i + 1;
    }
  }
  return line.length;
}

function insertColumn(editor: EditorLike, offset: 0 | 1): void {
  const cursor = editor.getCursor();
  const block = findEnclosingTable(editor, cursor.line);
  if (!block) return;
  const { start, end, align } = block;

  const lines = readLines(editor);
  const rows = rowsFromBlock(lines, start, end);
  const columns = rows[0].length;
  const col = columnAt(lines[cursor.line], cursor.ch, columns) + offset;

  for (const row of rows) row.splice(col, 0, "");
  const newAlign = [...align];
  newAlign.splice(col, 0, "");

  const rendered = replaceBlock(editor, start, end, lines, rows, newAlign);
  const rowOffset = cursor.line - start;
  editor.setCursor({ line: cursor.line, ch: cellStartCh(rendered[rowOffset], col) });
}

export function insertColumnLeft(editor: EditorLike): void {
  insertColumn(editor, 0);
}

export function insertColumnRight(editor: EditorLike): void {
  insertColumn(editor, 1);
}

export function deleteRow(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const block = findEnclosingTable(editor, cursor.line);
  if (!block) return;
  const { start, end, align } = block;
  if (cursor.line === start + 1) return;

  const lines = readLines(editor);
  const rows = rowsFromBlock(lines, start, end);
  const dataRowCount = rows.length - 1;
  if (dataRowCount < 2) return;

  if (cursor.line === start) {
    rows.shift();
    replaceBlock(editor, start, end, lines, rows, align);
    editor.setCursor({ line: start, ch: 0 });
    return;
  }

  const dataIndex = cursor.line - (start + 2);
  rows.splice(dataIndex + 1, 1);
  replaceBlock(editor, start, end, lines, rows, align);

  const newDataRowCount = rows.length - 1;
  const targetDataIndex = Math.min(dataIndex, newDataRowCount - 1);
  editor.setCursor({ line: start + 2 + targetDataIndex, ch: 0 });
}
