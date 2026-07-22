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
