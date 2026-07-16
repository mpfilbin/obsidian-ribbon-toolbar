# Callout Type Picker Modal — Design

## Summary

Clicking the "Callout" button in either the Insert or References ribbon currently inserts a hardcoded `> [!note] Title\n> ` block. This feature replaces that with an Obsidian `FuzzySuggestModal` that lets the user pick a callout type first, then inserts the block with the chosen type.

## Goals

- Clicking "Callout" (Insert tab) or "Callout" (References tab) opens a fuzzy-search modal listing Obsidian's built-in callout types.
- Choosing a type inserts `> [!<type>] Title\n> ` at the cursor, matching the existing insertion shape/placeholder.
- Canceling the modal (Esc / click-away) inserts nothing and returns focus to the editor.

## Non-goals

- No user-configurable callout type list (no settings-tab entry for this, unlike `frontmatterProperties`).
- No color/icon previews in the picker — plain type-name list.
- No change to how any other ribbon command works.

## Callout type list

Hardcoded, in this order (includes Obsidian's built-in aliases so the user can search by whichever name they think of):

```
note, abstract, summary, tldr, info, todo, tip, hint, important, success, check, done,
question, help, faq, warning, caution, attention, failure, fail, missing, danger, error,
bug, example, quote, cite
```

## Architecture

### New interaction kind: `modal`

`CommandEntry` currently supports two interaction kinds:
- `action: (editor: EditorLike) => void` — fire-and-forget, `Button.svelte` calls it then immediately calls `editor.focus()`.
- `options: CommandOption[]` — renders `Dropdown.svelte`, a lightweight in-page menu.

Neither fits a modal: opening a modal is asynchronous, and immediately calling `editor.focus()` after opening it (as `Button.svelte` does today) would yank keyboard focus away from the modal's search input before the user can type.

Add a third kind:

```ts
// registry.ts
export interface CommandEntry {
  id: string;
  tab: TabId;
  group: string;
  icon: string;
  label: string;
  action?: (editor: EditorLike, app: App) => void;
  options?: CommandOption[];
  modal?: (editor: EditorLike, app: App) => void;
}
```

(`action`'s signature gains an unused-by-most `app` param for consistency; existing action implementations with a single `(editor)` parameter remain valid — TypeScript allows assigning a function with fewer parameters to a wider function type.)

`Button.svelte` behavior:
- If `command.modal` is set: call `command.modal(editor, app)` and do **not** call `editor.focus()` afterward. The modal implementation is responsible for focus once it resolves (choose or cancel).
- Otherwise: existing behavior (`command.action(editor, app); editor.focus();`).

`Dropdown.svelte` is unaffected (no modal-based dropdown options exist).

### Threading `App` down to ribbon buttons

`app: App` needs to reach `Button.svelte` alongside `editor`. Thread it as a plain (non-store) prop through the same chain `editor` already takes:

```
main.ts (this.app)
  → RibbonManager constructor (new `app` option, stored on the instance)
    → mount(RibbonBar, { props: { ..., app } })
      → RibbonBar.svelte → RibbonPanel.svelte → Group.svelte → Button.svelte
```

Each intermediate `.svelte` file adds `app: App` to its props type and passes it through unchanged — same pattern already used for `propertiesStore`.

### New file: `calloutModal.ts`

`src/ribbon/commands/actions/calloutModal.ts`:

```ts
import { App, FuzzySuggestModal } from "obsidian";
import type { EditorLike } from "./types";
import { insertAtCursor } from "./helpers";

const CALLOUT_TYPES = [
  "note", "abstract", "summary", "tldr", "info", "todo", "tip", "hint", "important",
  "success", "check", "done", "question", "help", "faq", "warning", "caution",
  "attention", "failure", "fail", "missing", "danger", "error", "bug", "example",
  "quote", "cite",
];

class CalloutSuggestModal extends FuzzySuggestModal<string> {
  constructor(app: App, private editor: EditorLike) {
    super(app);
    this.setPlaceholder("Choose a callout type");
  }

  getItems(): string[] {
    return CALLOUT_TYPES;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    insertAtCursor(this.editor, `> [!${item}] Title\n> `);
    this.editor.focus();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openCalloutModal(editor: EditorLike, app: App): void {
  new CalloutSuggestModal(app, editor).open();
}
```

Note: `onClose` runs after every close, including after a successful choice (Obsidian calls `onChooseItem` then closes, triggering `onClose`) — calling `editor.focus()` twice in that path is harmless (idempotent).

### Registry changes

`registry.ts`:
- `callout` entry (Insert tab): replace `action: insertActions.insertCallout` with `modal: openCalloutModal`.
- `ref-callout` entry (References tab): same replacement.
- Remove `insertCallout` from `insert.ts` — confirmed only referenced by the two registry entries above and by `tests/ribbon/commands/actions/insert.test.ts` (its test case moves to a `calloutModal.test.ts`).

## Testing

- Unit: `calloutModal.ts` logic (`getItems`, `getItemText`, `onChooseItem`'s inserted text) — can test `onChooseItem` against a fake `EditorLike` without needing a real Obsidian `App`/DOM, matching existing action tests.
- Manual (per project convention): open the vault, click Callout in Insert tab, verify modal opens with fuzzy search, choose a type, verify correct block inserted and cursor/focus lands correctly; verify Esc cancels cleanly; repeat for References tab's Callout button.

## Files touched

- `src/ribbon/commands/registry.ts` — new `modal` field on `CommandEntry`, `callout`/`ref-callout` entries updated.
- `src/ribbon/commands/actions/insert.ts` — remove `insertCallout`.
- `src/ribbon/commands/actions/calloutModal.ts` — new.
- `tests/ribbon/commands/actions/insert.test.ts` — remove its `insertCallout` test case.
- `tests/ribbon/commands/actions/calloutModal.test.ts` — new, tests `onChooseItem` insertion text against a fake `EditorLike`.
- `src/ribbon/RibbonManager.ts` — accept/store/pass `app`.
- `src/ribbon/components/RibbonBar.svelte`, `RibbonPanel.svelte`, `Group.svelte`, `Button.svelte` — thread `app` prop; `Button.svelte` special-cases `command.modal`.
- `src/main.ts` — pass `this.app` into `new RibbonManager({...})`.
