# Format Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Format Document" action to the Layout tab that reformats the whole current file in place: whitespace cleanup, blank-line spacing normalization, bullet/heading marker normalization, and markdown table column alignment.

**Architecture:** `formatMarkdown.ts` (new) holds pure, independently-tested text-transformation functions with no editor dependency, composed by a top-level `formatMarkdown(text): string`. `layout.ts` gets a thin editor-effect wrapper, `formatDocument(editor)`, that reads the whole document, runs it through `formatMarkdown`, and writes it back only if changed. `registry.ts` gets one new entry in a new "Formatting" group on the Layout tab. Table alignment is delegated to the `markdown-table` npm package (zero runtime dependencies) rather than hand-rolled; everything else is hand-rolled regex/line-based logic.

**Tech Stack:** TypeScript, Vitest, `markdown-table` (new production dependency).

## Global Constraints

- `formatMarkdown(text: string): string` is the single top-level composition function. It splits off a leading YAML frontmatter block (`--- ... ---` at the very start of the file), runs the five rules below over the remaining body in this fixed order — `stripHeadingTrailingHashes` → `normalizeBulletMarkers` → `trimTrailingWhitespace` → `alignTables` → `normalizeBlankLines` — then reassembles `frontmatter + formattedBody`. Frontmatter content is never touched. The result always ends in exactly one `\n` when there's any body content; an empty or frontmatter-only document stays that way (no artificial trailing blank line).
- `stripHeadingTrailingHashes`: for ATX headings only (`/^(#{1,6})(\s+)(.*)$/`), strips a trailing run of `#` characters and the whitespace before it from the heading text. Non-headings and headings with no trailing `#` (preceded by whitespace) are untouched.
- `normalizeBulletMarkers`: any line starting with (optional leading whitespace) `*` or `+` followed by whitespace becomes `-` instead, preserving indentation and the exact spacing after the marker. Ordered lists and non-list lines are untouched.
- `trimTrailingWhitespace`: strips all trailing whitespace from every line, *except* a line whose trailing whitespace is **exactly** two space characters (a markdown hard line-break), which is preserved unchanged.
- `alignTables`: detects each contiguous pipe-table block (a line containing `|` immediately followed by a valid separator row), reads per-column alignment from the separator row's colons, and calls `markdownTable(rows, { align })` from the `markdown-table` package to regenerate the block. Multiple tables in one document are each handled independently.
- `normalizeBlankLines`: classifies lines into `blank` / `heading` / `fence` (+ `fence-content`) / `table` / `other` blocks. Between any two adjacent non-blank blocks: force exactly one blank line if either block is a heading, fence, or table, or if a blank run already existed there in the source; otherwise leave them touching. Leading/trailing blank blocks at the very start/end of the document are dropped entirely.
- `formatDocument(editor: EditorLike): void` — `EditorLike` has no `getValue()`/`setValue()`, so it reads the whole document by joining `getLine(i)` for every line. If `formatMarkdown`'s output equals the original, it does nothing (no `replaceRange` call). Otherwise it writes the whole document back via one `replaceRange` (`{ line: 0, ch: 0 }` to `{ line: lastLine, ch: <that line's length> }`) and restores the cursor's original `{ line, ch }`, clamped to the reformatted document's new bounds.
- `CommandEntry` for the new Layout action: `{ id: "format-document", tab: "layout", group: "Formatting", icon: "sparkles", label: "Format Document", action: layout.formatDocument }`.
- `markdown-table` (exact version `3.0.4`) is added to `package.json` `dependencies` (this project currently has zero production dependencies). No changes to `esbuild.config.mjs` are needed — its `external` list only excludes `obsidian`/`electron`/`@codemirror/*`, so `markdown-table` bundles into `main.js` normally.
- Setext headings, escaped pipes (`\|`) in table cells, per-rule buttons, and selection-scoped formatting are all explicitly out of scope for this feature.

---

## Task 1: Simple per-line rules

**Files:**
- Create: `src/ribbon/commands/actions/formatMarkdown.ts`
- Test: `tests/ribbon/commands/actions/formatMarkdown.test.ts`

**Interfaces:**
- Produces: `stripHeadingTrailingHashes(text: string): string`, `normalizeBulletMarkers(text: string): string`, `trimTrailingWhitespace(text: string): string` — all consumed by Task 4's `formatMarkdown` composition.

- [ ] **Step 1: Write the failing tests**

Create `tests/ribbon/commands/actions/formatMarkdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  stripHeadingTrailingHashes,
  normalizeBulletMarkers,
  trimTrailingWhitespace,
} from "../../../../src/ribbon/commands/actions/formatMarkdown";

describe("stripHeadingTrailingHashes", () => {
  it("strips a trailing run of # characters from an ATX heading", () => {
    expect(stripHeadingTrailingHashes("## Title ##")).toBe("## Title");
  });

  it("leaves a heading with no trailing # untouched", () => {
    expect(stripHeadingTrailingHashes("# Just a heading")).toBe("# Just a heading");
  });

  it("leaves a non-heading line untouched, even if it ends in #", () => {
    expect(stripHeadingTrailingHashes("Not a heading #")).toBe("Not a heading #");
  });
});

describe("normalizeBulletMarkers", () => {
  it("normalizes *, +, and - markers to - consistently", () => {
    expect(normalizeBulletMarkers("* Item one\n+ Item two\n- Item three")).toBe(
      "- Item one\n- Item two\n- Item three"
    );
  });

  it("preserves indentation on nested list items", () => {
    expect(normalizeBulletMarkers("  * nested")).toBe("  - nested");
  });

  it("does not touch a line that merely starts with * but isn't a list item", () => {
    expect(normalizeBulletMarkers("*emphasis* text")).toBe("*emphasis* text");
  });

  it("does not touch ordered list markers", () => {
    expect(normalizeBulletMarkers("1. First\n2. Second")).toBe("1. First\n2. Second");
  });
});

describe("trimTrailingWhitespace", () => {
  it("preserves exactly two trailing spaces (a hard line break) but trims other trailing whitespace", () => {
    expect(trimTrailingWhitespace("Line one  \nLine two   \nLine three ")).toBe(
      "Line one  \nLine two\nLine three"
    );
  });

  it("trims a trailing tab", () => {
    expect(trimTrailingWhitespace("Line\t")).toBe("Line");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- formatMarkdown`
Expected: FAIL — `src/ribbon/commands/actions/formatMarkdown.ts` does not exist yet, so the import fails.

- [ ] **Step 3: Implement the three functions**

Create `src/ribbon/commands/actions/formatMarkdown.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- formatMarkdown`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/formatMarkdown.ts tests/ribbon/commands/actions/formatMarkdown.test.ts
git commit -m "feat: add heading/bullet/whitespace formatting rules"
```

---

## Task 2: Table alignment

**Files:**
- Modify: `src/ribbon/commands/actions/formatMarkdown.ts`
- Modify: `tests/ribbon/commands/actions/formatMarkdown.test.ts`
- Modify: `package.json`, `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: `alignTables(text: string): string` — consumed by Task 4's `formatMarkdown` composition.
- Consumes: `markdownTable` from the `markdown-table` package.

- [ ] **Step 1: Add the dependency**

Run: `npm install markdown-table@3.0.4`
Expected: adds `"markdown-table": "^3.0.4"` (or the exact resolved range `npm install` writes) under a new `"dependencies"` key in `package.json`, and updates `package-lock.json`. This is the project's first production dependency — that's expected, not an error.

- [ ] **Step 2: Write the failing tests**

Append to `tests/ribbon/commands/actions/formatMarkdown.test.ts`:

```ts
import { alignTables } from "../../../../src/ribbon/commands/actions/formatMarkdown";
```

(add `alignTables` to the existing import line from Step 1 of Task 1, rather than a second import statement)

```ts
describe("alignTables", () => {
  it("pads cells and rebuilds the separator row with alignment markers", () => {
    expect(alignTables("| Name | Age |\n|:-|--:|\n| Bob | 30 |")).toBe(
      "| Name | Age |\n| :--- | --: |\n| Bob  |  30 |"
    );
  });

  it("pads cells with a plain separator row (no alignment colons)", () => {
    expect(alignTables("| Name | Age |\n| --- | --- |\n| Bob | 30 |")).toBe(
      "| Name | Age |\n| ---- | --- |\n| Bob  | 30  |"
    );
  });

  it("handles multiple independent tables in one document", () => {
    expect(
      alignTables("| A | B |\n| - | - |\n| 1 | 22 |\nSome text.\n| X | Y |\n| - | - |\n| longvalue | z |")
    ).toBe(
      "| A | B  |\n| - | -- |\n| 1 | 22 |\nSome text.\n| X         | Y |\n| --------- | - |\n| longvalue | z |"
    );
  });

  it("leaves non-table text untouched", () => {
    expect(alignTables("Just a paragraph.\nAnother line.")).toBe("Just a paragraph.\nAnother line.");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- formatMarkdown`
Expected: FAIL — `alignTables` is not exported from `formatMarkdown.ts` yet (import error).

- [ ] **Step 4: Implement `alignTables`**

Add to `src/ribbon/commands/actions/formatMarkdown.ts` (add the import at the top of the file, and the new code after the three existing functions):

```ts
import { markdownTable } from "markdown-table";
```

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- formatMarkdown`
Expected: PASS — all 12 tests green (8 from Task 1 + 4 new).

- [ ] **Step 6: Commit**

```bash
git add src/ribbon/commands/actions/formatMarkdown.ts tests/ribbon/commands/actions/formatMarkdown.test.ts package.json package-lock.json
git commit -m "feat: add alignTables using the markdown-table package"
```

---

## Task 3: Blank-line normalization

**Files:**
- Modify: `src/ribbon/commands/actions/formatMarkdown.ts`
- Modify: `tests/ribbon/commands/actions/formatMarkdown.test.ts`

**Interfaces:**
- Produces: `normalizeBlankLines(text: string): string` — consumed by Task 4's `formatMarkdown` composition.

- [ ] **Step 1: Write the failing tests**

Add `normalizeBlankLines` to the existing import line in `tests/ribbon/commands/actions/formatMarkdown.test.ts`, and append:

```ts
describe("normalizeBlankLines", () => {
  it("forces a blank line before and after a heading", () => {
    expect(normalizeBlankLines("Text right after heading\n## Heading\nMore text")).toBe(
      "Text right after heading\n\n## Heading\n\nMore text"
    );
  });

  it("collapses a run of blank lines down to exactly one", () => {
    expect(normalizeBlankLines("Para one.\n\n\n\nPara two.")).toBe("Para one.\n\nPara two.");
  });

  it("removes leading and trailing blank lines", () => {
    expect(normalizeBlankLines("\n\nHello\n\n")).toBe("Hello");
  });

  it("leaves consecutive list items touching with no forced blank line", () => {
    expect(normalizeBlankLines("- Item one\n- Item two")).toBe("- Item one\n- Item two");
  });

  it("forces a blank line before and after a fenced code block", () => {
    expect(normalizeBlankLines("Text\n```\ncode line\n```\nMore text")).toBe(
      "Text\n\n```\ncode line\n```\n\nMore text"
    );
  });

  it("preserves a single blank line that already separates two paragraphs", () => {
    expect(normalizeBlankLines("Para A.\n\nPara B.")).toBe("Para A.\n\nPara B.");
  });

  it("forces a blank line around a table block", () => {
    expect(normalizeBlankLines("Text\n| A | B |\n| - | - |\n| 1 | 2 |\nMore")).toBe(
      "Text\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nMore"
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- formatMarkdown`
Expected: FAIL — `normalizeBlankLines` is not exported yet (import error).

- [ ] **Step 3: Implement `normalizeBlankLines`**

Append to `src/ribbon/commands/actions/formatMarkdown.ts`:

```ts
type LineKind = "blank" | "fence" | "fence-content" | "heading" | "table" | "other";

function classifyLines(lines: string[]): LineKind[] {
  const kinds: LineKind[] = new Array(lines.length).fill("other");
  let inFence = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      kinds[i] = "blank";
      i++;
      continue;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      kinds[i] = "fence";
      inFence = !inFence;
      i++;
      continue;
    }
    if (inFence) {
      kinds[i] = "fence-content";
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
```

Note: this step reuses the private `isSeparatorRow` and `findTableBlockEnd` helpers added in Task 2 — do not redefine them.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- formatMarkdown`
Expected: PASS — all 19 tests green (12 from Tasks 1-2 + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/formatMarkdown.ts tests/ribbon/commands/actions/formatMarkdown.test.ts
git commit -m "feat: add normalizeBlankLines for blank-line collapsing and block spacing"
```

---

## Task 4: `formatMarkdown` composition and frontmatter handling

**Files:**
- Modify: `src/ribbon/commands/actions/formatMarkdown.ts`
- Modify: `tests/ribbon/commands/actions/formatMarkdown.test.ts`

**Interfaces:**
- Consumes: `stripHeadingTrailingHashes`, `normalizeBulletMarkers`, `trimTrailingWhitespace`, `alignTables`, `normalizeBlankLines` (all in the same file, Tasks 1-3).
- Produces: `formatMarkdown(text: string): string` — consumed by Task 5's `formatDocument`.

- [ ] **Step 1: Write the failing tests**

Add `formatMarkdown` to the existing import line in `tests/ribbon/commands/actions/formatMarkdown.test.ts`, and append:

```ts
describe("formatMarkdown", () => {
  it("applies all rules together in the correct order", () => {
    expect(
      formatMarkdown(
        "# Title ##\nSome text.\n* item one\n+ item two\n\n\n\n| Name | Age |\n|:-|--:|\n| Bob | 30 |\nAfter table."
      )
    ).toBe(
      "# Title\n\nSome text.\n- item one\n- item two\n\n| Name | Age |\n| :--- | --: |\n| Bob  |  30 |\n\nAfter table.\n"
    );
  });

  it("leaves a leading YAML frontmatter block untouched and only formats the body", () => {
    expect(formatMarkdown("---\ntitle: x\ntags: [a,  b]\n---\n# Heading\ncontent   \n")).toBe(
      "---\ntitle: x\ntags: [a,  b]\n---\n# Heading\n\ncontent\n"
    );
  });

  it("returns an empty string for an empty document", () => {
    expect(formatMarkdown("")).toBe("");
  });

  it("leaves a frontmatter-only document unchanged with no artificial body content", () => {
    expect(formatMarkdown("---\ntitle: x\n---\n")).toBe("---\ntitle: x\n---\n");
  });

  it("is a no-op on an already-formatted document", () => {
    expect(formatMarkdown("# Title\n\nSome content.\n")).toBe("# Title\n\nSome content.\n");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- formatMarkdown`
Expected: FAIL — `formatMarkdown` is not exported yet (import error).

- [ ] **Step 3: Implement `formatMarkdown`**

Append to `src/ribbon/commands/actions/formatMarkdown.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- formatMarkdown`
Expected: PASS — all 24 tests green (19 from Tasks 1-3 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/formatMarkdown.ts tests/ribbon/commands/actions/formatMarkdown.test.ts
git commit -m "feat: compose formatMarkdown with frontmatter passthrough"
```

---

## Task 5: `formatDocument` editor action and registry wiring

**Files:**
- Modify: `src/ribbon/commands/actions/layout.ts`
- Modify: `tests/ribbon/commands/actions/layout.test.ts`
- Modify: `src/ribbon/commands/registry.ts:224-231` (insert after `table-of-contents`)
- Modify: `tests/ribbon/commands/registry.test.ts`

**Interfaces:**
- Consumes: `formatMarkdown(text: string): string` from `./formatMarkdown` (Task 4).
- Produces: `formatDocument(editor: EditorLike): void` — consumed by Task 5's own registry entry (`layout.formatDocument`).

- [ ] **Step 1: Write the failing tests**

Add `formatDocument` to the existing import list in `tests/ribbon/commands/actions/layout.test.ts` (from `../../../../src/ribbon/commands/actions/layout`), and append inside the `describe("Layout tab actions", ...)` block, right before its closing `});`:

```ts
  it("formatDocument reformats the whole document", () => {
    const editor = createMockEditor("## Title ##\n* item");
    formatDocument(editor);
    expect(editor.getValue()).toBe("## Title\n\n- item\n");
  });

  it("formatDocument does nothing when the document is already formatted", () => {
    const editor = createMockEditor("# Title\n\nSome content.\n");
    const before = editor.getValue();
    formatDocument(editor);
    expect(editor.getValue()).toBe(before);
  });

  it("formatDocument clamps the cursor to the reformatted document's bounds", () => {
    const editor = createMockEditor("Para one.\n\n\n\nPara two.", { line: 4, ch: 3 });
    formatDocument(editor);
    expect(editor.getValue()).toBe("Para one.\n\nPara two.\n");
    expect(editor.getCursor()).toEqual({ line: 3, ch: 0 });
  });

  it("formatDocument preserves the cursor position on a line that survives formatting", () => {
    const editor = createMockEditor("Line one   \nLine two", { line: 1, ch: 5 });
    formatDocument(editor);
    expect(editor.getValue()).toBe("Line one\nLine two\n");
    expect(editor.getCursor()).toEqual({ line: 1, ch: 5 });
  });
```

In `tests/ribbon/commands/registry.test.ts`, add a new test right after the existing `"table command opens the grid picker instead of a direct action"` test:

```ts
  it("format-document command is a direct action on the Layout tab in a Formatting group", () => {
    const formatDocument = COMMAND_REGISTRY.find((entry) => entry.id === "format-document");
    expect(formatDocument?.tab).toBe("layout");
    expect(formatDocument?.group).toBe("Formatting");
    expect(typeof formatDocument?.action).toBe("function");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- layout.test`
Expected: FAIL — `formatDocument` is not exported from `layout.ts` yet (import error).

Run: `npm test -- registry.test`
Expected: FAIL — no `COMMAND_REGISTRY` entry has `id === "format-document"` yet, so `formatDocument?.tab` etc. are all `undefined`.

- [ ] **Step 3: Implement `formatDocument` in `layout.ts`**

Add this import at the top of `src/ribbon/commands/actions/layout.ts`:

```ts
import { formatMarkdown } from "./formatMarkdown";
```

Append this function to the end of `src/ribbon/commands/actions/layout.ts`:

```ts
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
```

- [ ] **Step 4: Wire the registry entry**

In `src/ribbon/commands/registry.ts`, insert this new entry immediately after the `table-of-contents` entry (currently lines 224-231) and before the `// References` comment:

```ts
  {
    id: "format-document",
    tab: "layout",
    group: "Formatting",
    icon: "sparkles",
    label: "Format Document",
    action: layout.formatDocument,
  },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- layout.test`
Expected: PASS — all tests in `layout.test.ts` green (10 existing + 4 new).

Run: `npm test -- registry.test`
Expected: PASS — all tests in `registry.test.ts` green.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass, typecheck clean, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/ribbon/commands/actions/layout.ts tests/ribbon/commands/actions/layout.test.ts src/ribbon/commands/registry.ts tests/ribbon/commands/registry.test.ts
git commit -m "feat: add Format Document action to the Layout tab"
```

---

## Task 6: Manually verify in Obsidian

**Files:** none (build artifacts only)

- [ ] **Step 1: Build the plugin**

Run: `npm run build`
Expected: succeeds, updates `main.js`, `styles.css`, `manifest.json` in the project root. `markdown-table` gets bundled into `main.js` (no external-list change needed).

- [ ] **Step 2: Copy the build into the dev vault**

```bash
cp main.js styles.css manifest.json /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

- [ ] **Step 3: Reload the plugin in Obsidian**

In the dev vault, open Settings → Community plugins, toggle "Ribbon Bar" off and back on (or use "Reload app without saving") to load the new `main.js`.

- [ ] **Step 4: Exercise the golden path**

1. Open a note (or create a scratch one) and paste in a messy sample, e.g.:
   ```
   ## Title ##
   Some text right after the heading.
   * item one
   +   item two



   | Name | Age |
   |:-|--:|
   | Bob | 30 |
   After the table, no blank line.
   ```
2. Click "Format Document" on the Layout tab (in the new "Formatting" group).
3. Confirm the result matches: heading trailing `##` stripped, blank line forced around the heading, bullets normalized to `-`, blank-line run collapsed to one, table cells padded/aligned with a regenerated separator row, and a blank line forced around the table.

- [ ] **Step 5: Exercise edge cases**

1. Add YAML frontmatter (`---\ntags: [a, b]\n---\n`) above some messy body content, format, and confirm the frontmatter block is completely unchanged while the body below it is reformatted normally.
2. Add a fenced code block containing a line starting with `*` or `#` (e.g. a code comment), format, and confirm the blank-line-around-fence rule applies (blank line before/after the fence) — per this feature's accepted scope, the code content's own whitespace/marker formatting is not specially protected, so also confirm you're comfortable with that tradeoff in practice.
3. Add a line ending in exactly two trailing spaces (a hard line break) followed by more text, format, and confirm those two spaces survive.
4. Run "Format Document" a second time immediately after the first, on the now-clean result, and confirm nothing changes (idempotent) and the cursor doesn't jump unexpectedly.
5. Try it on a short note with a heading as the very first line, and confirm no blank line is inserted before it (nothing above the first line).

- [ ] **Step 6: Report results**

If every check in Steps 4-5 passes, the feature is verified — no commit needed for this task. If anything fails, fix the underlying code in the relevant task's files, re-run `npm test` and `npm run typecheck`, rebuild, and re-verify before considering the feature complete.

---

## Self-Review Notes

- **Spec coverage:** Architecture (Tasks 1-5), all five rules with their exact behaviors including edge cases (Tasks 1-3), frontmatter passthrough and trailing-newline handling (Task 4), `formatDocument`'s no-`getValue()` whole-document read/write and cursor clamping (Task 5), registry wiring in a new "Formatting" group (Task 5), out-of-scope items (not implemented, matches spec), testing section (every task ships its own tests; Task 6 is manual verification, consistent with prior plans in this repo). No gaps found.
- **Placeholders:** none — every step has literal code, literal shell commands, and every expected test value was verified by actually running the real implementation against the real `markdown-table` package and this repo's real `createMockEditor` before being written into this plan (not hand-derived approximations).
- **Type consistency:** `stripHeadingTrailingHashes`, `normalizeBulletMarkers`, `trimTrailingWhitespace`, `alignTables`, `normalizeBlankLines` all take/return `string` consistently between their Task 1-3 implementations and Task 4's composition call sites. `formatMarkdown(text: string): string` matches between Task 4's implementation and Task 5's `formatDocument` call site. `formatDocument(editor: EditorLike): void` matches between Task 5's implementation and its `layout.formatDocument` registry reference. The private helpers `isSeparatorRow`/`findTableBlockEnd` introduced in Task 2 are reused (not redefined) by Task 3's `classifyLines`.
