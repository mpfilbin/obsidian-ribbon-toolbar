# Ribbon Bar — Obsidian Plugin Design (v1)

## Summary

An Obsidian plugin that adds a Microsoft Office–style multi-tab editing ribbon docked
above each Markdown editor pane. The ribbon exposes common Markdown formatting and
document-structure actions as grouped icon buttons across four tabs (Home, Insert,
Layout, References), styled to match the user's active Obsidian theme, and collapsible
like the Office ribbon to save vertical space.

## Goals (v1)

- A ribbon docked at the top of every open Markdown editor pane (not global — one per
  pane, so split panes each get an independently functioning ribbon).
- Visible in all three view modes (Source, Live Preview, Reading), though action
  buttons are disabled in Reading view since there's no live editor to act on.
- Theme-native styling via Obsidian's CSS custom properties — no hardcoded colors.
- Collapsible/expandable per pane, Office-style (double-click a tab to collapse to
  just the tab strip).
- Four tabs of stateless action buttons (no "active formatting" highlighting in v1).
- Minimal plugin settings: enable/disable the ribbon globally, and a default
  collapsed/expanded state for newly opened ribbons.
- Desktop only (`isDesktopOnly: true`).

## Non-goals (v1)

- Mobile/touch support.
- Buttons reflecting live cursor formatting state (e.g. Bold highlighted when inside
  bold text) — deferred; the command registry is structured so this can be added later
  without restructuring.
- Per-tab or per-button user customization (show/hide tabs, reorder buttons).
- Persisting per-pane collapse state back to settings — it resets to the configured
  default each time a pane is opened.

## Architecture

### Attachment strategy

- `main.ts` is the plugin entry point. On load it constructs a `RibbonManager` and
  registers workspace event listeners: `active-leaf-change`, `layout-change`, and
  `file-open`.
- `RibbonManager` tracks currently-known leaves in a `WeakMap<MarkdownView,
  RibbonInstance>`. For each open `MarkdownView` it doesn't yet know about, it mounts a
  Svelte `RibbonBar` component as the first child of that view's `.view-content`
  element. `.view-content` is a common ancestor of both the CM6 editor
  (`.markdown-source-view`, used for Source and Live Preview) and the Reading view's
  rendered HTML, so **one ribbon instance per leaf covers all three display modes**
  without needing to remount on mode switch.
- On leaf close/detach, `RibbonManager` unmounts the corresponding Svelte component and
  removes it from the `WeakMap`.
- Each `RibbonBar` instance is bound to **its own leaf's `Editor` object** (obtained
  from that `MarkdownView`), not a single globally-"active" editor — this is what makes
  split-pane ribbons work independently.
- Button actions call Obsidian's standard `Editor` API (`replaceSelection`,
  `getCursor`, `somethingSelected`, etc.), which behaves identically in Source and Live
  Preview.

**Known risk:** `.view-content` is part of Obsidian's internal DOM structure, not
public API, and could change between Obsidian versions. The "find the injection point"
logic is isolated into one small function in `RibbonManager` so there is a single place
to fix if Obsidian's internals shift. This is a risk accepted by every existing
toolbar-style Obsidian plugin (e.g. "Editing Toolbar").

### Components (Svelte, one tree instance per leaf)

- `RibbonBar.svelte` — root; owns collapsed/expanded state (local component state,
  initialized from `settings.defaultCollapsed`) and which tab is active. Renders the
  tab strip and, when expanded, the active tab's `RibbonPanel`.
- `Tab.svelte` — one tab-strip entry. Click switches the active tab; double-click
  toggles the collapsed state (Office-style).
- `RibbonPanel.svelte` — renders the `Group`s belonging to the active tab.
- `Group.svelte` — a labeled cluster of related buttons (e.g. "Font", "Paragraph").
- `Button.svelte` — icon + label; invokes its bound action on click. Disabled when the
  pane is in Reading view (no editor to act on).
- `Dropdown.svelte` — a `Button` variant for multi-option commands (e.g. heading level
  picker, table size picker).

### Command registry

`ribbon/commands/registry.ts` is a declarative config describing every ribbon button,
independent of the UI layer:

```ts
type CommandEntry = {
  id: string;
  tab: "home" | "insert" | "layout" | "references";
  group: string;
  icon: string;   // Obsidian icon id
  label: string;
  action: (editor: Editor) => void;
};
```

`action` implementations live in `ribbon/commands/actions.ts` as pure functions taking
an `Editor`-shaped interface. Adding a new button in the future is one registry entry
plus one action function — no component/UI changes required.

### v1 command list (draft, adjustable via the registry)

- **Home**: Bold, Italic, Strikethrough, Highlight, Heading 1–3 (dropdown), Bullet
  list, Numbered list, Checklist, Blockquote, Inline code, Clear formatting
- **Insert**: Link, Internal link (wikilink), Image, Table, Horizontal rule, Code
  block, Callout, Tag
- **Layout**: Heading level promote/demote, List indent/outdent, Move line up/down,
  Insert table of contents
- **References**: Footnote, Internal link, Tag, Callout

### Settings

`settings.ts` defines:

```ts
interface RibbonBarSettings {
  ribbonEnabled: boolean;
  defaultCollapsed: boolean;
}
```

Persisted via the plugin's `loadData`/`saveData`. A `PluginSettingTab` exposes both as
toggles. Toggling `ribbonEnabled` immediately mounts/unmounts ribbons on all
currently-open leaves — no reload required.

### Data flow / state ownership

- **Global, persisted**: `ribbonEnabled`, `defaultCollapsed` (plugin settings).
- **Per-leaf, session-only**: which tab is active, collapsed/expanded state — owned by
  that leaf's `RibbonBar` instance, reset to `defaultCollapsed` each time the pane is
  (re)opened, never written back to settings.
- **Per-action**: the target `Editor` is passed directly into the action function at
  call time; no shared/global editor reference is cached beyond the `RibbonInstance`
  binding set up at mount time.

## Error handling

- `RibbonManager` guards against double-mounting the same leaf (checked via the
  `WeakMap`) and against invoking actions on a leaf that's mid-teardown (e.g. the file
  is being closed when a click event fires).
- Action functions never assume a selection exists: each defines both a "wrap
  selection" behavior and an "insert placeholder text and position the cursor inside
  it" behavior for the no-selection case (standard Word-style affordance), e.g. Bold
  wraps existing selected text in `**…**`, or inserts `****` with the cursor placed
  between the markers if nothing is selected.
- If the DOM injection point (`.view-content`) can't be found for a given leaf, the
  manager logs a console warning and skips that leaf rather than throwing.

## Styling

Exclusively uses Obsidian's CSS custom properties (`--background-secondary`,
`--text-normal`, `--interactive-accent`, etc.) so the ribbon adapts to any
light/dark/community theme without a theme-detection code path. Layout/structure
(tabs, groups, buttons) is Office-like; colors are theme-native.

## Testing approach

- `ribbon/commands/actions.ts` is pure functions over a minimal `Editor`-shaped
  interface, unit-testable with **vitest** using a mocked editor — no real Obsidian
  runtime required. This is the highest-value, easiest-to-test layer and should have
  the most thorough coverage.
- Svelte components are verified manually in a real Obsidian dev vault via hot-reload
  rather than component-tested in v1 — full editor-integration behavior (DOM injection
  timing, mode switching, split panes) is hard to meaningfully mock and is better
  caught by exercising the real app.

## Project layout / tooling

Standard Obsidian sample-plugin base (esbuild), with `esbuild-svelte` added for
Svelte compilation, and `isDesktopOnly: true` in the manifest. Uses **Svelte 5**
(current stable, runes-based) for component state/reactivity, mounted/unmounted per
leaf via Svelte 5's `mount`/`unmount` APIs.

```
ribbon-bar/
  manifest.json
  package.json
  esbuild.config.mjs
  tsconfig.json
  src/
    main.ts
    settings.ts
    ribbon/
      RibbonManager.ts
      commands/
        registry.ts
        actions.ts
        types.ts
      components/
        RibbonBar.svelte
        Tab.svelte
        RibbonPanel.svelte
        Group.svelte
        Button.svelte
        Dropdown.svelte
    styles.css
```
