# Table Row/Column Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six ribbon actions (Insert Row Above/Below, Insert Column Left/Right, Delete
Row, Delete Column) that edit whatever markdown table the cursor is currently inside.

**Architecture:** Extract the table-block parsing helpers already living privately inside
`formatMarkdown.ts` into a shared `tableParsing.ts` module, add a cursor-locating
`findEnclosingTable` function to it, then build six pure editor-mutation functions in a new
`tableEdit.ts` that parse the enclosing table into `string[][]` rows, mutate them, and
re-render with the `markdown-table` package (the same call `alignTables` already uses).
Wire the six functions into `registry.ts` as plain-action commands in the Insert tab's
existing "Tables" group.

**Tech Stack:** TypeScript, Vitest, the `markdown-table` npm package (already a project
dependency), the existing `EditorLike` interface and `createMockEditor` test helper.

## Global Constraints

- `EditorLike` (`src/ribbon/commands/actions/types.ts`) has no `getValue()`/`setValue()` —
  all reads go through `getLine(n)`/`lastLine()`, all writes through `replaceRange`/`setLine`/`setCursor`.
- No new npm dependencies — `markdown-table` is already installed and used by `alignTables`.
- No handling of escaped pipes (`\|`) in table cells — matches `alignTables`' existing scope.
- Every command that can't act on the current cursor position must no-op (return without
  mutating the editor) rather than throw or partially apply — matches every existing command
  in this codebase (e.g. `promoteHeading` no-ops off a heading).
- Follow this codebase's existing action-module convention: plain exported functions taking
  `(editor: EditorLike) => void`, no classes.

---

### Task 1: Extract table-parsing helpers into `tableParsing.ts`

**Files:**
- Create: `src/ribbon/commands/actions/tableParsing.ts`
- Modify: `src/ribbon/commands/actions/formatMarkdown.ts:1,35-65`
- Test: none new (existing `tests/ribbon/commands/actions/formatMarkdown.test.ts` must keep passing unchanged — this task is a pure refactor)

**Interfaces:**
- Produces: `isSeparatorRow(line: string): boolean`, `splitTableRow(line: string): string[]`,
  `findTableBlockEnd(lines: string[], start: number): number`,
  `parseAlignment(separatorLine: string): string[]` — all exported from `tableParsing.ts`,
  used by Task 2 and by `formatMarkdown.ts`.

- [ ] **Step 1: Create `tableParsing.ts` with the four helpers moved verbatim (now exported)**

```typescript
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
```

- [ ] **Step 2: Remove the four private definitions from `formatMarkdown.ts` and import them instead**

In `src/ribbon/commands/actions/formatMarkdown.ts`, delete lines 35-65 (the
`isSeparatorRow`, `findTableBlockEnd`, `splitTableRow`, `parseAlignment` function bodies —
everything between `trimTrailingWhitespace`'s closing brace and the `alignTables` function),
and change line 1 from:

```typescript
import { markdownTable } from "markdown-table";
```

to:

```typescript
import { markdownTable } from "markdown-table";
import { isSeparatorRow, findTableBlockEnd, splitTableRow, parseAlignment } from "./tableParsing";
```

The rest of the file (`alignTables`, `classifyLines`, everything else) is unchanged — it
already calls these four functions by name, and now resolves them via the import instead of
the local definitions.

- [ ] **Step 3: Run the existing formatMarkdown tests to confirm no regression**

Run: `npm test -- formatMarkdown`
Expected: PASS — all existing assertions in `tests/ribbon/commands/actions/formatMarkdown.test.ts` pass unchanged, since this step only moved code, it didn't change behavior.

- [ ] **Step 4: Commit**

```bash
git add src/ribbon/commands/actions/tableParsing.ts src/ribbon/commands/actions/formatMarkdown.ts
git commit -m "refactor: extract table-parsing helpers into tableParsing.ts"
```

---

### Task 2: Add `findEnclosingTable` to `tableParsing.ts`

**Files:**
- Modify: `src/ribbon/commands/actions/tableParsing.ts`
- Test: Create `tests/ribbon/commands/actions/tableParsing.test.ts`

**Interfaces:**
- Consumes: `isSeparatorRow`, `findTableBlockEnd`, `parseAlignment` from Task 1 (same file).
- Produces: `export interface TableBlock { start: number; end: number; align: string[] }` and
  `export function findEnclosingTable(editor: EditorLike, line: number): TableBlock | null`
  — used by every function in Task 3-6's `tableEdit.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ribbon/commands/actions/tableParsing.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { findEnclosingTable } from "../../../../src/ribbon/commands/actions/tableParsing";

describe("findEnclosingTable", () => {
  const table = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";

  it("finds the block when the cursor is on a data row", () => {
    const editor = createMockEditor(table, { line: 2, ch: 0 });
    expect(findEnclosingTable(editor, 2)).toEqual({ start: 0, end: 4, align: ["", ""] });
  });

  it("finds the block when the cursor is on the header row", () => {
    const editor = createMockEditor(table, { line: 0, ch: 0 });
    expect(findEnclosingTable(editor, 0)).toEqual({ start: 0, end: 4, align: ["", ""] });
  });

  it("finds the block when the cursor is on the separator row", () => {
    const editor = createMockEditor(table, { line: 1, ch: 0 });
    expect(findEnclosingTable(editor, 1)).toEqual({ start: 0, end: 4, align: ["", ""] });
  });

  it("returns null when the cursor is outside any table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    expect(findEnclosingTable(editor, 0)).toBeNull();
  });

  it("returns the correct block among multiple tables in one document", () => {
    const doc = "| A | B |\n| - | - |\n| 1 | 2 |\ntext\n| X | Y |\n| - | - |\n| 3 | 4 |";
    const editor = createMockEditor(doc, { line: 6, ch: 0 });
    expect(findEnclosingTable(editor, 6)).toEqual({ start: 4, end: 7, align: ["", ""] });
    expect(findEnclosingTable(editor, 3)).toBeNull();
  });

  it("parses colon alignment markers from the separator row", () => {
    const aligned = "| Name | Age |\n|:--|--:|\n| Alice | 30 |";
    const editor = createMockEditor(aligned, { line: 0, ch: 0 });
    expect(findEnclosingTable(editor, 0)).toEqual({ start: 0, end: 3, align: ["l", "r"] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tableParsing`
Expected: FAIL — `findEnclosingTable` is not an exported member of `tableParsing.ts` yet.

- [ ] **Step 3: Implement `findEnclosingTable`**

Append to `src/ribbon/commands/actions/tableParsing.ts`:

```typescript
import type { EditorLike } from "./types";

export interface TableBlock {
  start: number;
  end: number;
  align: string[];
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
```

Add the `import type { EditorLike } from "./types";` line at the top of the file, above the
existing function definitions.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tableParsing`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/tableParsing.ts tests/ribbon/commands/actions/tableParsing.test.ts
git commit -m "feat: add findEnclosingTable for locating a table block at the cursor"
```

---

### Task 3: `tableEdit.ts` scaffolding + `insertRowAbove` + `insertRowBelow`

**Files:**
- Create: `src/ribbon/commands/actions/tableEdit.ts`
- Test: Create `tests/ribbon/commands/actions/tableEdit.test.ts`

**Interfaces:**
- Consumes: `findEnclosingTable`, `splitTableRow`, `TableBlock` from Task 2's
  `tableParsing.ts`; `markdownTable` from the `markdown-table` package; `EditorLike`,
  `EditorPosition` from `./types`.
- Produces (this task): `export function insertRowAbove(editor: EditorLike): void`,
  `export function insertRowBelow(editor: EditorLike): void`, plus three module-private
  helpers reused by every later task in this file: `readLines(editor): string[]`,
  `rowsFromBlock(lines: string[], start: number, end: number): string[][]`,
  `replaceBlock(editor, start, end, lines, rows, align): string[]` (returns the rendered
  lines, for callers that need to compute a cursor position from the new text).

- [ ] **Step 1: Write the failing tests**

Create `tests/ribbon/commands/actions/tableEdit.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertRowAbove, insertRowBelow } from "../../../../src/ribbon/commands/actions/tableEdit";

const BASE_TABLE = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";

describe("insertRowAbove", () => {
  it("inserts an empty row above the data row the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe(
      "| Name  | Age |\n| ----- | --- |\n|       |     |\n| Alice | 30  |\n| Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 2, ch: 2 });
  });

  it("does nothing when the cursor is on the header row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 0, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe(BASE_TABLE);
  });

  it("does nothing when the cursor is on the separator row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 1, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe(BASE_TABLE);
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});

describe("insertRowBelow", () => {
  it("inserts an empty row below the data row the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe(
      "| Name  | Age |\n| ----- | --- |\n| Alice | 30  |\n|       |     |\n| Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 3, ch: 2 });
  });

  it("inserts the first data row when triggered from the header row", () => {
    const headerOnly = "| Name | Age |\n| --- | --- |";
    const editor = createMockEditor(headerOnly, { line: 0, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe("| Name | Age |\n| ---- | --- |\n|      |     |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 2 });
  });

  it("inserts the first data row when triggered from the separator row", () => {
    const headerOnly = "| Name | Age |\n| --- | --- |";
    const editor = createMockEditor(headerOnly, { line: 1, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe("| Name | Age |\n| ---- | --- |\n|      |     |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 2 });
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tableEdit`
Expected: FAIL — `src/ribbon/commands/actions/tableEdit.ts` does not exist yet.

- [ ] **Step 3: Implement `tableEdit.ts`**

Create `src/ribbon/commands/actions/tableEdit.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tableEdit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/tableEdit.ts tests/ribbon/commands/actions/tableEdit.test.ts
git commit -m "feat: add insertRowAbove and insertRowBelow table editing actions"
```

---

### Task 4: `insertColumnLeft` + `insertColumnRight`

**Files:**
- Modify: `src/ribbon/commands/actions/tableEdit.ts`
- Modify: `tests/ribbon/commands/actions/tableEdit.test.ts`

**Interfaces:**
- Consumes: `readLines`, `rowsFromBlock`, `replaceBlock` from Task 3 (same file);
  `findEnclosingTable` from `tableParsing.ts`.
- Produces: `export function insertColumnLeft(editor: EditorLike): void`,
  `export function insertColumnRight(editor: EditorLike): void`, plus module-private helpers
  `columnAt(line: string, ch: number, columns: number): number` and
  `cellStartCh(line: string, column: number): number`, reused by Task 6's `deleteColumn`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ribbon/commands/actions/tableEdit.test.ts` (add this import to the existing
import line, and add these two `describe` blocks):

```typescript
import { insertColumnLeft, insertColumnRight, insertRowAbove, insertRowBelow } from "../../../../src/ribbon/commands/actions/tableEdit";
```

```typescript
describe("insertColumnLeft", () => {
  it("inserts an empty column to the left of the column the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 4 });
    insertColumnLeft(editor);
    expect(editor.getValue()).toBe(
      "|   | Name  | Age |\n| - | ----- | --- |\n|   | Alice | 30  |\n|   | Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 2, ch: 1 });
  });

  it("works when the cursor is on the header row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 0, ch: 3 });
    insertColumnLeft(editor);
    expect(editor.getValue()).toBe(
      "|   | Name  | Age |\n| - | ----- | --- |\n|   | Alice | 30  |\n|   | Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 0, ch: 1 });
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertColumnLeft(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});

describe("insertColumnRight", () => {
  it("inserts an empty column to the right of the column the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 4 });
    insertColumnRight(editor);
    expect(editor.getValue()).toBe(
      "| Name  |   | Age |\n| ----- | - | --- |\n| Alice |   | 30  |\n| Bob   |   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 2, ch: 9 });
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertColumnRight(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tableEdit`
Expected: FAIL — `insertColumnLeft` and `insertColumnRight` are not exported yet.

- [ ] **Step 3: Implement the two functions**

Append to `src/ribbon/commands/actions/tableEdit.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tableEdit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/tableEdit.ts tests/ribbon/commands/actions/tableEdit.test.ts
git commit -m "feat: add insertColumnLeft and insertColumnRight table editing actions"
```

---

### Task 5: `deleteRow` (including header-row promotion)

**Files:**
- Modify: `src/ribbon/commands/actions/tableEdit.ts`
- Modify: `tests/ribbon/commands/actions/tableEdit.test.ts`

**Interfaces:**
- Consumes: `readLines`, `rowsFromBlock`, `replaceBlock` from Task 3 (same file);
  `findEnclosingTable` from `tableParsing.ts`.
- Produces: `export function deleteRow(editor: EditorLike): void`.

- [ ] **Step 1: Write the failing tests**

Add `deleteRow` to the import line in `tests/ribbon/commands/actions/tableEdit.test.ts`, and
append this `describe` block:

```typescript
describe("deleteRow", () => {
  it("deletes the data row the cursor is on, landing on the row that shifted into its place", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("| Name  | Age |\n| ----- | --- |\n| Bob   | 25  |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 0 });
  });

  it("deletes the last data row, landing on the previous row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 3, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("| Name  | Age |\n| ----- | --- |\n| Alice | 30  |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 0 });
  });

  it("deletes the header row, promoting the next data row to header", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 0, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("| Alice | 30 |\n| ----- | -- |\n| Bob   | 25 |");
    expect(editor.getCursor()).toEqual({ line: 0, ch: 0 });
  });

  it("does nothing on the separator row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 1, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe(BASE_TABLE);
  });

  it("does nothing when it would leave zero data rows (deleting the only data row)", () => {
    const oneRow = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
    const editor = createMockEditor(oneRow, { line: 2, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe(oneRow);
  });

  it("does nothing when it would leave zero data rows (deleting the header with only one data row left)", () => {
    const oneRow = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
    const editor = createMockEditor(oneRow, { line: 0, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe(oneRow);
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tableEdit`
Expected: FAIL — `deleteRow` is not exported yet.

- [ ] **Step 3: Implement `deleteRow`**

Append to `src/ribbon/commands/actions/tableEdit.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tableEdit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/tableEdit.ts tests/ribbon/commands/actions/tableEdit.test.ts
git commit -m "feat: add deleteRow table editing action with header-row promotion"
```

---

### Task 6: `deleteColumn`

**Files:**
- Modify: `src/ribbon/commands/actions/tableEdit.ts`
- Modify: `tests/ribbon/commands/actions/tableEdit.test.ts`

**Interfaces:**
- Consumes: `readLines`, `rowsFromBlock`, `replaceBlock`, `columnAt`, `cellStartCh` from
  Tasks 3-4 (same file); `findEnclosingTable` from `tableParsing.ts`.
- Produces: `export function deleteColumn(editor: EditorLike): void`.

- [ ] **Step 1: Write the failing tests**

Add `deleteColumn` to the import line in `tests/ribbon/commands/actions/tableEdit.test.ts`,
and append this `describe` block:

```typescript
describe("deleteColumn", () => {
  it("deletes the column the cursor is on, landing on the column that shifted into its place", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 10 });
    deleteColumn(editor);
    expect(editor.getValue()).toBe("| Name  |\n| ----- |\n| Alice |\n| Bob   |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 1 });
  });

  it("deletes the last column, landing on the previous column", () => {
    const threeCol = "| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |";
    const editor = createMockEditor(threeCol, { line: 2, ch: 10 });
    deleteColumn(editor);
    expect(editor.getValue()).toBe("| A | B |\n| - | - |\n| 1 | 2 |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 5 });
  });

  it("does nothing when only one column remains", () => {
    const oneCol = "| Name |\n| --- |\n| Alice |";
    const editor = createMockEditor(oneCol, { line: 2, ch: 3 });
    deleteColumn(editor);
    expect(editor.getValue()).toBe(oneCol);
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    deleteColumn(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tableEdit`
Expected: FAIL — `deleteColumn` is not exported yet.

- [ ] **Step 3: Implement `deleteColumn`**

Append to `src/ribbon/commands/actions/tableEdit.ts`:

```typescript
export function deleteColumn(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const block = findEnclosingTable(editor, cursor.line);
  if (!block) return;
  const { start, end, align } = block;

  const lines = readLines(editor);
  const rows = rowsFromBlock(lines, start, end);
  const columns = rows[0].length;
  if (columns <= 1) return;

  const col = columnAt(lines[cursor.line], cursor.ch, columns);
  for (const row of rows) row.splice(col, 1);
  const newAlign = [...align];
  newAlign.splice(col, 1);

  const rendered = replaceBlock(editor, start, end, lines, rows, newAlign);
  const newColumns = columns - 1;
  const target = Math.min(col, newColumns - 1);
  const rowOffset = cursor.line - start;
  editor.setCursor({ line: cursor.line, ch: cellStartCh(rendered[rowOffset], target) });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tableEdit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/tableEdit.ts tests/ribbon/commands/actions/tableEdit.test.ts
git commit -m "feat: add deleteColumn table editing action"
```

---

### Task 7: Wire the six actions into the Insert tab's Tables group

**Files:**
- Modify: `src/ribbon/commands/registry.ts:1-9,149`
- Modify: `tests/ribbon/commands/registry.test.ts`
- Test: run the full suite, typecheck, and build

**Interfaces:**
- Consumes: `insertRowAbove`, `insertRowBelow`, `insertColumnLeft`, `insertColumnRight`,
  `deleteRow`, `deleteColumn` from Tasks 3-6's `tableEdit.ts`.

- [ ] **Step 1: Write the failing registry test**

Append to `tests/ribbon/commands/registry.test.ts`, inside the `describe("COMMAND_REGISTRY", ...)` block (after the `format-document` test):

```typescript
  it("table row/column editing commands are direct actions in the Insert tab's Tables group", () => {
    const ids = [
      "table-insert-row-above",
      "table-insert-row-below",
      "table-insert-column-left",
      "table-insert-column-right",
      "table-delete-row",
      "table-delete-column",
    ];
    for (const id of ids) {
      const entry = COMMAND_REGISTRY.find((e) => e.id === id);
      expect(entry?.tab).toBe("insert");
      expect(entry?.group).toBe("Tables");
      expect(typeof entry?.action).toBe("function");
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- registry`
Expected: FAIL — none of the six ids exist in `COMMAND_REGISTRY` yet.

- [ ] **Step 3: Add the import and the six registry entries**

In `src/ribbon/commands/registry.ts`, add this import alongside the existing action-module
imports near the top of the file (after `import * as layout from "./actions/layout";`):

```typescript
import * as tableEdit from "./actions/tableEdit";
```

Then, immediately after the existing `table` grid-picker entry (the line reading
`{ id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", grid: insertActions.insertTableGrid },`), insert:

```typescript
  {
    id: "table-insert-row-above",
    tab: "insert",
    group: "Tables",
    icon: "arrow-up-to-line",
    label: "Insert Row Above",
    action: tableEdit.insertRowAbove,
  },
  {
    id: "table-insert-row-below",
    tab: "insert",
    group: "Tables",
    icon: "arrow-down-to-line",
    label: "Insert Row Below",
    action: tableEdit.insertRowBelow,
  },
  {
    id: "table-insert-column-left",
    tab: "insert",
    group: "Tables",
    icon: "arrow-left-to-line",
    label: "Insert Column Left",
    action: tableEdit.insertColumnLeft,
  },
  {
    id: "table-insert-column-right",
    tab: "insert",
    group: "Tables",
    icon: "arrow-right-to-line",
    label: "Insert Column Right",
    action: tableEdit.insertColumnRight,
  },
  {
    id: "table-delete-row",
    tab: "insert",
    group: "Tables",
    icon: "rows-3",
    label: "Delete Row",
    action: tableEdit.deleteRow,
  },
  {
    id: "table-delete-column",
    tab: "insert",
    group: "Tables",
    icon: "columns-3",
    label: "Delete Column",
    action: tableEdit.deleteColumn,
  },
```

- [ ] **Step 4: Run the registry test to verify it passes**

Run: `npm test -- registry`
Expected: PASS

- [ ] **Step 5: Run the full test suite, typecheck, and build**

Run: `npm test`
Expected: PASS — every test file in the project, including all tasks from this plan.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: builds successfully, producing an updated `main.js`.

- [ ] **Step 6: Commit**

```bash
git add src/ribbon/commands/registry.ts tests/ribbon/commands/registry.test.ts
git commit -m "feat: wire table row/column editing actions into the Insert tab"
```

- [ ] **Step 7: Manually verify in Obsidian**

Per this project's established practice, load the built plugin in the Obsidian dev vault and
manually exercise all six buttons against a real table: insert a row above/below, insert a
column left/right, delete a row (including the header-promotion case), delete a column, and
confirm each no-op precondition (header/separator no-ops, last-row/last-column no-ops)
behaves as expected. Check that the six icon ids actually render a glyph in Obsidian's
bundled lucide set — if any renders blank, swap it for an available alternative (the button
label is still visible either way, so this is a visual polish fix, not a functional one).

---
