import type { EditorLike } from "./types";

export interface TableBlock {
  start: number;
  end: number;
  align: string[];
}

export function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed);
}

export function findTableBlockEnd(lines: string[], start: number): number {
  let end = start + 2;
  while (end < lines.length && lines[end].trim() !== "" && lines[end].includes("|")) {
    end++;
  }
  return end;
}

export function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

export function parseAlignment(separatorLine: string): string[] {
  return splitTableRow(separatorLine).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "c";
    if (right) return "r";
    if (left) return "l";
    return "";
  });
}

export function findEnclosingTable(editor: EditorLike, line: number): TableBlock | null {
  const lines: string[] = [];
  for (let i = 0; i <= editor.lastLine(); i++) lines.push(editor.getLine(i));

  for (let start = 0; start <= line; start++) {
    if (!lines[start].includes("|")) continue;
    if (start + 1 >= lines.length || !isSeparatorRow(lines[start + 1])) continue;
    const end = findTableBlockEnd(lines, start);
    if (line >= start && line < end) {
      return { start, end, align: parseAlignment(lines[start + 1]) };
    }
  }
  return null;
}
