# Callout Type Picker Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking "Callout" in the Insert or References ribbon opens a fuzzy-search modal of Obsidian's built-in callout types; choosing one inserts `> [!<type>] Title\n> ` at the cursor.

**Architecture:** Add a third `CommandEntry` interaction kind, `modal`, alongside the existing `action` and `options`. `Button.svelte` calls `command.modal(editor, app)` instead of `command.action(editor)` when present, and skips its usual immediate `editor.focus()` call (the modal owns focus until it closes). `App` is threaded down the existing prop chain (`RibbonManager` → `RibbonBar.svelte` → `RibbonPanel.svelte` → `Group.svelte` → `Button.svelte`) alongside `editor`. The modal itself is Obsidian's native `FuzzySuggestModal`.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vitest, Obsidian Plugin API (`FuzzySuggestModal`).

## Global Constraints

- The `obsidian` npm package is types-only (`"main": ""` in its package.json) — it has **no runtime JS module**. Any file that does a *value* import from `"obsidian"` (not `import type`) will crash if it's transitively loaded by a Vitest test (confirmed: `Error: Failed to resolve entry for package "obsidian"`). `registry.ts` and its test currently have zero runtime `obsidian` imports — this must not change, or `registry.test.ts` breaks.
- Because of the constraint above, `registry.ts` must reference the callout modal's opener function through a **dynamic `import()`** (lazy, evaluated only when a user actually clicks the button), never a static top-level import of `calloutModal.ts`. `import type { App }` (type-only) is fine anywhere — it's erased at compile time and never resolved at runtime.
- No settings-tab customization for callout types (hardcoded list only), per approved spec.
- No unit tests for files that make runtime `obsidian` imports (`calloutModal.ts`'s modal class, `RibbonManager.ts`, `main.ts`, `Button.svelte` and siblings) — this matches the existing project convention (none of `RibbonManager.ts`/`main.ts`/`settings-tab.ts` have unit tests today). These are verified via `npm run typecheck`, `npm run build`, and manual verification in a real Obsidian vault.

---

### Task 1: Pure callout type list and insertion-text helper

**Files:**
- Create: `src/ribbon/commands/actions/calloutTypes.ts`
- Test: `tests/ribbon/commands/actions/calloutTypes.test.ts`

**Interfaces:**
- Produces: `CALLOUT_TYPES: readonly string[]` (27 Obsidian built-in callout type names, including aliases), `calloutInsertText(type: string): string` — both consumed by Task 2's `calloutModal.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { CALLOUT_TYPES, calloutInsertText } from "../../../../src/ribbon/commands/actions/calloutTypes";

describe("calloutTypes", () => {
  it("includes Obsidian's built-in callout types with no duplicates", () => {
    expect(CALLOUT_TYPES).toContain("note");
    expect(CALLOUT_TYPES).toContain("warning");
    expect(CALLOUT_TYPES).toContain("quote");
    expect(CALLOUT_TYPES.length).toBe(27);
    expect(new Set(CALLOUT_TYPES).size).toBe(CALLOUT_TYPES.length);
  });

  it("calloutInsertText builds a callout block with the given type", () => {
    expect(calloutInsertText("tip")).toBe("> [!tip] Title\n> ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/calloutTypes.test.ts`
Expected: FAIL — cannot find module `../../../../src/ribbon/commands/actions/calloutTypes`

- [ ] **Step 3: Write minimal implementation**

```ts
export const CALLOUT_TYPES: readonly string[] = [
  "note",
  "abstract",
  "summary",
  "tldr",
  "info",
  "todo",
  "tip",
  "hint",
  "important",
  "success",
  "check",
  "done",
  "question",
  "help",
  "faq",
  "warning",
  "caution",
  "attention",
  "failure",
  "fail",
  "missing",
  "danger",
  "error",
  "bug",
  "example",
  "quote",
  "cite",
];

export function calloutInsertText(type: string): string {
  return `> [!${type}] Title\n> `;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/calloutTypes.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/calloutTypes.ts tests/ribbon/commands/actions/calloutTypes.test.ts
git commit -m "feat: add callout type list and insertion-text helper"
```

---

### Task 2: Callout suggest modal

**Files:**
- Create: `src/ribbon/commands/actions/calloutModal.ts`

**Interfaces:**
- Consumes: `CALLOUT_TYPES`, `calloutInsertText` from `./calloutTypes` (Task 1); `insertAtCursor` from `./helpers` (existing); `EditorLike` from `./types` (existing).
- Produces: `openCalloutModal(editor: EditorLike, app: App): void`, consumed by Task 3's `registry.ts` via dynamic `import()`.

This file makes a runtime (value) import of `FuzzySuggestModal` from `"obsidian"`, so per the Global Constraints it has no unit test — it's covered by typecheck now and manual verification in Task 5.

- [ ] **Step 1: Write the implementation**

```ts
import { FuzzySuggestModal } from "obsidian";
import type { App } from "obsidian";
import type { EditorLike } from "./types";
import { insertAtCursor } from "./helpers";
import { CALLOUT_TYPES, calloutInsertText } from "./calloutTypes";

class CalloutSuggestModal extends FuzzySuggestModal<string> {
  constructor(
    app: App,
    private editor: EditorLike
  ) {
    super(app);
    this.setPlaceholder("Choose a callout type");
  }

  getItems(): string[] {
    return [...CALLOUT_TYPES];
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    insertAtCursor(this.editor, calloutInsertText(item));
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

- [ ] **Step 2: Run typecheck to verify it compiles**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ribbon/commands/actions/calloutModal.ts
git commit -m "feat: add callout type suggest modal"
```

---

### Task 3: Wire the `modal` command kind into the registry

**Files:**
- Modify: `src/ribbon/commands/registry.ts`
- Modify: `src/ribbon/commands/actions/insert.ts`
- Modify: `tests/ribbon/commands/actions/insert.test.ts`
- Modify: `tests/ribbon/commands/registry.test.ts`

**Interfaces:**
- Consumes: `openCalloutModal` from `./actions/calloutModal` (Task 2), reached via dynamic `import()` only (see Global Constraints).
- Produces: `CommandEntry.modal?: (editor: EditorLike, app: App) => void`, consumed by Task 4's `Button.svelte`.

- [ ] **Step 1: Update the registry test to expect the new `modal` kind (failing first)**

Replace the existing "every command is either a direct action or a non-empty set of options" test in `tests/ribbon/commands/registry.test.ts`:

```ts
  it("every command is either a direct action, a modal, or a non-empty set of options", () => {
    for (const entry of COMMAND_REGISTRY) {
      if (entry.options) {
        expect(entry.options.length).toBeGreaterThan(0);
        for (const option of entry.options) {
          expect(typeof option.action).toBe("function");
        }
      } else if (entry.modal) {
        expect(typeof entry.modal).toBe("function");
      } else {
        expect(typeof entry.action).toBe("function");
      }
    }
  });

  it("callout commands open the callout type modal instead of a direct action", () => {
    const callout = COMMAND_REGISTRY.find((entry) => entry.id === "callout");
    const refCallout = COMMAND_REGISTRY.find((entry) => entry.id === "ref-callout");
    expect(callout?.modal).toBeTypeOf("function");
    expect(callout?.action).toBeUndefined();
    expect(refCallout?.modal).toBeTypeOf("function");
    expect(refCallout?.action).toBeUndefined();
  });
```

(This replaces the old test of the same name/position — do not keep both.)

- [ ] **Step 2: Update the insert-actions test to drop `insertCallout`**

In `tests/ribbon/commands/actions/insert.test.ts`, remove `insertCallout` from the import list (line 4) and delete this test case:

```ts
  it("insertCallout inserts a callout template", () => {
    const editor = createMockEditor("");
    insertCallout(editor);
    expect(editor.getValue()).toBe("> [!note] Title\n> ");
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/ribbon/commands/registry.test.ts tests/ribbon/commands/actions/insert.test.ts`
Expected: FAIL — `registry.test.ts` fails because `callout`/`ref-callout` still use `action`, not `modal`; `insert.test.ts` should still pass at this point (only a deletion), confirming nothing else broke yet.

- [ ] **Step 4: Remove `insertCallout` from `insert.ts`**

Delete this block from `src/ribbon/commands/actions/insert.ts`:

```ts
export function insertCallout(editor: EditorLike): void {
  insertAtCursor(editor, "> [!note] Title\n> ");
}
```

- [ ] **Step 5: Add the `modal` field and wire the callout entries in `registry.ts`**

Add the type-only `App` import at the top of `src/ribbon/commands/registry.ts` (alongside the existing imports):

```ts
import type { App } from "obsidian";
```

Add `modal` to the `CommandEntry` interface:

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
}
```

Add a lazy-loading wrapper function above `COMMAND_REGISTRY` (this is what keeps `registry.ts` free of a static runtime `obsidian` import — see Global Constraints):

```ts
function openCallout(editor: EditorLike, app: App): void {
  void import("./actions/calloutModal").then((module) => module.openCalloutModal(editor, app));
}
```

Replace the `callout` entry's action line:

```ts
  {
    id: "callout",
    tab: "insert",
    group: "Illustrations",
    icon: "message-square",
    label: "Callout",
    modal: openCallout,
  },
```

Replace the `ref-callout` entry's action line:

```ts
  {
    id: "ref-callout",
    tab: "references",
    group: "Callouts",
    icon: "message-square",
    label: "Callout",
    modal: openCallout,
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/ribbon/commands/registry.test.ts tests/ribbon/commands/actions/insert.test.ts`
Expected: PASS, all tests green

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm run test && npm run typecheck`
Expected: all tests pass, no type errors

- [ ] **Step 8: Commit**

```bash
git add src/ribbon/commands/registry.ts src/ribbon/commands/actions/insert.ts tests/ribbon/commands/registry.test.ts tests/ribbon/commands/actions/insert.test.ts
git commit -m "feat: wire callout commands to open the type picker modal"
```

---

### Task 4: Thread `app` down to ribbon buttons and handle `command.modal`

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ribbon/RibbonManager.ts`
- Modify: `src/ribbon/components/RibbonBar.svelte`
- Modify: `src/ribbon/components/RibbonPanel.svelte`
- Modify: `src/ribbon/components/Group.svelte`
- Modify: `src/ribbon/components/Button.svelte`

**Interfaces:**
- Consumes: `CommandEntry.modal` (Task 3), Obsidian's `App` type (this plugin's `this.app`, available on any `Plugin` subclass — already used elsewhere in `main.ts`).
- Produces: nothing consumed by later tasks (this is the last wiring step; Task 5 is manual verification only).

No unit tests are added in this task — see Global Constraints (these files all make runtime `obsidian` imports or are Svelte components with no existing test harness in this project). Verification is `npm run typecheck` + `npm run build`, then manual verification in Task 5.

- [ ] **Step 1: `RibbonManager.ts` — accept and store `app`, pass it to the mounted component**

In `src/ribbon/RibbonManager.ts`, change the import and constructor:

```ts
import type { App, MarkdownView } from "obsidian";
```

```ts
export class RibbonManager {
  private instances = new Map<MarkdownView, RibbonInstance>();
  private enabled: boolean;
  private defaultCollapsed: boolean;
  private propertiesStore: Writable<FrontmatterPropertyConfig[]>;
  private app: App;

  constructor(options: {
    app: App;
    enabled: boolean;
    defaultCollapsed: boolean;
    frontmatterProperties: FrontmatterPropertyConfig[];
  }) {
    this.app = options.app;
    this.enabled = options.enabled;
    this.defaultCollapsed = options.defaultCollapsed;
    this.propertiesStore = writable(options.frontmatterProperties);
  }
```

In `attach()`, add `app` to the mounted props:

```ts
    const component = mount(RibbonBar, {
      target: host,
      props: {
        editorStore,
        defaultCollapsed: this.defaultCollapsed,
        propertiesStore: this.propertiesStore,
        app: this.app,
      },
    });
```

- [ ] **Step 2: `main.ts` — pass `this.app` into `RibbonManager`**

In `src/main.ts`, update the `RibbonManager` construction in `onload()`:

```ts
    this.ribbonManager = new RibbonManager({
      app: this.app,
      enabled: this.settings.ribbonEnabled,
      defaultCollapsed: this.settings.defaultCollapsed,
      frontmatterProperties: this.settings.frontmatterProperties,
    });
```

- [ ] **Step 3: `RibbonBar.svelte` — accept `app` prop, forward to `RibbonPanel`**

```svelte
<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { App } from "obsidian";
  import { TABS } from "../commands/registry";
  import type { TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import Tab from "./Tab.svelte";
  import RibbonPanel from "./RibbonPanel.svelte";

  let {
    editorStore,
    defaultCollapsed,
    propertiesStore,
    app,
  }: {
    editorStore: Writable<EditorLike | null>;
    defaultCollapsed: boolean;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
    app: App;
  } = $props();

  let editor = $derived($editorStore);

  let activeTab = $state<TabId>(TABS[0].id);
  let collapsed = $state(defaultCollapsed);

  function selectTab(tab: TabId) {
    activeTab = tab;
  }

  function toggleCollapsed() {
    collapsed = !collapsed;
  }
</script>

<div class="ribbon-bar" class:collapsed>
  <div class="ribbon-tab-strip">
    {#each TABS as tab (tab.id)}
      <Tab
        label={tab.label}
        active={tab.id === activeTab}
        onselect={() => selectTab(tab.id)}
        ondoubleclick={toggleCollapsed}
      />
    {/each}
  </div>
  {#if !collapsed}
    <RibbonPanel tab={activeTab} {editor} {propertiesStore} {app} />
  {/if}
</div>
```

- [ ] **Step 4: `RibbonPanel.svelte` — accept `app` prop, forward to `Group`**

```svelte
<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { App } from "obsidian";
  import type { CommandEntry, TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import { buildPropertyCommands, commandsForTab, groupsForTab } from "../commands/registry";
  import Group from "./Group.svelte";

  let {
    tab,
    editor,
    propertiesStore,
    app,
  }: {
    tab: TabId;
    editor: EditorLike | null;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
    app: App;
  } = $props();

  let properties = $derived($propertiesStore);
  let dynamicCommands = $derived(tab === "references" ? buildPropertyCommands(properties) : []);
  let groups = $derived(
    dynamicCommands.length > 0 ? [...groupsForTab(tab), "Properties"] : groupsForTab(tab)
  );
  let commands = $derived([...commandsForTab(tab), ...dynamicCommands]);
</script>

<div class="ribbon-panel">
  {#each groups as group (group)}
    <Group label={group} commands={commands.filter((c: CommandEntry) => c.group === group)} {editor} {app} />
  {/each}
</div>
```

- [ ] **Step 5: `Group.svelte` — accept `app` prop, forward to `Button` (not `Dropdown`, which never uses modals)**

```svelte
<script lang="ts">
  import type { App } from "obsidian";
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import Button from "./Button.svelte";
  import Dropdown from "./Dropdown.svelte";

  let {
    label,
    commands,
    editor,
    app,
  }: { label: string; commands: CommandEntry[]; editor: EditorLike | null; app: App } = $props();
</script>

<div class="ribbon-group">
  <div class="ribbon-group-buttons">
    {#each commands as command (command.id)}
      {#if command.options}
        <Dropdown {command} {editor} />
      {:else}
        <Button {command} {editor} {app} />
      {/if}
    {/each}
  </div>
  <div class="ribbon-group-label">{label}</div>
</div>
```

- [ ] **Step 6: `Button.svelte` — accept `app` prop, call `command.modal` when present and skip the auto-focus**

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

  let { command, editor, app }: { command: CommandEntry; editor: EditorLike | null; app: App } = $props();

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
  type="button"
  title={command.label}
  aria-label={command.label}
  disabled={!editor}
  onclick={handleClick}
>
  <span class="ribbon-button-icon" use:icon={command.icon}></span>
  <span class="ribbon-button-label">{command.label}</span>
</button>
```

- [ ] **Step 7: Run typecheck and full test suite**

Run: `npm run typecheck && npm run test`
Expected: no type errors, all existing tests still pass (nothing here has new automated tests per Global Constraints)

- [ ] **Step 8: Run the production build**

Run: `npm run build`
Expected: builds successfully, produces `main.js`

- [ ] **Step 9: Commit**

```bash
git add src/main.ts src/ribbon/RibbonManager.ts src/ribbon/components/RibbonBar.svelte src/ribbon/components/RibbonPanel.svelte src/ribbon/components/Group.svelte src/ribbon/components/Button.svelte
git commit -m "feat: thread app through ribbon components and open callout modal on click"
```

---

### Task 5: Manual verification in a real Obsidian vault

Per project convention (automated tests alone have historically missed real bugs in this plugin — Obsidian-runtime behavior needs hands-on confirmation), verify the feature end-to-end before considering it done.

**Files:** none (verification only)

- [ ] **Step 1: Build and install into a test vault**

Run: `./scripts/install.sh /path/to/your/test-vault`
Expected: "✓ Done." printed with no errors

- [ ] **Step 2: Reload the plugin in Obsidian**

In the test vault: Settings → Community Plugins → toggle "Ribbon Bar" off then on (or use "Reload app without saving" from the command palette).

- [ ] **Step 3: Verify the Insert tab's Callout button**

Open a markdown note in edit mode. Click the ribbon bar's "Insert" tab, then click "Callout".
Expected: a fuzzy-search modal opens titled with the placeholder "Choose a callout type", listing types like note, tip, warning, danger, etc. Typing filters the list.

- [ ] **Step 4: Verify choosing a type inserts correctly**

With the modal open, type "warn" and press Enter (or click "warning").
Expected: modal closes; `> [!warning] Title\n> ` is inserted at the cursor; editor regains keyboard focus (typing immediately afterward lands in the editor, not the modal).

- [ ] **Step 5: Verify canceling the modal**

Click "Callout" again, then press Escape.
Expected: modal closes, nothing is inserted, editor regains keyboard focus.

- [ ] **Step 6: Verify the References tab's Callout button**

Click the "References" tab, click its "Callout" button (in the "Callouts" group).
Expected: same modal opens and behaves identically to Steps 3-5.

- [ ] **Step 7: Verify no regressions in nearby commands**

Click a few other Insert-tab buttons (e.g., Table, Horizontal Rule) and a References-tab button (e.g., Footnote) to confirm they still insert immediately without any modal, and the editor keeps focus as before.

- [ ] **Step 8: Report results**

If all steps pass, the feature is complete. If any step fails, note the exact expected vs. actual behavior before making further changes — do not mark the task done.
