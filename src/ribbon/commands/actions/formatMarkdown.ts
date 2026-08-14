import { markdownTable } from "markdown-table";
import { isSeparatorRow, findTableBlockEnd, splitTableRow, parseAlignment } from "./tableParsing";

const FENCE_MARKER_PATTERN = /^\s*(`{3,}|~{3,})/;

type FenceLineKind = "fence" | "fence-content" | null;

/**
 * Classifies each line as a fence delimiter, fence content, or neither.
 * Per CommonMark, a fence only closes on a line using the same character
 * (backtick vs tilde) and at least as many of them as the opening fence, so
 * a shorter or differently-charactered marker nested inside (e.g. a ``` or
 * ~~~ block shown as an example inside a ```` fence) doesn't end it early.
 */
function computeFenceLineKinds(lines: string[]): FenceLineKind[] {
  const kinds: FenceLineKind[] = new Array(lines.length).fill(null);
  let openFence: { char: string; length: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(FENCE_MARKER_PATTERN)?.[1];

    if (!openFence) {
      if (marker) {
        openFence = { char: marker[0], length: marker.length };
        kinds[i] = "fence";
      }
      continue;
    }

    if (marker && marker[0] === openFence.char && marker.length >= openFence.length) {
      openFence = null;
      kinds[i] = "fence";
    } else {
      kinds[i] = "fence-content";
    }
  }

  return kinds;
}

/**
 * Applies a per-line transform everywhere except inside fenced code blocks
 * (including the fence delimiter lines themselves), so formatting passes
 * never rewrite code content.
 */
function mapLinesOutsideFences(text: string, transform: (line: string) => string): string {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  return lines.map((line, i) => (fenceKinds[i] ? line : transform(line))).join("\n");
}

export function stripHeadingTrailingHashes(text: string): string {
  return mapLinesOutsideFences(text, (line) => {
    const match = line.match(/^(#{1,6})(\s+)(.*)$/);
    if (!match) return line;
    const [, hashes, sp, rest] = match;
    const stripped = rest.replace(/\s+#+\s*$/, "");
    return `${hashes}${sp}${stripped}`;
  });
}

export function normalizeBulletMarkers(text: string): string {
  return mapLinesOutsideFences(text, (line) => line.replace(/^(\s*)[*+](\s+)/, "$1-$2"));
}

export function trimTrailingWhitespace(text: string): string {
  return mapLinesOutsideFences(text, (line) => {
    const match = line.match(/[ \t]*$/);
    const trailing = match ? match[0] : "";
    if (trailing === "  ") return line;
    return line.slice(0, line.length - trailing.length);
  });
}

export function alignTables(text: string): string {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (fenceKinds[i]) {
      result.push(line);
      i++;
      continue;
    }
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

type LineKind = "blank" | "fence" | "fence-content" | "heading" | "table" | "other";

function classifyLines(lines: string[]): LineKind[] {
  const kinds: LineKind[] = new Array(lines.length).fill("other");
  const fenceKinds = computeFenceLineKinds(lines);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      kinds[i] = "blank";
      i++;
      continue;
    }
    const fenceKind = fenceKinds[i];
    if (fenceKind) {
      kinds[i] = fenceKind;
      i++;
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      kinds[i] = "heading";
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const end = findTableBlockEnd(lines, i);
      for (let k = i; k < end; k++) kinds[k] = "table";
      i = end;
      continue;
    }
    kinds[i] = "other";
    i++;
  }
  return kinds;
}

interface Block {
  type: "blank" | "special" | "other";
  lines: string[];
}

export function normalizeBlankLines(text: string): string {
  const lines = text.split("\n");
  const kinds = classifyLines(lines);

  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const kind = kinds[i];
    if (kind === "blank") {
      let j = i;
      while (j < lines.length && kinds[j] === "blank") j++;
      blocks.push({ type: "blank", lines: lines.slice(i, j) });
      i = j;
      continue;
    }
    if (kind === "heading") {
      blocks.push({ type: "special", lines: [lines[i]] });
      i++;
      continue;
    }
    if (kind === "fence") {
      let j = i + 1;
      while (j < lines.length && kinds[j] !== "fence") j++;
      const end = j < lines.length ? j + 1 : j;
      blocks.push({ type: "special", lines: lines.slice(i, end) });
      i = end;
      continue;
    }
    if (kind === "table") {
      let j = i;
      while (j < lines.length && kinds[j] === "table") j++;
      blocks.push({ type: "special", lines: lines.slice(i, j) });
      i = j;
      continue;
    }
    let j = i;
    while (j < lines.length && kinds[j] === "other") j++;
    blocks.push({ type: "other", lines: lines.slice(i, j) });
    i = j;
  }

  while (blocks.length && blocks[0].type === "blank") blocks.shift();
  while (blocks.length && blocks[blocks.length - 1].type === "blank") blocks.pop();

  const nonBlankBlocks: Block[] = [];
  const hadBlankBefore: boolean[] = [];
  for (let k = 0; k < blocks.length; k++) {
    if (blocks[k].type === "blank") continue;
    const precededByBlank = k > 0 && blocks[k - 1].type === "blank";
    nonBlankBlocks.push(blocks[k]);
    hadBlankBefore.push(precededByBlank);
  }

  const outLines: string[] = [];
  for (let k = 0; k < nonBlankBlocks.length; k++) {
    if (k > 0) {
      const prev = nonBlankBlocks[k - 1];
      const curr = nonBlankBlocks[k];
      const needsBlank = hadBlankBefore[k] || prev.type === "special" || curr.type === "special";
      if (needsBlank) outLines.push("");
    }
    outLines.push(...nonBlankBlocks[k].lines);
  }

  return outLines.join("\n");
}

function splitFrontmatter(text: string): { frontmatter: string; body: string } {
  const lines = text.split("\n");
  if ((lines[0] ?? "").trim() !== "---") return { frontmatter: "", body: text };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      const frontmatter = lines.slice(0, i + 1).join("\n") + "\n";
      const body = lines.slice(i + 1).join("\n");
      return { frontmatter, body };
    }
  }
  return { frontmatter: "", body: text };
}

export function formatMarkdown(text: string): string {
  const { frontmatter, body } = splitFrontmatter(text);
  let formatted = stripHeadingTrailingHashes(body);
  formatted = normalizeBulletMarkers(formatted);
  formatted = trimTrailingWhitespace(formatted);
  formatted = alignTables(formatted);
  formatted = normalizeBlankLines(formatted);
  const finalBody = formatted.length > 0 ? `${formatted}\n` : "";
  return frontmatter + finalBody;
}
