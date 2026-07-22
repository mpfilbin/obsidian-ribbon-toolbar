import { markdownTable } from "markdown-table";

export function stripHeadingTrailingHashes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^(#{1,6})(\s+)(.*)$/);
      if (!match) return line;
      const [, hashes, sp, rest] = match;
      const stripped = rest.replace(/\s+#+\s*$/, "");
      return `${hashes}${sp}${stripped}`;
    })
    .join("\n");
}

export function normalizeBulletMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^(\s*)[*+](\s+)/, "$1-$2"))
    .join("\n");
}

export function trimTrailingWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/[ \t]*$/);
      const trailing = match ? match[0] : "";
      if (trailing === "  ") return line;
      return line.slice(0, line.length - trailing.length);
    })
    .join("\n");
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed);
}

function findTableBlockEnd(lines: string[], start: number): number {
  let end = start + 2;
  while (end < lines.length && lines[end].trim() !== "" && lines[end].includes("|")) {
    end++;
  }
  return end;
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseAlignment(separatorLine: string): string[] {
  return splitTableRow(separatorLine).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "c";
    if (right) return "r";
    if (left) return "l";
    return "";
  });
}

export function alignTables(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const end = findTableBlockEnd(lines, i);
      const align = parseAlignment(lines[i + 1]);
      const rows = [splitTableRow(line)];
      for (let k = i + 2; k < end; k++) rows.push(splitTableRow(lines[k]));
      const rendered = markdownTable(rows, { align });
      result.push(...rendered.split("\n"));
      i = end;
      continue;
    }
    result.push(line);
    i++;
  }
  return result.join("\n");
}
