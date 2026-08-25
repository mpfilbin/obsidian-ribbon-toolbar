# Highlight Color (`<mark>`-based) — Design

## Summary

Replaces the single-color `==highlighted text==` Highlight button (Home >
Font) with a user-configurable palette of highlight colors, applied via
`<mark style="background-color: ...">...</mark>` instead of Obsidian's
native `==...==` syntax (which can't express a specific color). The palette
is edited in plugin settings and rendered as one "Highlight Color" dropdown
in the ribbon, each option showing a color swatch plus its name. A companion
settings feature scans the whole vault for existing `==...==` spans and lets
the user selectively migrate them to `<mark>` tags using the first
configured color.

## Goals

- A "Highlight colors" section in plugin settings where the user can add,
  remove, and edit colors (name + color value), mirroring the existing
  frontmatter-properties editor's UX.
- Ships with a sensible default palette (Yellow, Green, Blue, Pink, Purple)
  so the dropdown is useful immediately.
- One "Highlight Color ▾" ribbon dropdown on the Home tab's Font group,
  replacing the old `==...==` Highlight button. Each option shows a small
  color swatch and the color's name; choosing one wraps the selection (or
  inserts a placeholder, no selection) in `<mark style="background-color:
  <hex>;">...</mark>`.
- If the user removes every configured color, the dropdown disappears
  entirely (same behavior as the Properties group when no properties are
  configured) rather than rendering an empty menu.
- A "Scan vault for ==highlights==" button in settings that:
  - Reads every markdown file in the vault and counts `==...==` spans
    outside fenced code blocks.
  - Opens a review modal listing every file with at least one match (path +
    match count), each with an individual toggle, plus Select All /
    Deselect All controls and a "Migrate N files" confirm button.
  - On confirm, rewrites every selected file's `==text==` spans to
    `<mark style="background-color: <first configured color>;">text</mark>`,
    leaving already-existing `<mark>` tags and fenced code blocks untouched.
  - If no highlight colors are configured, the scan button is disabled with
    an explanatory note (there's no color to migrate to).

## Non-goals

- No per-match preview inside the review modal — file path + match count
  only, not the matched text itself.
- No progress indicator for very large vaults; the modal shows a simple
  "Scanning…" state while the scan promise is in flight.
- No handling of `==...==` spans that cross multiple lines — matched
  per-line, same inline-formatting scope as the rest of this codebase's
  wrap/strip helpers (`FORMATTING_MARKERS` in `home.ts` has the same
  per-line, non-multiline scope).
- No undo/rollback mechanism beyond Obsidian's own file-recovery core
  plugin; migration is a direct `vault.modify` per selected file.
- No reordering of the configured color list; add/remove/edit only (same
  restriction as frontmatter properties).
- No validation that a color name is unique or that a color value is a
  valid hex string beyond what Obsidian's native color picker component
  already enforces.

## Data model

```ts
export interface HighlightColorConfig {
  name: string;
  color: string; // hex, e.g. "#ffd700"
}
```

`RibbonBarSettings` gains `highlightColors: HighlightColorConfig[]`,
defaulting to:

```ts
[
  { name: "Yellow", color: "#ffd700" },
  { name: "Green", color: "#7bed9f" },
  { name: "Blue", color: "#70a1ff" },
  { name: "Pink", color: "#ff6b81" },
  { name: "Purple", color: "#c9a0ff" },
]
```

`cloneDefaultSettings()` gains the same per-array clone treatment already
given to `frontmatterProperties`, for the same reference-aliasing reason.

## Architecture

### Highlight action

- **`src/ribbon/commands/actions/highlightMark.ts`** (new) —
  `highlightWithColor(color: string): (editor: EditorLike) => void`, built
  on the existing `wrapSelection` helper:
  `wrapSelection(editor, \`<mark style="background-color: ${color};">\`, "</mark>", "highlighted text")`.
- `home.ts` loses `toggleHighlight` and the `==`-based highlight entirely
  (dead code once the static registry entry is removed).

### Registry / dynamic command

- `CommandOption` (registry.ts) gains an optional `swatch?: string` (a hex
  color) alongside `id`/`label`/`action`.
- `registry.ts` gains `buildHighlightColorCommands(colors:
  HighlightColorConfig[]): CommandEntry[]` — pure function returning either
  `[]` (no colors configured) or a single-element array: one
  `{ id: "highlight-color", tab: "home", group: "Font", icon: "highlighter",
  label: "Highlight Color", options: colors.map(c => ({ id: slug(c.name),
  label: c.name, swatch: c.color, action: highlightWithColor(c.color) })) }`.
  Mirrors `buildPropertyCommands`'s shape and its "pure function of the
  current config list" contract.
- The static `highlight` entry is deleted from `COMMAND_REGISTRY`.

### RibbonPanel merge generalization

Today `RibbonPanel.svelte` hardcodes a single dynamic-command source (the
References tab's frontmatter properties) and a single dynamic-group rule.
This is generalized to a small per-tab lookup so a second tab (Home) can
also inject dynamic commands, without inventing a bigger plugin system:

```ts
let dynamicCommands = $derived(
  tab === "references"
    ? buildPropertyCommands(properties)
    : tab === "home"
      ? buildHighlightColorCommands(highlightColors)
      : []
);
let dynamicGroups = $derived(tab === "references" && dynamicCommands.length > 0 ? ["Properties"] : []);
let groups = $derived([...groupsForTab(tab), ...dynamicGroups]);
let commands = $derived([...commandsForTab(tab), ...dynamicCommands]);
```

Highlight Color doesn't need a new group entry — "Font" already exists in
`groupsForTab("home")` from the other static Home commands, so the dynamic
entry just slots into the existing Font group via `Group.svelte`'s existing
`commands.filter(c => c.group === group)`. It renders after the other Font
buttons (order is append-only, same simplification frontmatter properties
already accepted for its group).

### Live store threading

Same pattern as `propertiesStore`:

- `RibbonManager` gains `highlightColorsStore: Writable<HighlightColorConfig[]>`,
  created once in the constructor, and `setHighlightColors(colors)` which
  calls `.set([...colors])` (fresh array reference, same reason
  `setFrontmatterProperties` does this).
- `RibbonBar.svelte` takes a `highlightColorsStore` prop and passes it
  through to `RibbonPanel.svelte` alongside `propertiesStore`.
- `plugin-contract.ts` / `main.ts` gain
  `setHighlightColors(colors: HighlightColorConfig[]): void`, wired the
  same way as `setFrontmatterProperties`.

### Dropdown swatch rendering

`Dropdown.svelte`'s option `<button>` gains a leading
`<span class="ribbon-dropdown-swatch" style="background-color: {option.swatch}">`
rendered only `{#if option.swatch}`. New CSS (`styles.css`):

```css
.ribbon-dropdown-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border-radius: 3px;
  border: 1px solid var(--background-modifier-border);
  vertical-align: middle;
}
```

### Settings UI

`settings-tab.ts` gains a "Highlight colors" section directly mirroring the
"Frontmatter properties" section: one `Setting` row per configured color
(name text field, Obsidian's native `addColorPicker`, delete button), plus
an "Add color" row (name field + color picker + Add button). Every mutation
saves settings and calls `this.plugin.setHighlightColors(...)`, then
`this.display()` to refresh the list — same as the properties section.

### Migration engine (pure logic)

**`src/ribbon/commands/actions/highlightMigration.ts`** (new), no `obsidian`
import — reuses `computeFenceLineKinds` (exported from `formatMarkdown.ts`)
so fenced code blocks are skipped the same way every other fence-aware
feature in this codebase already handles them:

- `countHighlights(text: string): number` — splits into lines, skips
  fenced lines via `computeFenceLineKinds`, counts `==(.*?)==` matches
  across the remaining lines (non-greedy, empty content allowed - same
  pattern `FORMATTING_MARKERS` already uses for `==...==` in `home.ts`,
  before that file's highlight entry is removed).
- `migrateHighlightsInText(text: string, color: string): string` — same
  line/fence walk, replacing each `==content==` match with
  `<mark style="background-color: ${color};">content</mark>` on non-fenced
  lines, leaving fenced lines untouched.

### Migration scan + review modal (Obsidian-dependent, manually verified)

**`src/ribbon/commands/actions/highlightMigrationModal.ts`** (new):

- `scanVaultForHighlights(app: App): Promise<{ file: TFile; count:
  number }[]>` — `app.vault.getMarkdownFiles()`, `cachedRead` each,
  `countHighlights`, filter `count > 0`.
- `HighlightMigrationModal extends Modal`:
  - `onOpen()`: shows a "Scanning…" state, awaits `scanVaultForHighlights`,
    then renders one `Setting` row per matched file (path as name, `N
    highlights` as description, `addToggle` defaulting to checked), a
    Select All / Deselect All control pair, and a "Migrate N files" button
    reflecting the live count of currently-checked rows. Shows "No
    ==highlights== found in this vault." when the scan returns empty.
  - Confirm handler: for each checked file, `vault.read` → `migrateHighlightsInText(content,
    firstColor)` → `vault.modify`; shows a completion `Notice` with the
    number of files migrated.
- `openHighlightMigrationModal(app: App, color: string): void` — thin
  entry point, called from the settings-tab button; the button itself is
  disabled (with explanatory text) when `highlightColors.length === 0`.

## Error handling

- Empty `highlightColors` list: dropdown vanishes from the ribbon (handled
  by `buildHighlightColorCommands` returning `[]`); the settings migration
  button is disabled rather than allowed to run with no target color.
- A color name left blank in the "Add color" row is rejected the same way
  an empty property name already is (trimmed, no-op if empty).
- Files that fail to read or write during migration are skipped with their
  error logged to console (`console.error`, matching this codebase's
  existing modal error-handling convention in `registry.ts`'s lazy-loaded
  modal openers) rather than aborting the whole batch.

## Testing approach

- `highlightMark.ts` (`highlightWithColor`) — unit tested with
  `createMockEditor`, same shape as every other wrap-selection action.
- `highlightMigration.ts` (`countHighlights`, `migrateHighlightsInText`) —
  unit tested with plain strings, including a fenced-code-block case
  proving matches inside fences are ignored (mirroring the existing
  `collectHeadings` fence-awareness test).
- `registry.ts`'s `buildHighlightColorCommands` — unit tested for the
  empty-list (`[]`) and populated-list (one dropdown entry with the right
  options/swatches/actions) cases, same style as `buildPropertyCommands`'s
  existing tests.
- `Dropdown.svelte`'s swatch rendering, the settings UI, and
  `HighlightMigrationModal` are manually verified in the dev vault —
  consistent with how every other Modal/Svelte-integration piece in this
  codebase is already verified rather than unit tested.
