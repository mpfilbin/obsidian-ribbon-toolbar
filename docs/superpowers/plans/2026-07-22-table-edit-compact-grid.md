# Table Edit Button Compact Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Insert tab's Tables group, keep the Table insert grid-picker at full size, and render the six table row/column editing buttons (Insert Row Above/Below, Insert Column Left/Right, Delete Row, Delete Column) as a compact 3-column × 2-row grid of icon-only buttons placed next to it.

**Architecture:** `CommandEntry` gains an optional `compact?: boolean` field. The six table-edit registry entries are reordered and flagged `compact: true` so their array order (row-major) matches the desired 3×2 visual grid. `Group.svelte` partitions its `commands` prop into `mainCommands` (unchanged rendering) and `compactCommands`, rendering the latter inside one new `.ribbon-compact-grid` wrapper as a sibling flex item next to the main buttons. `Button.svelte` gains a `compact` prop that hides the text label and applies a smaller-icon class, while leaving `title`/`aria-label` (and thus the hover tooltip) untouched.

**Tech Stack:** TypeScript, Svelte 5 (runes: `$derived`, `$props`), Obsidian Plugin API, Vitest.

## Global Constraints

- `CommandEntry.compact?: boolean` — new field; only the six table-edit entries set it. The `table` grid-picker entry does not set it (stays full-size).
- Registry order for the six compact entries must be: `table-insert-row-above`, `table-insert-column-left`, `table-delete-row`, `table-insert-row-below`, `table-insert-column-right`, `table-delete-column` — `Group.svelte` renders compact commands in array order into a row-major 3-column CSS grid, so this exact order produces the required 3×2 layout (Row Above / Col Left / Delete Row on top, Row Below / Col Right / Delete Col on bottom).
- `Button.svelte`'s `compact` prop must not remove or alter `title`/`aria-label` — those already equal `command.label` unconditionally, and are what makes the hover tooltip work once the visible label span is omitted.
- No Svelte component in this codebase (`Button.svelte`, `Dropdown.svelte`, `Group.svelte`, `TablePicker.svelte`) has a direct unit test, and there is no component-testing setup in this repo's dependencies — this plan follows that existing convention. Component changes are verified via `npm run typecheck`, `npm test` (no regressions), `npm run build`, and manual testing in Obsidian (Task 4).

---

## Task 1: Add `compact` field and reorder/flag the table-edit registry entries

**Files:**
- Modify: `src/ribbon/commands/registry.ts:19-29` (interface), `:150-198` (Tables group entries)
- Test: `tests/ribbon/commands/registry.test.ts`

**Interfaces:**
- Produces: `CommandEntry.compact?: boolean` — consumed by Task 2's `Group.svelte` partitioning logic and Task 3's `Button.svelte` prop.

- [ ] **Step 1: Write the failing tests**

In `tests/ribbon/commands/registry.test.ts`, replace the existing `"table row/column editing commands are direct actions in the Insert tab's Tables group"` test (and add two new tests right after it) so the relevant section reads:

```ts
  it("table row/column editing commands are direct actions in the Insert tab's Tables group", () => {
    const tableEditingCommands = [
      { id: "table-insert-row-above", expectedAction: insertRowAbove },
      { id: "table-insert-row-below", expectedAction: insertRowBelow },
      { id: "table-insert-column-left", expectedAction: insertColumnLeft },
      { id: "table-insert-column-right", expectedAction: insertColumnRight },
      { id: "table-delete-row", expectedAction: deleteRow },
      { id: "table-delete-column", expectedAction: deleteColumn },
    ];
    for (const { id, expectedAction } of tableEditingCommands) {
      const entry = COMMAND_REGISTRY.find((e) => e.id === id);
      expect(entry?.tab).toBe("insert");
      expect(entry?.group).toBe("Tables");
      expect(entry?.action).toBe(expectedAction);
      expect(entry?.compact).toBe(true);
    }
  });

  it("table row/column editing commands appear in the registry in 3x2 grid reading order", () => {
    const compactIds = COMMAND_REGISTRY.filter((entry) => entry.compact).map((entry) => entry.id);
    expect(compactIds).toEqual([
      "table-insert-row-above",
      "table-insert-column-left",
      "table-delete-row",
      "table-insert-row-below",
      "table-insert-column-right",
      "table-delete-column",
    ]);
  });

  it("the Table insert grid-picker command is not compact", () => {
    const table = COMMAND_REGISTRY.find((entry) => entry.id === "table");
    expect(table?.compact).toBeFalsy();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- registry.test`
Expected: FAIL — `entry?.compact` is `undefined` for all six table-edit entries (so `.toBe(true)` fails), and the array-order test fails because `compactIds` is currently `[]` (no entry has `compact` set yet).

- [ ] **Step 3: Add the `compact` field and update the Tables group entries**

In `src/ribbon/commands/registry.ts`, add `compact?: boolean;` to `CommandEntry` (after the existing `grid` field):

```ts
export interface CommandEntry {
  id: string;
  tab: TabId;
  group: string;
  icon: string;
  label: string;
  action?: (editor: EditorLike) => void;
  options?: CommandOption[];
  modal?: (editor: EditorLike, app: App) => void;
  grid?: (editor: EditorLike, columns: number, rows: number) => void;
  compact?: boolean;
}
```

Replace the six table-edit entries (currently `table-insert-row-above` through `table-delete-column`, right after the `table` entry) with this reordered, flagged block:

```ts
  {
    id: "table-insert-row-above",
    tab: "insert",
    group: "Tables",
    icon: "arrow-up-to-line",
    label: "Insert Row Above",
    action: tableEdit.insertRowAbove,
    compact: true,
  },
  {
    id: "table-insert-column-left",
    tab: "insert",
    group: "Tables",
    icon: "arrow-left-to-line",
    label: "Insert Column Left",
    action: tableEdit.insertColumnLeft,
    compact: true,
  },
  {
    id: "table-delete-row",
    tab: "insert",
    group: "Tables",
    icon: "rows-3",
    label: "Delete Row",
    action: tableEdit.deleteRow,
    compact: true,
  },
  {
    id: "table-insert-row-below",
    tab: "insert",
    group: "Tables",
    icon: "arrow-down-to-line",
    label: "Insert Row Below",
    action: tableEdit.insertRowBelow,
    compact: true,
  },
  {
    id: "table-insert-column-right",
    tab: "insert",
    group: "Tables",
    icon: "arrow-right-to-line",
    label: "Insert Column Right",
    action: tableEdit.insertColumnRight,
    compact: true,
  },
  {
    id: "table-delete-column",
    tab: "insert",
    group: "Tables",
    icon: "columns-3",
    label: "Delete Column",
    action: tableEdit.deleteColumn,
    compact: true,
  },
```

The `table` entry directly above this block (`{ id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", grid: insertActions.insertTableGrid }`) is unchanged — it does not get `compact`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- registry.test`
Expected: PASS — all tests in `registry.test.ts` green, including the three from Step 1.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/registry.ts tests/ribbon/commands/registry.test.ts
git commit -m "feat: add compact field to CommandEntry, reorder table-edit entries for 3x2 grid"
```

---

## Task 2: Add a `compact` prop to `Button.svelte`

**Files:**
- Modify: `src/ribbon/components/Button.svelte`

**Interfaces:**
- Consumes: `CommandEntry.compact` is NOT read here directly — `compact` is passed in explicitly as a prop by the caller (Task 3's `Group.svelte`), decoupling `Button` from knowing about `CommandEntry` fields it doesn't otherwise use.
- Produces: `Button.svelte` accepts `compact?: boolean` (default `false`) as a prop, applying a `ribbon-button-compact` class and omitting the visible label span when `true`.

- [ ] **Step 1: Modify `Button.svelte`**

Replace the contents of `src/ribbon/components/Button.svelte`:

```svelte
<script lang="ts" module>
  import { setIcon } from "obsidian";

  export function icon(node: HTMLElement, iconId: string) {
    setIcon(node, iconId);
    return {
      update(newIconId: string) {
        setIcon(node, newIconId);
      },
    };
  }
</script>

<script lang="ts">
  import type { App } from "obsidian";
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";

  let {
    command,
    editor,
    app,
    compact = false,
  }: { command: CommandEntry; editor: EditorLike | null; app: App; compact?: boolean } = $props();

  function handleClick() {
    if (!editor) return;
    if (command.modal) {
      command.modal(editor, app);
      return;
    }
    if (!command.action) return;
    command.action(editor);
    editor.focus();
  }
</script>

<button
  class="ribbon-button"
  class:ribbon-button-compact={compact}
  type="button"
  title={command.label}
  aria-label={command.label}
  disabled={!editor}
  onclick={handleClick}
>
  <span class="ribbon-button-icon" use:icon={command.icon}></span>
  {#if !compact}
    <span class="ribbon-button-label">{command.label}</span>
  {/if}
</button>
```

The only changes from the current file: the `compact` prop (defaulting to `false`), the `class:ribbon-button-compact={compact}` binding, and wrapping the label span in `{#if !compact}`. `title`/`aria-label` stay exactly as they were — unconditional and equal to `command.label` — so the tooltip still shows the full label on hover even when `compact` is true.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (No test file targets `Button.svelte` directly — see Global Constraints.)

- [ ] **Step 3: Commit**

```bash
git add src/ribbon/components/Button.svelte
git commit -m "feat: add compact icon-only rendering mode to Button.svelte"
```

---

## Task 3: Render compact commands in a 3-column grid in `Group.svelte`, add CSS

**Files:**
- Modify: `src/ribbon/components/Group.svelte`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `CommandEntry.compact` (Task 1), `Button`'s `compact` prop (Task 2).
- Produces: `.ribbon-compact-grid` CSS class used only by this component's new wrapper `<div>`.

- [ ] **Step 1: Modify `Group.svelte`**

Replace the contents of `src/ribbon/components/Group.svelte`:

```svelte
<script lang="ts">
  import type { App } from "obsidian";
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import Button from "./Button.svelte";
  import Dropdown from "./Dropdown.svelte";
  import TablePicker from "./TablePicker.svelte";

  let {
    label,
    commands,
    editor,
    app,
  }: { label: string; commands: CommandEntry[]; editor: EditorLike | null; app: App } = $props();

  let mainCommands = $derived(commands.filter((c: CommandEntry) => !c.compact));
  let compactCommands = $derived(commands.filter((c: CommandEntry) => c.compact));
</script>

<div class="ribbon-group">
  <div class="ribbon-group-buttons">
    {#each mainCommands as command (command.id)}
      {#if command.grid}
        <TablePicker {command} {editor} />
      {:else if command.options}
        <Dropdown {command} {editor} />
      {:else}
        <Button {command} {editor} {app} />
      {/if}
    {/each}
    {#if compactCommands.length > 0}
      <div class="ribbon-compact-grid">
        {#each compactCommands as command (command.id)}
          <Button {command} {editor} {app} compact />
        {/each}
      </div>
    {/if}
  </div>
  <div class="ribbon-group-label">{label}</div>
</div>
```

Compact commands are assumed to always be plain actions (no `grid`/`options`/`modal`) — true for all six table-edit entries — so they're rendered directly as `<Button ... compact />` without the `TablePicker`/`Dropdown` branches `mainCommands` uses.

- [ ] **Step 2: Add compact grid CSS**

In `styles.css`, add these two rules directly after the existing `.ribbon-button-label` rule (before the `.ribbon-dropdown` rule):

```css
.ribbon-compact-grid {
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 4px;
}

.ribbon-button-compact {
  padding: 6px;
}

.ribbon-button-compact .ribbon-button-icon {
  width: 14px;
  height: 14px;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS — no regressions. There is no direct test for `Group.svelte` (see Global Constraints).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/ribbon/components/Group.svelte styles.css
git commit -m "feat: render compact table-edit buttons in a 3x2 grid next to the Table button"
```

---

## Task 4: Manually verify in Obsidian

Component rendering changes (Task 2, Task 3) cannot be exercised by the test suite (see Global Constraints) — this task is the real verification that the layout and tooltips work as designed. Do not skip it or consider the feature done without it.

**Files:** none (build artifacts only)

- [ ] **Step 1: Build the plugin**

Run: `npm run build`
Expected: succeeds, updates `main.js`, `styles.css`, `manifest.json` in the project root.

- [ ] **Step 2: Copy the build into the dev vault**

```bash
cp main.js styles.css manifest.json /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

- [ ] **Step 3: Reload the plugin in Obsidian**

In the dev vault, open Settings → Community plugins, toggle "Ribbon Bar" off and back on (or use "Reload app without saving") to load the new `main.js`/`styles.css`.

- [ ] **Step 4: Exercise the golden path**

1. Open any note, switch to the Insert tab in the ribbon bar.
2. Confirm the Tables group shows the full-size "Table" button first (icon + "Table" label, unchanged from before), immediately followed by a compact 3-column × 2-row grid of six small icon-only buttons with no visible text labels.
3. Confirm the top row reads (left to right): Insert Row Above, Insert Column Left, Delete Row. Confirm the bottom row reads: Insert Row Below, Insert Column Right, Delete Column.
4. Hover over each of the six compact buttons one at a time and confirm a native tooltip appears showing its full label (e.g. "Insert Row Above", "Delete Column").
5. Place the cursor inside an existing markdown table and click each of the six compact buttons in turn, confirming each still performs its existing action correctly (row/column inserted or deleted in the right place) — same behavior as before this change, just via the new compact buttons.

- [ ] **Step 5: Exercise edge cases**

1. Confirm the "Table" grid-picker button still opens its 10×8 hover/click popover correctly and is visually unchanged (full size, icon + label) — this task's changes should not have touched it.
2. Resize the Obsidian window narrower and confirm the Tables group's horizontal-scroll behavior (via `.ribbon-panel`'s `overflow-x: auto`) still works with the new compact grid in place — the group doesn't visually break or overlap neighboring groups.
3. With no editor open/focused, confirm all six compact buttons render disabled (dimmed, not clickable) just like the other ribbon buttons do when there's no active editor.

- [ ] **Step 6: Report results**

If every check in Steps 4-5 passes, the feature is verified — no commit needed for this task. If anything looks visually off (spacing, icon size, row/column order) or a tooltip/action doesn't work, fix the underlying code in Task 2/3's files, re-run `npm test` and `npm run typecheck`, rebuild, and re-verify before considering the feature complete.

---

## Self-Review Notes

- **Spec coverage:** `compact` field and registry reorder (Task 1), `Button.svelte` icon-only compact rendering with preserved tooltip (Task 2), `Group.svelte` partitioning + `.ribbon-compact-grid` CSS placing the grid next to the full-size Table button (Task 3), manual confirmation of layout/order/tooltips/actions and that the Table picker itself is untouched (Task 4). Out-of-scope items from the spec (no generic compact mode for other groups, no keyboard nav changes) are naturally satisfied — no other group's commands set `compact`, and no keyboard-nav code was added. No gaps found.
- **Placeholders:** none — every step has literal code, literal shell commands, or a concrete manual-verification checklist.
- **Type consistency:** `CommandEntry.compact?: boolean` (Task 1) is read by `Group.svelte`'s `commands.filter((c: CommandEntry) => c.compact)` / `!c.compact` (Task 3) and matches the `compact?: boolean` prop type on `Button.svelte` (Task 2). The six-entry order asserted in Task 1's test (`table-insert-row-above`, `table-insert-column-left`, `table-delete-row`, `table-insert-row-below`, `table-insert-column-right`, `table-delete-column`) matches the registry edit in Task 1 Step 3 and the row-major grid reading order verified in Task 4 Step 4.
