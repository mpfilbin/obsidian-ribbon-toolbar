# Table Row/Column Editing — Design

## Problem

The Insert tab's Table grid picker (`insertTableGrid`) can only create a new table at a
fixed size. Once a table exists, there's no way to grow or shrink it — adding or removing a
row or column requires hand-editing the markdown.

## Goal

Add six new actions to the Insert tab's "Tables" group that add or remove a row/column of
whatever table the cursor is currently inside: Insert Row Above, Insert Row Below, Insert
Column Left, Insert Column Right, Delete Row, Delete Column.

## Design

### Architecture

- **`src/ribbon/commands/actions/tableParsing.ts`** (new) — the table-block parsing helpers
  currently private to `formatMarkdown.ts` (`isSeparatorRow`, `splitTableRow`,
  `findTableBlockEnd`, `parseAlignment`), moved here unchanged so both `formatMarkdown.ts`
  and the new table-editing code can use them. `formatMarkdown.ts`'s `alignTables` imports
  from here instead of redefining them — a pure move, no behavior change.

  Adds one new function: `findEnclosingTable(editor: EditorLike, line: number): TableBlock |
  null`, which walks upward/downward from `line` to find the contiguous block of
  `|`-containing lines whose second line is a separator row. Returns `null` if `line` isn't
  inside a table block. `TableBlock` is `{ start: number; end: number; align: string[] }`
  (`start`/`end` are the block's line range, matching `findTableBlockEnd`'s convention;
  `align` is parsed from the separator row via `parseAlignment`).

- **`src/ribbon/commands/actions/tableEdit.ts`** (new) — six exported functions, each
  `(editor: EditorLike) => void`: `insertRowAbove`, `insertRowBelow`, `insertColumnLeft`,
  `insertColumnRight`, `deleteRow`, `deleteColumn`. Shared internal flow:
  1. Locate the enclosing table via `findEnclosingTable(editor, editor.getCursor().line)`;
     no-op (return) if `null`.
  2. Read every line in `[start, end)` and split into cells with `splitTableRow`, producing
     `rows: string[][]` (`rows[0]` = header, `rows[1..]` = data rows; the separator row
     itself is not part of `rows` — it's regenerated from `align`).
  3. Mutate `rows` and/or `align` per the command's rule (below).
  4. Re-render with `markdownTable(rows, { align })` (the same call `alignTables` already
     uses) and replace the block's line range via a single `editor.replaceRange`.
  5. Reposition the cursor per the command's rule (below).

- **`src/ribbon/commands/registry.ts`** — six new entries, tab `"insert"`, group `"Tables"`,
  alongside the existing `table` grid-picker entry. Each is a plain `action` (no
  modal/grid):

  | id | label | icon |
  |---|---|---|
  | `table-insert-row-above` | Insert Row Above | `arrow-up-to-line` |
  | `table-insert-row-below` | Insert Row Below | `arrow-down-to-line` |
  | `table-insert-column-left` | Insert Column Left | `arrow-left-to-line` |
  | `table-insert-column-right` | Insert Column Right | `arrow-right-to-line` |
  | `table-delete-row` | Delete Row | `rows-3` |
  | `table-delete-column` | Delete Column | `columns-3` |

  Icon names are best-effort picks from Obsidian's bundled lucide set; every button also
  renders its text label next to the icon (`Button.svelte` already does this for all
  commands), so an unavailable icon id is a cosmetic gap, not a functional one — verified
  visually during manual testing in Obsidian per this project's usual practice, swapped for
  an alternate id if blank.

### Row/column position detection

**Row kind** at the cursor is determined by comparing `cursor.line` to the table block:
`start` = header, `start + 1` = separator, anything else in `[start, end)` = a data row (at
data-row index `cursor.line - start - 2`).

**Column index** at the cursor is the count of `|` characters in the current line strictly
before `cursor.ch`, clamped to `[0, columns - 1]`. This matches `splitTableRow`'s existing
simple pipe-splitting (no handling of escaped `\|`, consistent with how `alignTables`
already treats cells).

### Command rules

**Insert Row Above** — acts only when cursor is on a data row; no-op on header/separator.
Inserts one row of empty cells (`""` per column) into `rows` immediately before the current
data row.

**Insert Row Below** — acts when cursor is on header, separator, or a data row. Inserts one
empty row immediately after the current row's position (so triggering from header or
separator inserts it as the new first data row — this is how a table with 0 data rows
bootstraps its first one).

**Insert Column Left** / **Insert Column Right** — act regardless of which row (header,
separator, or data) the cursor is on, since column index applies uniformly across the whole
block. Insert one empty cell (`""`) into every row of `rows` at the new column position, and
insert a matching `""` (no explicit alignment) into `align` at the same position.

**Delete Row** — acts when cursor is on a data row (removes that row) or on the header
(removes the header row; the first remaining data row becomes the new header). No-ops when
cursor is on the separator row. No-ops whenever the result would leave zero data rows —
this applies uniformly to both plain data-row deletion and header-row deletion via
promotion, so a table with exactly a header + 1 data row cannot be shrunk further by Delete
Row from either row.

**Delete Column** — acts on any row. No-ops if the table has only 1 column (never deletes
down to a 0-column table). Removes that column's cell from every row in `rows` and its
entry from `align`.

### Cursor repositioning after edit

All six commands finish by calling `editor.setCursor` to the start of the cell the user was
conceptually left in:

- **Inserts**: the newly-inserted row/column, same column/row as before the insert.
- **Deletes**: the row/column that shifted into the deleted one's position (the following
  row/column, or the previous one if the last row/column was deleted).

This is a best-effort placement at the target cell's start position (not a content-aware
offset mapping), consistent with how `formatDocument`'s cursor restoration is already
described as best-effort in this codebase.

### Out of scope

- Escaped pipes (`\|`) inside table cells (matches `alignTables`' existing scope).
- Multi-row/column batch operations (e.g. inserting N rows at once) — one row/column per
  click, matching the grid picker's existing "pick exact size up front, edit incrementally
  after" split.
- Undo/redo beyond whatever Obsidian's editor already provides for `replaceRange`.
- Moving/reordering existing rows or columns (already covered for rows by the Layout tab's
  Move Line Up/Down, which works on any line including table rows).

## Testing

- `tests/ribbon/commands/actions/tableParsing.test.ts` (new): `findEnclosingTable` — cursor
  on header/separator/data row/outside any table, and a document with multiple separate
  tables (only the enclosing one is returned).
- `tests/ribbon/commands/actions/tableEdit.test.ts` (new): each of the six functions using
  the existing `createMockEditor` helper, covering:
  - happy path (correct cells inserted/removed, correct re-alignment, correct cursor
    position);
  - no-op when cursor isn't in a table;
  - each command's specific no-op precondition (Insert Row Above from header/separator;
    Delete Row from separator; Delete Row leaving 0 data rows, including via header
    promotion; Delete Column at 1 remaining column);
  - header-promotion behavior for Delete Row on the header line.
- `tests/ribbon/commands/actions/formatMarkdown.test.ts` (existing): unchanged behavior,
  re-run to confirm the `tableParsing.ts` extraction didn't change `alignTables`' output.
