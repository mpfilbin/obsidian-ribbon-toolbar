# Frontmatter Properties Implementation Plan

> Executed directly in-session per user request (no subagent dispatch this round). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-configurable frontmatter-property quick-insert buttons to
the ribbon's References tab, driven by a live-updating settings list.

**Architecture:** A new pure actions file computes type-aware frontmatter
insertions; a registry helper turns the user's configured property list into
`CommandEntry` objects at render time; `RibbonManager` owns one shared
`Writable<FrontmatterPropertyConfig[]>` store threaded through `RibbonBar` →
`RibbonPanel`, so every open pane's Properties group updates live when
settings change.

**Tech Stack:** Same as the rest of the project — TypeScript, Svelte 5,
vitest, Obsidian Plugin API.

## Global Constraints

- `src/ribbon/commands/actions/frontmatter.ts` must have zero `obsidian`
  import (per spec's testability requirement).
- Property names are regex-escaped before being used to build a match
  pattern (per spec's error-handling section).
- Date/Date & time "no default" test cases must assert via a
  format-matching regex, not an exact string (per spec's testing approach).
- `plugin-contract.ts` may only gain a type-only import of
  `FrontmatterPropertyConfig` — no import of `main.ts` or `RibbonManager`.
- Settings UI and live cross-pane store propagation are verified manually
  in Obsidian, not via automated test (per spec).

---

### Task 1: Frontmatter actions

**Files:**
- Create: `src/ribbon/commands/actions/frontmatter.ts`
- Test: `tests/ribbon/commands/actions/frontmatter.test.ts`

**Interfaces:**
- Consumes: `EditorLike` from `./types` (existing).
- Produces: `type PropertyType = "automatic" | "text" | "list" | "number" | "checkbox" | "date" | "datetime"`;
  `interface FrontmatterPropertyConfig { name: string; type: PropertyType; defaultValue?: string }`;
  `insertOrLocateProperty(config: FrontmatterPropertyConfig): (editor: EditorLike) => void`.
  Consumed by `src/ribbon/commands/registry.ts` (Task 2).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertOrLocateProperty } from "../../../../src/ribbon/commands/actions/frontmatter";

describe("insertOrLocateProperty", () => {
  it("creates a frontmatter block when none exists (text, no default)", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "description", type: "text" })(editor);
    expect(editor.getValue()).toBe("---\ndescription: \n---\n");
  });

  it("inserts a default text value verbatim", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "source", type: "text", defaultValue: "https://example.com" })(editor);
    expect(editor.getValue()).toBe("---\nsource: https://example.com\n---\n");
  });

  it("creates an empty list property with one blank item", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "tags", type: "list" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - \n---\n");
  });

  it("splits a comma-separated default value into list items", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "tags", type: "list", defaultValue: "note, draft" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - note\n  - draft\n---\n");
  });

  it("defaults checkbox to false when no default value is set", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "archived", type: "checkbox" })(editor);
    expect(editor.getValue()).toBe("---\narchived: false\n---\n");
  });

  it("uses an explicit checkbox default value", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "archived", type: "checkbox", defaultValue: "true" })(editor);
    expect(editor.getValue()).toBe("---\narchived: true\n---\n");
  });

  it("defaults a date property to today's date in YYYY-MM-DD form", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "created", type: "date" })(editor);
    expect(editor.getValue()).toMatch(/^---\ncreated: \d{4}-\d{2}-\d{2}\n---\n$/);
  });

  it("defaults a datetime property to now in YYYY-MM-DDTHH:mm form", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "updated", type: "datetime" })(editor);
    expect(editor.getValue()).toMatch(/^---\nupdated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}\n---\n$/);
  });

  it("inserts a new property inside an existing frontmatter block, above the closing delimiter", () => {
    const editor = createMockEditor("---\ntags:\n  - foo\n---\nBody text");
    insertOrLocateProperty({ name: "description", type: "text" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - foo\ndescription: \n---\nBody text");
  });

  it("moves the cursor to an existing property's line instead of duplicating it", () => {
    const editor = createMockEditor("---\ntags:\n  - foo\n---\nBody text");
    insertOrLocateProperty({ name: "tags", type: "list" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - foo\n---\nBody text");
    expect(editor.getCursor()).toEqual({ line: 1, ch: 5 });
  });

  it("does not treat a property name containing regex metacharacters as a pattern error", () => {
    const editor = createMockEditor("---\na.b: 1\n---\nBody text");
    expect(() => insertOrLocateProperty({ name: "a.b", type: "text" })(editor)).not.toThrow();
    expect(editor.getValue()).toBe("---\na.b: 1\n---\nBody text");
    expect(editor.getCursor()).toEqual({ line: 1, ch: 5 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/frontmatter.test.ts`
Expected: FAIL — `frontmatter.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
import type { EditorLike, EditorPosition } from "./types";

export type PropertyType = "automatic" | "text" | "list" | "number" | "checkbox" | "date" | "datetime";

export interface FrontmatterPropertyConfig {
  name: string;
  type: PropertyType;
  defaultValue?: string;
}

const DELIMITER = "---";

interface FrontmatterRange {
  startLine: number;
  endLine: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFrontmatterRange(editor: EditorLike): FrontmatterRange | null {
  if (editor.getLine(0).trim() !== DELIMITER) return null;
  for (let line = 1; line <= editor.lastLine(); line++) {
    if (editor.getLine(line).trim() === DELIMITER) {
      return { startLine: 0, endLine: line };
    }
  }
  return null;
}

function findPropertyLine(editor: EditorLike, range: FrontmatterRange, name: string): number | null {
  const pattern = new RegExp(`^${escapeRegExp(name)}:`);
  for (let line = range.startLine + 1; line < range.endLine; line++) {
    if (pattern.test(editor.getLine(line))) return line;
  }
  return null;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowDateTime(): string {
  return new Date().toISOString().slice(0, 16);
}

function formatValueLines(config: FrontmatterPropertyConfig): string[] {
  const { name, type, defaultValue } = config;

  switch (type) {
    case "list": {
      const items = (defaultValue ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length === 0) return [`${name}:`, "  - "];
      return [`${name}:`, ...items.map((item) => `  - ${item}`)];
    }
    case "checkbox":
      return [`${name}: ${defaultValue === "true" ? "true" : "false"}`];
    case "date":
      return [`${name}: ${defaultValue && defaultValue.length > 0 ? defaultValue : todayDate()}`];
    case "datetime":
      return [`${name}: ${defaultValue && defaultValue.length > 0 ? defaultValue : nowDateTime()}`];
    case "number":
    case "text":
    case "automatic":
    default:
      return [`${name}: ${defaultValue ?? ""}`];
  }
}

function placeCursorAtEndOf(editor: EditorLike, lineIndex: number): void {
  const text = editor.getLine(lineIndex);
  const pos: EditorPosition = { line: lineIndex, ch: text.length };
  editor.setSelection(pos, pos);
}

export function insertOrLocateProperty(config: FrontmatterPropertyConfig): (editor: EditorLike) => void {
  return (editor: EditorLike): void => {
    const range = findFrontmatterRange(editor);

    if (!range) {
      const lines = formatValueLines(config);
      const start: EditorPosition = { line: 0, ch: 0 };
      editor.setSelection(start, start);
      editor.replaceSelection(`${DELIMITER}\n${lines.join("\n")}\n${DELIMITER}\n`);
      placeCursorAtEndOf(editor, lines.length);
      return;
    }

    const existingLine = findPropertyLine(editor, range, config.name);
    if (existingLine !== null) {
      placeCursorAtEndOf(editor, existingLine);
      return;
    }

    const lines = formatValueLines(config);
    const insertAt: EditorPosition = { line: range.endLine, ch: 0 };
    editor.setSelection(insertAt, insertAt);
    editor.replaceSelection(`${lines.join("\n")}\n`);
    placeCursorAtEndOf(editor, range.endLine + lines.length - 1);
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/frontmatter.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/frontmatter.ts tests/ribbon/commands/actions/frontmatter.test.ts
git commit -m "feat: add type-aware frontmatter property insertion actions"
```

---

### Task 2: Registry helper for dynamic property commands

**Files:**
- Modify: `src/ribbon/commands/registry.ts`
- Test: `tests/ribbon/commands/registry.test.ts`

**Interfaces:**
- Consumes: `FrontmatterPropertyConfig`, `insertOrLocateProperty` from
  `./actions/frontmatter` (Task 1).
- Produces: `buildPropertyCommands(properties: FrontmatterPropertyConfig[]): CommandEntry[]`.
  Consumed by `src/ribbon/components/RibbonPanel.svelte` (Task 4).

- [ ] **Step 1: Write the failing test** (append to the existing registry test file)

```ts
import { buildPropertyCommands, /* existing imports */ } from "../../../src/ribbon/commands/registry";

describe("buildPropertyCommands", () => {
  it("builds one Properties-group command per configured property", () => {
    const commands = buildPropertyCommands([
      { name: "tags", type: "list" },
      { name: "description", type: "text" },
    ]);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({ tab: "references", group: "Properties", label: "tags" });
    expect(commands[1]).toMatchObject({ tab: "references", group: "Properties", label: "description" });
    expect(typeof commands[0].action).toBe("function");
  });

  it("returns an empty array for an empty property list", () => {
    expect(buildPropertyCommands([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/registry.test.ts`
Expected: FAIL — `buildPropertyCommands` is not exported yet.

- [ ] **Step 3: Add the implementation to `registry.ts`**

Add near the bottom of the file, alongside `commandsForTab`/`groupsForTab`:

```ts
import type { FrontmatterPropertyConfig } from "./actions/frontmatter";
import { insertOrLocateProperty } from "./actions/frontmatter";

export function buildPropertyCommands(properties: FrontmatterPropertyConfig[]): CommandEntry[] {
  return properties.map((property) => ({
    id: `property-${property.name}`,
    tab: "references",
    group: "Properties",
    icon: "list-plus",
    label: property.name,
    action: insertOrLocateProperty(property),
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/registry.test.ts`
Expected: PASS (6 tests — 4 existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/registry.ts tests/ribbon/commands/registry.test.ts
git commit -m "feat: add buildPropertyCommands registry helper"
```

---

### Task 3: Settings data model and UI

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/plugin-contract.ts`
- Modify: `src/settings-tab.ts`
- Test: `tests/settings.test.ts`

**Interfaces:**
- Consumes: `FrontmatterPropertyConfig`, `PropertyType` from
  `./ribbon/commands/actions/frontmatter` (Task 1).
- Produces: `RibbonBarSettings.frontmatterProperties: FrontmatterPropertyConfig[]`
  (with `DEFAULT_SETTINGS` populated per spec); `RibbonBarPluginLike.setFrontmatterProperties(properties): void`.
  Consumed by `src/main.ts` (Task 5).

- [ ] **Step 1: Write the failing test** (extend `tests/settings.test.ts`)

```ts
it("defaults to tags/description/cssclasses/source", () => {
  expect(DEFAULT_SETTINGS.frontmatterProperties).toEqual([
    { name: "tags", type: "list" },
    { name: "description", type: "text" },
    { name: "cssclasses", type: "list" },
    { name: "source", type: "text" },
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/settings.test.ts`
Expected: FAIL — `frontmatterProperties` is `undefined`.

- [ ] **Step 3: Update `src/settings.ts`**

```ts
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";

export interface RibbonBarSettings {
  ribbonEnabled: boolean;
  defaultCollapsed: boolean;
  frontmatterProperties: FrontmatterPropertyConfig[];
}

export const DEFAULT_SETTINGS: RibbonBarSettings = {
  ribbonEnabled: true,
  defaultCollapsed: false,
  frontmatterProperties: [
    { name: "tags", type: "list" },
    { name: "description", type: "text" },
    { name: "cssclasses", type: "list" },
    { name: "source", type: "text" },
  ],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/settings.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Update `src/plugin-contract.ts`**

```ts
import type { RibbonBarSettings } from "./settings";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";

export interface RibbonBarPluginLike {
  settings: RibbonBarSettings;
  saveSettings(): Promise<void>;
  setRibbonEnabled(enabled: boolean): void;
  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void;
}
```

- [ ] **Step 6: Update `src/settings-tab.ts`**

Add imports and a `PROPERTY_TYPE_OPTIONS` constant near the top:

```ts
import type { PropertyType } from "./ribbon/commands/actions/frontmatter";

const PROPERTY_TYPE_OPTIONS: [PropertyType, string][] = [
  ["automatic", "Automatic (Text)"],
  ["text", "Text"],
  ["list", "List"],
  ["number", "Number"],
  ["checkbox", "Checkbox"],
  ["date", "Date"],
  ["datetime", "Date & time"],
];
```

Append to the end of `display()`, after the two existing toggles:

```ts
containerEl.createEl("h3", { text: "Frontmatter properties" });
containerEl.createEl("p", {
  text: "Each property below becomes a button in the References tab's Properties group.",
  cls: "setting-item-description",
});

this.plugin.settings.frontmatterProperties.forEach((property, index) => {
  new Setting(containerEl)
    .setName(property.name)
    .addDropdown((dropdown) => {
      for (const [value, label] of PROPERTY_TYPE_OPTIONS) dropdown.addOption(value, label);
      dropdown.setValue(property.type);
      dropdown.onChange(async (value) => {
        property.type = value as PropertyType;
        await this.plugin.saveSettings();
        this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
      });
    })
    .addText((text) => {
      text.setPlaceholder("Default value (optional)");
      text.setValue(property.defaultValue ?? "");
      text.onChange(async (value) => {
        property.defaultValue = value.length > 0 ? value : undefined;
        await this.plugin.saveSettings();
        this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
      });
    })
    .addExtraButton((button) => {
      button.setIcon("trash");
      button.setTooltip("Remove property");
      button.onClick(async () => {
        this.plugin.settings.frontmatterProperties.splice(index, 1);
        await this.plugin.saveSettings();
        this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
        this.display();
      });
    });
});

let newPropertyName = "";
let newPropertyType: PropertyType = "text";

new Setting(containerEl)
  .setName("Add property")
  .addText((text) => {
    text.setPlaceholder("Property name");
    text.onChange((value) => {
      newPropertyName = value;
    });
  })
  .addDropdown((dropdown) => {
    for (const [value, label] of PROPERTY_TYPE_OPTIONS) dropdown.addOption(value, label);
    dropdown.setValue(newPropertyType);
    dropdown.onChange((value) => {
      newPropertyType = value as PropertyType;
    });
  })
  .addButton((button) => {
    button.setButtonText("Add");
    button.onClick(async () => {
      const trimmed = newPropertyName.trim();
      if (trimmed.length === 0) return;
      this.plugin.settings.frontmatterProperties.push({ name: trimmed, type: newPropertyType });
      await this.plugin.saveSettings();
      this.plugin.setFrontmatterProperties(this.plugin.settings.frontmatterProperties);
      this.display();
    });
  });
```

- [ ] **Step 7: Type-check**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: errors about `main.ts` not yet implementing `setFrontmatterProperties` are expected at this point (fixed in Task 5) — no other errors.

- [ ] **Step 8: Commit**

```bash
git add src/settings.ts src/plugin-contract.ts src/settings-tab.ts tests/settings.test.ts
git commit -m "feat: add frontmatter properties settings data model and UI"
```

---

### Task 4: Thread the live property store through the Svelte component tree

**Files:**
- Modify: `src/ribbon/components/RibbonBar.svelte`
- Modify: `src/ribbon/components/RibbonPanel.svelte`

**Interfaces:**
- Consumes: `FrontmatterPropertyConfig` and `buildPropertyCommands` from
  `../commands/registry`/`../commands/actions/frontmatter` (Tasks 1-2);
  `Writable` from `svelte/store`.
- Produces: `RibbonBar.svelte` prop `propertiesStore: Writable<FrontmatterPropertyConfig[]>`
  (passed straight through, alongside the existing `editorStore`/`defaultCollapsed`
  props). Consumed by `src/ribbon/RibbonManager.ts` (Task 5).

No automated test (Svelte/DOM layer, verified manually per spec) — verify
with `npx tsc -noEmit -skipLibCheck` after each change (won't catch
Svelte-internal issues, but confirms surrounding `.ts` files still compile)
and a full `npm run build` at the end of this task to catch Svelte
compilation errors.

- [ ] **Step 1: Update `RibbonBar.svelte`**

Change the props destructuring and pass the new prop through to `RibbonPanel`:

```svelte
<script lang="ts">
  import type { Writable } from "svelte/store";
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
  }: {
    editorStore: Writable<EditorLike | null>;
    defaultCollapsed: boolean;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
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
    <RibbonPanel tab={activeTab} {editor} {propertiesStore} />
  {/if}
</div>
```

- [ ] **Step 2: Update `RibbonPanel.svelte`**

```svelte
<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { CommandEntry, TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import { buildPropertyCommands, commandsForTab, groupsForTab } from "../commands/registry";
  import Group from "./Group.svelte";

  let {
    tab,
    editor,
    propertiesStore,
  }: {
    tab: TabId;
    editor: EditorLike | null;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
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
    <Group label={group} commands={commands.filter((c: CommandEntry) => c.group === group)} {editor} />
  {/each}
</div>
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: same pre-existing `main.ts` gap as Task 3 (fixed next task) — no new errors from these two files.

Run: `npm run build`
Expected: succeeds (this is the step that actually validates the `.svelte`
changes compile — `RibbonManager.ts` doesn't yet pass `propertiesStore`, so
this will fail at this point with a missing-prop error from the Svelte
compiler; that's expected and resolved in Task 5. If it fails for any
*other* reason, investigate before moving on.)

- [ ] **Step 4: Commit**

```bash
git add src/ribbon/components/RibbonBar.svelte src/ribbon/components/RibbonPanel.svelte
git commit -m "feat: thread live frontmatter properties store through ribbon components"
```

---

### Task 5: Wire RibbonManager and main.ts

**Files:**
- Modify: `src/ribbon/RibbonManager.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `FrontmatterPropertyConfig` from `./commands/actions/frontmatter`
  (Task 1); `RibbonBarPluginLike.setFrontmatterProperties` (Task 3);
  `RibbonBar.svelte`'s `propertiesStore` prop (Task 4).
- Produces: `RibbonManager.setFrontmatterProperties(properties): void`;
  `RibbonBarPlugin.setFrontmatterProperties(properties): void` (satisfies
  `RibbonBarPluginLike` fully).

- [ ] **Step 1: Update `RibbonManager.ts`**

Add the shared store, thread it into every mount, and expose the setter:

```ts
import type { MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import { writable, type Writable } from "svelte/store";
import RibbonBar from "./components/RibbonBar.svelte";
import type { EditorLike } from "./commands/actions/types";
import type { FrontmatterPropertyConfig } from "./commands/actions/frontmatter";
import { findInjectionPoint } from "./injectionPoint";

interface RibbonInstance {
  host: HTMLElement;
  component: object;
  editorStore: Writable<EditorLike | null>;
}

export class RibbonManager {
  private instances = new Map<MarkdownView, RibbonInstance>();
  private enabled: boolean;
  private defaultCollapsed: boolean;
  private propertiesStore: Writable<FrontmatterPropertyConfig[]>;

  constructor(options: {
    enabled: boolean;
    defaultCollapsed: boolean;
    frontmatterProperties: FrontmatterPropertyConfig[];
  }) {
    this.enabled = options.enabled;
    this.defaultCollapsed = options.defaultCollapsed;
    this.propertiesStore = writable(options.frontmatterProperties);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void {
    this.propertiesStore.set(properties);
  }

  private editorFor(view: MarkdownView): EditorLike | null {
    return view.getMode() === "preview" ? null : ((view.editor as unknown as EditorLike) ?? null);
  }

  syncAllLeaves(views: MarkdownView[]): void {
    const live = new Set(views);
    for (const tracked of this.instances.keys()) {
      if (!live.has(tracked)) this.detach(tracked);
    }
    for (const view of views) {
      if (this.enabled) this.attach(view);
      else this.detach(view);
    }
  }

  attach(view: MarkdownView): void {
    if (!this.enabled) return;

    const existing = this.instances.get(view);
    if (existing) {
      existing.editorStore.set(this.editorFor(view));
      return;
    }

    const target = findInjectionPoint(view.containerEl);
    if (!target) {
      console.warn("Ribbon Bar: could not find injection point for view", view);
      return;
    }

    const host = document.createElement("div");
    host.addClass("ribbon-bar-host");
    target.prepend(host);

    const editorStore = writable<EditorLike | null>(this.editorFor(view));

    const component = mount(RibbonBar, {
      target: host,
      props: {
        editorStore,
        defaultCollapsed: this.defaultCollapsed,
        propertiesStore: this.propertiesStore,
      },
    });

    this.instances.set(view, { host, component, editorStore });
  }

  detach(view: MarkdownView): void {
    const instance = this.instances.get(view);
    if (!instance) return;
    unmount(instance.component);
    instance.host.remove();
    this.instances.delete(view);
  }

  detachAll(views: MarkdownView[]): void {
    for (const view of views) this.detach(view);
  }
}
```

> Note: this restructures `attach()`/`RibbonInstance` to hold a per-view
> `editorStore` explicitly (previously created inline and not stored on the
> instance) so that `attach()` can push live editor updates to already-mounted
> panes on every sync pass, same as before this plan — plus the new
> `propertiesStore`, which is the *same shared instance* for every view
> rather than one per view.

- [ ] **Step 2: Update `main.ts`**

```ts
import { MarkdownView, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type RibbonBarSettings } from "./settings";
import { RibbonBarSettingTab } from "./settings-tab";
import type { RibbonBarPluginLike } from "./plugin-contract";
import { RibbonManager } from "./ribbon/RibbonManager";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";

export default class RibbonBarPlugin extends Plugin implements RibbonBarPluginLike {
  settings: RibbonBarSettings = DEFAULT_SETTINGS;
  ribbonManager!: RibbonManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.ribbonManager = new RibbonManager({
      enabled: this.settings.ribbonEnabled,
      defaultCollapsed: this.settings.defaultCollapsed,
      frontmatterProperties: this.settings.frontmatterProperties,
    });

    this.addSettingTab(new RibbonBarSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.syncRibbons());
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncRibbons()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncRibbons()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncRibbons()));
  }

  onunload(): void {
    this.ribbonManager.detachAll(this.markdownViews());
  }

  syncRibbons(): void {
    this.ribbonManager.syncAllLeaves(this.markdownViews());
  }

  setRibbonEnabled(enabled: boolean): void {
    this.ribbonManager.setEnabled(enabled);
    this.syncRibbons();
  }

  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void {
    this.ribbonManager.setFrontmatterProperties(properties);
  }

  private markdownViews(): MarkdownView[] {
    return this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view as MarkdownView);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests including the new frontmatter/registry ones.

- [ ] **Step 4: Run the full build**

Run: `npm run build`
Expected: `tsc -noEmit` passes with no errors (including `main.ts` now fully
satisfying `RibbonBarPluginLike`), esbuild succeeds, `main.js` produced.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/RibbonManager.ts src/main.ts
git commit -m "feat: wire shared frontmatter properties store through RibbonManager and main.ts"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Rebuild and reinstall into the dev vault**

Run: `bash scripts/install.sh ~/obsidian-dev-vault`, then fully quit and
reopen Obsidian (JS changes need a full restart; this changes `main.js`).

- [ ] **Step 2: Verify default properties appear**

Open a note, go to the References tab. Confirm a "Properties" group appears
with four buttons: Tags, Description, Cssclasses, Source.

- [ ] **Step 3: Verify insertion behavior**

On a note with no frontmatter, click **Tags**. Confirm a `---` block appears
at the top with `tags:` and an empty list item, cursor ready to type. Click
**Description**. Confirm it's added as a new line inside the *same* block
(not a second `---` block). Click **Tags** again. Confirm the cursor moves
to the existing `tags:` line instead of duplicating it.

- [ ] **Step 4: Verify settings UI and live update across panes**

Open two panes side by side (split right), each on a different note. In
Settings → Ribbon Bar, add a new property (e.g. "priority", type Number).
Confirm the Properties group updates in **both** open panes' ribbons
immediately, without reopening either note. Remove a property; confirm it
disappears from both panes immediately too. Change a property's type or
default value; click its button on a note with no frontmatter and confirm
the inserted value matches the new configuration.

- [ ] **Step 5: Verify each property type's insertion format**

Configure one property of each type (Checkbox, Date, Date & time, Number)
with no default value, click each on a fresh note, and confirm the format
matches the design doc's table (Checkbox → `false`, Date → today's date,
Date & time → now, Number → empty).
