# Table Edit Button Compact Grid — Design

## Problem

The "Tables" ribbon group currently renders 7 buttons in a single flat row inside
`.ribbon-group-buttons`: the Table insert grid-picker, then Insert Row Above, Insert Row
Below, Insert Column Left, Insert Column Right, Delete Row, and Delete Column — all at the
same full icon-above-label size. That row is visually wide and the six table-edit actions
don't read as a related cluster.

## Goal

Keep the Table insert button (the grid-picker) at its current full size. Arrange the
remaining six table-edit actions as a compact 3-column × 2-row grid of icon-only buttons,
placed immediately next to the Table button within the same group row. Tooltips (via the
existing `title`/`aria-label` attributes) must still show each button's full label on
hover, since the visible text label is being dropped for these buttons.

## Design

### Architecture

Add an optional `compact?: boolean` field to `CommandEntry` (`registry.ts`). Mark the six
table-edit action entries as `compact: true`. `Group.svelte` partitions a group's commands
into the existing full-size set and the new compact set, rendering the compact set inside
one grid wrapper placed as a sibling flex item right after the full-size buttons — so it
lands directly beside the Table button without changing anything about how other groups
(Font, Paragraph, Links, Media, Code, Illustrations, Properties) render, since none of
their commands set `compact`.

### `registry.ts`

- `CommandEntry` gains: `compact?: boolean;`
- The six table-edit entries (`table-insert-row-above`, `table-insert-row-below`,
  `table-insert-column-left`, `table-insert-column-right`, `table-delete-row`,
  `table-delete-column`) each get `compact: true`.
- Reorder those six entries (they stay in the `Tables` group, unchanged `id`/`icon`/
  `label`/`action`) to: Row Above, Column Left, Delete Row, Row Below, Column Right,
  Delete Column. `Group.svelte` renders compact commands in array order into a row-major
  CSS grid, so this order produces:

  ```
  [↑ Row Above]  [◄ Col Left]   [x Delete Row]
  [↓ Row Below]  [► Col Right]  [x Delete Col]
  ```

### `Group.svelte`

Precompute two derived arrays from the `commands` prop:

```ts
let mainCommands = $derived(commands.filter((c) => !c.compact));
let compactCommands = $derived(commands.filter((c) => c.compact));
```

Render `mainCommands` exactly as today (the existing `{#if command.grid}` /
`{:else if command.options}` / `{:else}` branches, unchanged). After that `{#each}`, if
`compactCommands.length > 0`, render one new wrapper:

```svelte
{#if compactCommands.length > 0}
  <div class="ribbon-compact-grid">
    {#each compactCommands as command (command.id)}
      <Button {command} {editor} {app} compact />
    {/each}
  </div>
{/if}
```

Both the existing `{#each mainCommands}` block and this wrapper live inside the same
`.ribbon-group-buttons` flex container, so the compact grid sits as one flex item next to
the Table button's `TablePicker`.

### `Button.svelte`

Add a `compact` prop (default `false`):

```ts
let { command, editor, app, compact = false }: { ...; compact?: boolean } = $props();
```

- Apply `class:ribbon-button-compact={compact}` on the `<button>` alongside the existing
  `ribbon-button` class.
- Omit the `<span class="ribbon-button-label">` element when `compact` is true — only the
  icon renders. `title`/`aria-label` (already set to `command.label` unconditionally) are
  untouched, so hovering a compact button still shows a native tooltip with its full name
  (e.g. "Delete Column").
- Click handling (`handleClick`) is unchanged.

### `styles.css`

Add two new rules:

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

`.ribbon-button-compact` inherits `display: flex; align-items: center; justify-content:
center` etc. from the existing `.ribbon-button` rule, so no icon-only-specific centering
logic is needed beyond dropping the label span and shrinking padding/icon size.

### Out of scope

- Any change to the Table insert button / `TablePicker.svelte` — it keeps its current
  full size and behavior.
- A generic "compact" mode for other ribbon groups — no other group's commands set
  `compact` in this change.
- Keyboard navigation changes to the compact grid (matches the existing lack of grid
  keyboard nav in `TablePicker.svelte`).

## Testing

- No new unit-testable logic is introduced — this is a pure layout/rendering change
  (component markup + CSS + a registry field/reorder). Existing `tableEdit.test.ts`
  action-function tests are unaffected since the action functions themselves don't change.
- Verify manually in Obsidian: the Tables group shows the Table button at full size,
  followed by a 3×2 grid of icon-only buttons in the specified order, each showing its
  full label as a tooltip on hover, and each still performing its existing action on
  click.
