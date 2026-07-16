# Frontmatter Properties — Design

## Summary

Adds a user-configurable set of "quick insert" buttons for YAML frontmatter
properties, appearing as a dynamic "Properties" group in the ribbon's
References tab. Each configured property has a name, an Obsidian property
type (matching Obsidian's own native Properties type picker), and an
optional default value. Clicking a property's button inserts it into the
note's frontmatter — creating the frontmatter block if needed — formatted
according to its type.

## Goals

- A "Frontmatter properties" section in plugin settings where the user can
  add, remove, and configure properties (name + type + optional default
  value).
- One ribbon button per configured property, in a "Properties" group on the
  References tab.
- Clicking a property button:
  - If the note has no frontmatter block yet, creates one containing just
    that property.
  - If frontmatter exists and the property isn't present, inserts it as a
    new line inside the existing block.
  - If frontmatter exists and the property is already present, moves the
    cursor to the end of that existing line (no duplicate key).
- Editing the property list in settings updates **every currently open
  pane's** ribbon immediately (not just newly opened panes) — the property
  list is a single shared, live value, unlike the per-pane `defaultCollapsed`
  seed.
- Supported types, matching Obsidian's native property type picker:
  Automatic (Text), Text, List, Number, Checkbox, Date, Date & time.

## Non-goals

- No validation that a typed value (e.g. a Number property's default) is
  actually well-formed — the user is trusted to enter sensible values, same
  spirit as the rest of v1's stateless buttons.
- No editing of an existing property's *value* beyond placing the cursor on
  its line — the user types the edit themselves.
- No reordering of the configured property list in settings; add/remove only.

## Data model

```ts
type PropertyType = "automatic" | "text" | "list" | "number" | "checkbox" | "date" | "datetime";

interface FrontmatterPropertyConfig {
  name: string;
  type: PropertyType;
  defaultValue?: string;
}
```

`RibbonBarSettings` gains `frontmatterProperties: FrontmatterPropertyConfig[]`,
defaulting to:

```ts
[
  { name: "tags", type: "list" },
  { name: "description", type: "text" },
  { name: "cssclasses", type: "list" },
  { name: "source", type: "text" },
]
```

## Insertion behavior by type

When a property has no configured `defaultValue`:

| Type | Inserted line(s) |
|---|---|
| Automatic / Text | `name: ` (empty, cursor after) |
| List | `name:` then `  - ` (one empty item, cursor after the dash) |
| Number | `name: ` (empty) |
| Checkbox | `name: false` (a blank value wouldn't render as a checkbox in Obsidian's Properties panel) |
| Date | `name: <today, YYYY-MM-DD>` |
| Date & time | `name: <now, YYYY-MM-DDTHH:mm>` |

When a `defaultValue` **is** configured: inserted verbatim for
Automatic/Text/Number/Checkbox/Date/Date & time. For List, the
`defaultValue` string is split on commas (each item trimmed) into multiple
`  - item` lines.

In all cases, the cursor is placed at the end of the last inserted line (or
after the dash, for an empty list item) so the user can start typing
immediately.

## Architecture

- **`src/ribbon/commands/actions/frontmatter.ts`** (new) — pure functions,
  no `obsidian` import, following the existing actions-file pattern:
  - `findFrontmatterRange(editor)` — locates the `---`...`---` block at the
    top of the document, if any.
  - `findPropertyLine(editor, range, name)` — locates an existing
    `name:`-prefixed line within that range (name is regex-escaped before
    matching, since property names are free-form user text).
  - `formatValueLines(config)` — pure formatter implementing the table
    above.
  - `insertOrLocateProperty(config: FrontmatterPropertyConfig): (editor: EditorLike) => void`
    — the exported action factory, composing the above.

- **`src/ribbon/commands/registry.ts`** gains
  `buildPropertyCommands(properties: FrontmatterPropertyConfig[]): CommandEntry[]`,
  a pure function mapping each config to a `CommandEntry` tagged
  `tab: "references", group: "Properties"`. This is **not** part of the
  static `COMMAND_REGISTRY` array — it's called at render time with the
  live property list.

- **Shared live store**: unlike the per-pane `editorStore`, the property
  list is one value shared across every open pane. `RibbonManager` owns a
  single `Writable<FrontmatterPropertyConfig[]>`, created once in its
  constructor and passed as the *same store instance* to every mounted
  `RibbonBar`. `RibbonManager.setFrontmatterProperties(properties)` calls
  `.set()` on it — every subscribed pane's ribbon updates in the same tick.

- **Component threading**: `RibbonBar.svelte` takes a new
  `propertiesStore: Writable<FrontmatterPropertyConfig[]>` prop and passes
  it straight through to `RibbonPanel.svelte` (no local derivation needed
  at the `RibbonBar` level, unlike `editorStore` which `RibbonBar` derives
  a plain value from — here `RibbonPanel` does the deriving since it's the
  component that needs to merge static + dynamic commands).

- **`RibbonPanel.svelte`** merges the static registry-driven groups/commands
  for the active tab with the dynamic Properties group (only when
  `tab === "references"` and the list is non-empty), via `$derived` on the
  store so it reacts to live updates.

- **Settings UI** (`settings-tab.ts`): a new section rendering one `Setting`
  row per configured property (name as the row label, a type dropdown, a
  default-value text field, and a delete button), plus a final row to add a
  new property (name text field + type dropdown + "Add" button). No built-in
  Obsidian component supports this, so it's hand-built with `Setting` rows
  that call `this.display()` again after any add/remove to refresh the list.
  Every mutation (add/remove/change type/change default value) saves
  settings and calls `this.plugin.setFrontmatterProperties(...)` so open
  panes update live.

- **`plugin-contract.ts`** gains
  `setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void`
  on `RibbonBarPluginLike` (a type-only import of `FrontmatterPropertyConfig`
  from the actions file — this doesn't reintroduce the forward-reference
  problem Task 8 avoided, since it's just a plain interface, not a
  dependency on `main.ts` or `RibbonManager`).

## Error handling

- Regex-escaping property names before building the "does this property
  already exist" pattern, since names are arbitrary user text and could
  otherwise contain regex metacharacters that break matching or throw.
- Adding a property with an empty/whitespace-only name is rejected in the
  settings UI (trimmed, no-op if empty) rather than allowed through to the
  registry.
- A note with a malformed/unclosed frontmatter block (opening `---` with no
  matching closing `---`) is treated as "no frontmatter" and a fresh block
  is inserted — same graceful-degradation spirit as the rest of v1, not a
  hard requirement to detect and repair malformed frontmatter.

## Testing approach

`frontmatter.ts` and the new `buildPropertyCommands` registry helper are
unit-tested with vitest using the existing `createMockEditor` mock, per the
established pattern. Date/Date & time "no default" cases are asserted with
a format-matching regex rather than an exact string, to avoid depending on
the current date/time. The settings UI and live-store propagation across
multiple panes are verified manually in a real Obsidian vault, consistent
with how the rest of the Svelte/DOM-integration layer was verified.
