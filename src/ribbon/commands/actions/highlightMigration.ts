import { computeFenceLineKinds } from "./formatMarkdown";

const HIGHLIGHT_PATTERN = /==(.*?)==/g;

export function countHighlights(text: string): number {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (fenceKinds[i]) continue;
    const matches = lines[i].match(HIGHLIGHT_PATTERN);
    if (matches) count += matches.length;
  }
  return count;
}

export function migrateHighlightsInText(text: string, color: string): string {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  return lines
    .map((line, i) => {
      if (fenceKinds[i]) return line;
      return line.replace(
        HIGHLIGHT_PATTERN,
        (_match, content: string) => `<mark style="background-color: ${color};">${content}</mark>`
      );
    })
    .join("\n");
}
