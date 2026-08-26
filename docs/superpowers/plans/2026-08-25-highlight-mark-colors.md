# Highlight Color (`<mark>`-based) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-color `==highlighted text==` Highlight button with a settings-configurable palette of `<mark style="background-color: ...">` highlight colors, rendered as one ribbon dropdown with color swatches, plus a vault-wide scan-and-migrate tool for existing `==...==` highlights.

**Architecture:** Follows the existing "user-configurable list → dynamic ribbon command" pattern already used for frontmatter properties (`buildPropertyCommands`), generalizing `RibbonPanel.svelte`'s dynamic-command merge to support a second source (Home tab). Adds one new reusable UI primitive (a color swatch in `Dropdown.svelte`'s menu items) and one new Obsidian-dependent subsystem (a `Modal` that scans the vault and lets the user selectively migrate files).

**Tech Stack:** TypeScript, Svelte 5 (runes), Obsidian Plugin API, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-highlight-mark-colors-design.md`

## Global Constraints

- Highlight colors are stored as `{ name: string; color: string }` (hex color), matching the spec's `HighlightColorConfig`.
- Default palette: Yellow `#ffd700`, Green `#7bed9f`, Blue `#70a1ff`, Pink `#ff6b81`, Purple `#c9a0ff`.
- `<mark>` wrapping format is exactly: `<mark style="background-color: ${color};">${content}</mark>`.
- `==...==` matching uses `/==(.*?)==/g` (non-greedy, empty content allowed) — matches the existing `FORMATTING_MARKERS` convention in `home.ts`.
- Fence-awareness for the migration scanner reuses `computeFenceLineKinds` (already exported from `src/ribbon/commands/actions/formatMarkdown.ts`) — do not reimplement fence detection.
- Pure logic (no `obsidian` import) gets full unit test coverage via `createMockEditor`/plain strings. Anything requiring `App`/`Vault`/`Modal`/Svelte rendering is manually verified in the dev vault, per this codebase's existing convention (no test files exist for `RibbonManager.ts`, any `.svelte` file, or any `*Modal.ts` file).
- After each task: `npm run test`, then `npm run typecheck` must pass before committing.

---

### Task 1: `highlightMark.ts` — color config type and the highlight action

**Files:**
- Create: `src/ribbon/commands/actions/highlightMark.ts`
- Test: `tests/ribbon/commands/actions/highlightMark.test.ts`

**Interfaces:**
- Produces: `HighlightColorConfig { name: string; color: string }`, `highlightWithColor(color: string): (editor: EditorLike) => void`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ribbon/commands/actions/highlightMark.test.ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { highlightWithColor } from "../../../../src/ribbon/commands/actions/highlightMark";

describe("highlightWithColor", () => {
  it("wraps the selection in a <mark> tag with the given background color", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe('<mark style="background-color: #ffd700;">hi</mark>');
  });

  it("inserts a placeholder and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe('<mark style="background-color: #ffd700;">highlighted text</mark>');
    expect(editor.getSelection()).toBe("highlighted text");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/highlightMark.test.ts`
Expected: FAIL — cannot find module `.../highlightMark` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/ribbon/commands/actions/highlightMark.ts
import type { EditorLike } from "./types";
import { wrapSelection } from "./helpers";

export interface HighlightColorConfig {
  name: string;
  color: string;
}

export function highlightWithColor(color: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void =>
    wrapSelection(editor, `<mark style="background-color: ${color};">`, "</mark>", "highlighted text");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/highlightMark.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/highlightMark.ts tests/ribbon/commands/actions/highlightMark.test.ts
git commit -m "feat: add highlightWithColor action for <mark>-based highlighting"
```

---

### Task 2: `highlightMigration.ts` — pure scan/rewrite logic

**Files:**
- Create: `src/ribbon/commands/actions/highlightMigration.ts`
- Test: `tests/ribbon/commands/actions/highlightMigration.test.ts`

**Interfaces:**
- Consumes: `computeFenceLineKinds(lines: string[]): FenceLineKind[]` from `src/ribbon/commands/actions/formatMarkdown.ts` (already exported)
- Produces: `countHighlights(text: string): number`, `migrateHighlightsInText(text: string, color: string): string`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ribbon/commands/actions/highlightMigration.test.ts
import { describe, expect, it } from "vitest";
import {
  countHighlights,
  migrateHighlightsInText,
} from "../../../../src/ribbon/commands/actions/highlightMigration";

describe("countHighlights", () => {
  it("counts ==...== spans outside fenced code blocks", () => {
    const text = "==one== and ==two==\ntext";
    expect(countHighlights(text)).toBe(2);
  });

  it("does not count '=='-looking text inside a fenced code block", () => {
    const text = "==real==\n\n```\n==not a highlight==\n```\n\n==also real==";
    expect(countHighlights(text)).toBe(2);
  });

  it("returns 0 for text with no highlights", () => {
    expect(countHighlights("just a paragraph")).toBe(0);
  });
});

describe("migrateHighlightsInText", () => {
  it("rewrites ==...== spans to <mark> tags with the given color", () => {
    const text = "see ==this== and ==that==";
    expect(migrateHighlightsInText(text, "#ffd700")).toBe(
      'see <mark style="background-color: #ffd700;">this</mark> and <mark style="background-color: #ffd700;">that</mark>'
    );
  });

  it("leaves fenced code block content untouched", () => {
    const text = "==real==\n\n```\n==not a highlight==\n```\n\n==also real==";
    expect(migrateHighlightsInText(text, "#ffd700")).toBe(
      '<mark style="background-color: #ffd700;">real</mark>\n\n```\n==not a highlight==\n```\n\n<mark style="background-color: #ffd700;">also real</mark>'
    );
  });

  it("returns the text unchanged when there are no highlights", () => {
    expect(migrateHighlightsInText("just a paragraph", "#ffd700")).toBe("just a paragraph");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ribbon/commands/actions/highlightMigration.test.ts`
Expected: FAIL — cannot find module `.../highlightMigration` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/ribbon/commands/actions/highlightMigration.ts
import { computeFenceLineKinds } from "./formatMarkdown";

const HIGHLIGHT_PATTERN = /==(.*?)==/g;

export function countHighlights(text: string): number {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (fenceKinds[i]) continue;
    const matches = lines[i].match(HIGHLIGHT_PATTERN);
    if (matches) count += matches.length;
  }
  return count;
}

export function migrateHighlightsInText(text: string, color: string): string {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  return lines
    .map((line, i) => {
      if (fenceKinds[i]) return line;
      return line.replace(
        HIGHLIGHT_PATTERN,
        (_match, content: string) => `<mark style="background-color: ${color};">${content}</mark>`
      );
    })
    .join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ribbon/commands/actions/highlightMigration.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/highlightMigration.ts tests/ribbon/commands/actions/highlightMigration.test.ts
git commit -m "feat: add pure highlight-migration scan/rewrite logic"
```

---

### Task 3: `settings.ts` — persisted highlight color list

**Files:**
- Modify: `src/settings.ts`
- Test: `tests/settings.test.ts`

**Interfaces:**
- Consumes: `HighlightColorConfig` from `src/ribbon/commands/actions/highlightMark.ts` (Task 1)
- Produces: `RibbonBarSettings.highlightColors: HighlightColorConfig[]`, `DEFAULT_SETTINGS.highlightColors`

- [ ] **Step 1: Write the failing tests**

Add to `tests/settings.test.ts`, inside the existing `describe("DEFAULT_SETTINGS", ...)` block (after the `frontmatterProperties` test):

```typescript
  it("defaults to a Yellow/Green/Blue/Pink/Purple highlight palette", () => {
    expect(DEFAULT_SETTINGS.highlightColors).toEqual([
      { name: "Yellow", color: "#ffd700" },
      { name: "Green", color: "#7bed9f" },
      { name: "Blue", color: "#70a1ff" },
      { name: "Pink", color: "#ff6b81" },
      { name: "Purple", color: "#c9a0ff" },
    ]);
  });
```

Add to the `describe("mergeSettings", ...)` block (after the frontmatterProperties aliasing tests):

```typescript
  it("does not alias DEFAULT_SETTINGS.highlightColors when nothing is stored", () => {
    const result = mergeSettings(null);
    expect(result.highlightColors).not.toBe(DEFAULT_SETTINGS.highlightColors);
  });

  it("mutating a returned highlight color object never leaks into DEFAULT_SETTINGS", () => {
    const result = mergeSettings(null);
    result.highlightColors[0].color = "#000000";
    expect(DEFAULT_SETTINGS.highlightColors[0].color).toBe("#ffd700");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/settings.test.ts`
Expected: FAIL — `DEFAULT_SETTINGS.highlightColors` is `undefined`.

- [ ] **Step 3: Update the implementation**

In `src/settings.ts`, add the import and field:

```typescript
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";
import type { HighlightColorConfig } from "./ribbon/commands/actions/highlightMark";

export interface RibbonBarSettings {
  ribbonEnabled: boolean;
  defaultCollapsed: boolean;
  frontmatterProperties: FrontmatterPropertyConfig[];
  highlightColors: HighlightColorConfig[];
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
  highlightColors: [
    { name: "Yellow", color: "#ffd700" },
    { name: "Green", color: "#7bed9f" },
    { name: "Blue", color: "#70a1ff" },
    { name: "Pink", color: "#ff6b81" },
    { name: "Purple", color: "#c9a0ff" },
  ],
};

function cloneDefaultSettings(): RibbonBarSettings {
  return {
    ...DEFAULT_SETTINGS,
    frontmatterProperties: DEFAULT_SETTINGS.frontmatterProperties.map((property) => ({ ...property })),
    highlightColors: DEFAULT_SETTINGS.highlightColors.map((color) => ({ ...color })),
  };
}
```

Leave `mergeSettings` itself unchanged — `Object.assign(cloneDefaultSettings(), stored)` already handles the new field correctly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/settings.test.ts`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts tests/settings.test.ts
git commit -m "feat: add highlightColors setting with default palette"
```

---

### Task 4: `registry.ts` + `home.ts` — dynamic command builder, remove old Highlight button

**Files:**
- Modify: `src/ribbon/commands/registry.ts`
- Modify: `src/ribbon/commands/actions/home.ts`
- Modify: `tests/ribbon/commands/registry.test.ts`
- Modify: `tests/ribbon/commands/actions/home.test.ts`

**Interfaces:**
- Consumes: `HighlightColorConfig`, `highlightWithColor` from Task 1
- Produces: `CommandOption.swatch?: string`, `buildHighlightColorCommands(colors: HighlightColorConfig[]): CommandEntry[]`

- [ ] **Step 1: Write the failing tests**

Add to `tests/ribbon/commands/registry.test.ts`. First, extend the import block at the top:

```typescript
import {
  buildHighlightColorCommands,
  buildPropertyCommands,
  COMMAND_REGISTRY,
  TABS,
  commandsForTab,
  groupsForTab,
} from "../../../src/ribbon/commands/registry";
```

(This adds `buildHighlightColorCommands` to the existing import — keep every other existing import in that file as-is.)

Then add a new `describe` block anywhere after the existing `describe("Document parity commands", ...)` block:

```typescript
describe("buildHighlightColorCommands", () => {
  it("returns an empty array when no colors are configured", () => {
    expect(buildHighlightColorCommands([])).toEqual([]);
  });

  it("builds one Highlight Color dropdown command with one option per configured color", () => {
    const colors = [
      { name: "Yellow", color: "#ffd700" },
      { name: "Green", color: "#7bed9f" },
    ];
    const commands = buildHighlightColorCommands(colors);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      id: "highlight-color",
      tab: "home",
      group: "Font",
      label: "Highlight Color",
    });
    expect(commands[0].options).toHaveLength(2);
    expect(commands[0].options?.[0]).toMatchObject({ label: "Yellow", swatch: "#ffd700" });
    expect(commands[0].options?.[1]).toMatchObject({ label: "Green", swatch: "#7bed9f" });
  });

  it("each color option's action highlights the selection with that color", () => {
    const commands = buildHighlightColorCommands([{ name: "Yellow", color: "#ffd700" }]);
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    commands[0].options?.[0].action(editor);
    expect(editor.getValue()).toBe('<mark style="background-color: #ffd700;">hi</mark>');
  });
});
```

(`createMockEditor` is already imported in this file from Task-work earlier in this project — confirm the import `import { createMockEditor } from "../../support/mockEditor";` is present near the top; if not already there, add it.)

Now edit `tests/ribbon/commands/actions/home.test.ts`: remove `toggleHighlight` from the import list, and delete this test block entirely:

```typescript
  it("toggleHighlight wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleHighlight(editor);
    expect(editor.getValue()).toBe("==hi==");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ribbon/commands/registry.test.ts tests/ribbon/commands/actions/home.test.ts`
Expected: FAIL — `buildHighlightColorCommands` is not exported yet; `home.test.ts` should still PASS at this point since `toggleHighlight` still exists in `home.ts` (only the registry test should fail). Confirm the registry failure is "not a function" / "undefined", not a typo.

- [ ] **Step 3: Update the implementation**

In `src/ribbon/commands/actions/home.ts`, delete this line entirely:

```typescript
export const toggleHighlight = (editor: EditorLike): void => wrapSelection(editor, "==", "==", "highlighted text");
```

In `src/ribbon/commands/registry.ts`:

1. Add the import (alongside the existing `latex` import):

```typescript
import * as highlightMark from "./actions/highlightMark";
import type { HighlightColorConfig } from "./actions/highlightMark";
```

2. Add `swatch?: string;` to `CommandOption`:

```typescript
export interface CommandOption {
  id: string;
  label: string;
  action: (editor: EditorLike) => void;
  swatch?: string;
}
```

3. Delete the static `highlight` entry from `COMMAND_REGISTRY`:

```typescript
  {
    id: "highlight",
    tab: "home",
    group: "Font",
    icon: "highlighter",
    label: "Highlight",
    action: home.toggleHighlight,
  },
```

4. Add `buildHighlightColorCommands`, near `buildPropertyCommands` at the bottom of the file:

```typescript
export function buildHighlightColorCommands(colors: HighlightColorConfig[]): CommandEntry[] {
  if (colors.length === 0) return [];
  return [
    {
      id: "highlight-color",
      tab: "home",
      group: "Font",
      icon: "highlighter",
      label: "Highlight Color",
      options: colors.map((color) => ({
        id: `highlight-color-${color.name.toLowerCase().replace(/\s+/g, "-")}`,
        label: color.name,
        swatch: color.color,
        action: highlightMark.highlightWithColor(color.color),
      })),
    },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: every test file PASSES. There should be no remaining reference to `toggleHighlight`/`home.toggleHighlight` anywhere in `src/` or `tests/` — grep to confirm:

```bash
grep -rn "toggleHighlight" src tests
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/registry.ts src/ribbon/commands/actions/home.ts tests/ribbon/commands/registry.test.ts tests/ribbon/commands/actions/home.test.ts
git commit -m "feat: replace static Highlight button with dynamic Highlight Color builder"
```

---

### Task 5: Settings-store threading — `RibbonManager`, `plugin-contract.ts`, `main.ts`, Svelte components

**Files:**
- Modify: `src/ribbon/RibbonManager.ts`
- Modify: `src/plugin-contract.ts`
- Modify: `src/main.ts`
- Modify: `src/ribbon/components/RibbonBar.svelte`
- Modify: `src/ribbon/components/RibbonPanel.svelte`

**Interfaces:**
- Consumes: `HighlightColorConfig` (Task 1), `buildHighlightColorCommands` (Task 4), `RibbonBarSettings.highlightColors` (Task 3)
- Produces: `RibbonManager.highlightColorsStore: Writable<HighlightColorConfig[]>`, `RibbonManager.setHighlightColors(colors): void`, `RibbonBarPluginLike.setHighlightColors(colors): void`

This task has no automated tests (`RibbonManager.ts` and every `.svelte` file are manually verified only, per the Global Constraints). Verification is: `npm run typecheck` passes, `npm run build` succeeds, and a manual spot-check in the dev vault.

- [ ] **Step 1: Update `RibbonManager.ts`**

```typescript
import type { App, MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import { writable, type Writable } from "svelte/store";
import RibbonBar from "./components/RibbonBar.svelte";
import type { EditorLike } from "./commands/actions/types";
import type { FrontmatterPropertyConfig } from "./commands/actions/frontmatter";
import type { HighlightColorConfig } from "./commands/actions/highlightMark";
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
  private highlightColorsStore: Writable<HighlightColorConfig[]>;
  private app: App;

  constructor(options: {
    app: App;
    enabled: boolean;
    defaultCollapsed: boolean;
    frontmatterProperties: FrontmatterPropertyConfig[];
    highlightColors: HighlightColorConfig[];
  }) {
    this.app = options.app;
    this.enabled = options.enabled;
    this.defaultCollapsed = options.defaultCollapsed;
    this.propertiesStore = writable(options.frontmatterProperties);
    this.highlightColorsStore = writable(options.highlightColors);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setDefaultCollapsed(defaultCollapsed: boolean): void {
    this.defaultCollapsed = defaultCollapsed;
  }

  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void {
    this.propertiesStore.set([...properties]);
  }

  setHighlightColors(colors: HighlightColorConfig[]): void {
    this.highlightColorsStore.set([...colors]);
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

  private editorFor(view: MarkdownView): EditorLike | null {
    return view.getMode() === "preview" ? null : ((view.editor as unknown as EditorLike) ?? null);
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
        highlightColorsStore: this.highlightColorsStore,
        app: this.app,
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

(Only the `import`, `highlightColorsStore` field, constructor `highlightColors` option, `setHighlightColors` method, and the `highlightColorsStore` line inside `mount()`'s `props` are new — everything else in the class is unchanged from before this task.)

- [ ] **Step 2: Update `plugin-contract.ts`**

```typescript
import type { RibbonBarSettings } from "./settings";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";
import type { HighlightColorConfig } from "./ribbon/commands/actions/highlightMark";

export interface RibbonBarPluginLike {
  settings: RibbonBarSettings;
  saveSettings(): Promise<void>;
  setRibbonEnabled(enabled: boolean): void;
  setDefaultCollapsed(defaultCollapsed: boolean): void;
  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void;
  setHighlightColors(colors: HighlightColorConfig[]): void;
}
```

- [ ] **Step 3: Update `main.ts`**

```typescript
import { MarkdownView, Plugin } from "obsidian";
import { mergeSettings, type RibbonBarSettings } from "./settings";
import { RibbonBarSettingTab } from "./settings-tab";
import type { RibbonBarPluginLike } from "./plugin-contract";
import { RibbonManager } from "./ribbon/RibbonManager";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";
import type { HighlightColorConfig } from "./ribbon/commands/actions/highlightMark";

export default class RibbonBarPlugin extends Plugin implements RibbonBarPluginLike {
  settings: RibbonBarSettings = mergeSettings(null);
  ribbonManager!: RibbonManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.ribbonManager = new RibbonManager({
      app: this.app,
      enabled: this.settings.ribbonEnabled,
      defaultCollapsed: this.settings.defaultCollapsed,
      frontmatterProperties: this.settings.frontmatterProperties,
      highlightColors: this.settings.highlightColors,
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

  setDefaultCollapsed(defaultCollapsed: boolean): void {
    this.ribbonManager.setDefaultCollapsed(defaultCollapsed);
  }

  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void {
    this.ribbonManager.setFrontmatterProperties(properties);
  }

  setHighlightColors(colors: HighlightColorConfig[]): void {
    this.ribbonManager.setHighlightColors(colors);
  }

  private markdownViews(): MarkdownView[] {
    return this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view as MarkdownView);
  }

  async loadSettings(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 4: Update `RibbonBar.svelte`**

```svelte
<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { App } from "obsidian";
  import { TABS } from "../commands/registry";
  import type { TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import type { HighlightColorConfig } from "../commands/actions/highlightMark";
  import Tab from "./Tab.svelte";
  import RibbonPanel from "./RibbonPanel.svelte";

  let {
    editorStore,
    defaultCollapsed,
    propertiesStore,
    highlightColorsStore,
    app,
  }: {
    editorStore: Writable<EditorLike | null>;
    defaultCollapsed: boolean;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
    highlightColorsStore: Writable<HighlightColorConfig[]>;
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
    <RibbonPanel tab={activeTab} {editor} {propertiesStore} {highlightColorsStore} {app} />
  {/if}
</div>
```

- [ ] **Step 5: Update `RibbonPanel.svelte`**

```svelte
<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { App } from "obsidian";
  import type { CommandEntry, TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import type { HighlightColorConfig } from "../commands/actions/highlightMark";
  import {
    buildHighlightColorCommands,
    buildPropertyCommands,
    commandsForTab,
    groupsForTab,
  } from "../commands/registry";
  import Group from "./Group.svelte";

  let {
    tab,
    editor,
    propertiesStore,
    highlightColorsStore,
    app,
  }: {
    tab: TabId;
    editor: EditorLike | null;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
    highlightColorsStore: Writable<HighlightColorConfig[]>;
    app: App;
  } = $props();

  let properties = $derived($propertiesStore);
  let highlightColors = $derived($highlightColorsStore);
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
</script>

<div class="ribbon-panel">
  {#each groups as group (group)}
    <Group label={group} commands={commands.filter((c: CommandEntry) => c.group === group)} {editor} {app} />
  {/each}
</div>
```

- [ ] **Step 6: Verify the build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: all pass, no TypeScript errors about missing/extra props.

- [ ] **Step 7: Manual spot-check**

```bash
cp main.js manifest.json styles.css /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

Reload the plugin in the dev vault. Confirm the Home tab's Font group now shows a "Highlight Color ▾" dropdown (no swatches yet — that's Task 6) listing Yellow/Green/Blue/Pink/Purple, and that selecting a color wraps the selection in the expected `<mark style="background-color: ...">` tag.

- [ ] **Step 8: Commit**

```bash
git add src/ribbon/RibbonManager.ts src/plugin-contract.ts src/main.ts src/ribbon/components/RibbonBar.svelte src/ribbon/components/RibbonPanel.svelte
git commit -m "feat: thread highlightColors setting through to the ribbon"
```

---

### Task 6: Dropdown color swatches

**Files:**
- Modify: `src/ribbon/components/Dropdown.svelte`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `CommandOption.swatch?: string` (Task 4)

No automated tests (Svelte component, manually verified per Global Constraints).

- [ ] **Step 1: Update `Dropdown.svelte`**

Find this block in the `{#if open}` menu:

```svelte
      {#each command.options ?? [] as option (option.id)}
        <li>
          <button type="button" onclick={() => choose(option.action)}>{option.label}</button>
        </li>
      {/each}
```

Replace it with:

```svelte
      {#each command.options ?? [] as option (option.id)}
        <li>
          <button type="button" onclick={() => choose(option.action)}>
            {#if option.swatch}
              <span class="ribbon-dropdown-swatch" style={`background-color: ${option.swatch};`}></span>
            {/if}
            {option.label}
          </button>
        </li>
      {/each}
```

- [ ] **Step 2: Add the swatch CSS**

In `styles.css`, add this rule near `.ribbon-dropdown-menu`:

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

- [ ] **Step 3: Verify the build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 4: Manual verification**

```bash
cp main.js manifest.json styles.css /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

Reload the plugin. Open the Highlight Color dropdown and confirm each option now shows a small colored square matching its color, next to its name.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/components/Dropdown.svelte styles.css
git commit -m "feat: render a color swatch next to dropdown options that have one"
```

---

### Task 7: Settings UI — add/edit/remove highlight colors

**Files:**
- Modify: `src/settings-tab.ts`

**Interfaces:**
- Consumes: `HighlightColorConfig` (Task 1), `RibbonBarPluginLike.setHighlightColors` (Task 5)

No automated tests (Obsidian `PluginSettingTab`, manually verified per Global Constraints).

- [ ] **Step 1: Add the "Highlight colors" section**

In `src/settings-tab.ts`, add this block inside `display()`, after the existing "Frontmatter properties" section (after its "Add property" `Setting` block, before the closing `}` of `display()`):

```typescript
    containerEl.createEl("h3", { text: "Highlight colors" });
    containerEl.createEl("p", {
      text: "Each color becomes an option in the Home tab's Highlight Color dropdown.",
      cls: "setting-item-description",
    });

    this.plugin.settings.highlightColors.forEach((color, index) => {
      new Setting(containerEl)
        .setName(color.name)
        .addColorPicker((picker) => {
          picker.setValue(color.color).onChange(async (value) => {
            color.color = value;
            await this.plugin.saveSettings();
            this.plugin.setHighlightColors(this.plugin.settings.highlightColors);
          });
        })
        .addExtraButton((button) => {
          button.setIcon("trash");
          button.setTooltip("Remove color");
          button.onClick(async () => {
            this.plugin.settings.highlightColors.splice(index, 1);
            await this.plugin.saveSettings();
            this.plugin.setHighlightColors(this.plugin.settings.highlightColors);
            this.display();
          });
        });
    });

    let newColorName = "";
    let newColorValue = "#ffd700";

    new Setting(containerEl)
      .setName("Add color")
      .addText((text) => {
        text.setPlaceholder("Color name");
        text.onChange((value) => {
          newColorName = value;
        });
      })
      .addColorPicker((picker) => {
        picker.setValue(newColorValue).onChange((value) => {
          newColorValue = value;
        });
      })
      .addButton((button) => {
        button.setButtonText("Add");
        button.onClick(async () => {
          const trimmed = newColorName.trim();
          if (trimmed.length === 0) return;
          this.plugin.settings.highlightColors.push({ name: trimmed, color: newColorValue });
          await this.plugin.saveSettings();
          this.plugin.setHighlightColors(this.plugin.settings.highlightColors);
          this.display();
        });
      });
```

- [ ] **Step 2: Verify the build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: all pass. If `addColorPicker` doesn't typecheck against this project's bundled Obsidian types, replace both `addColorPicker` calls with `.addText((text) => text.setPlaceholder("#rrggbb").setValue(...).onChange(...))` instead — same behavior, plain hex-string input rather than Obsidian's native color swatch picker.

- [ ] **Step 3: Manual verification**

```bash
cp main.js manifest.json styles.css /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

Reload the plugin. Open Settings → Ribbon Bar. Confirm:
1. A "Highlight colors" section lists the 5 default colors, each with a working color picker and a delete button.
2. Changing a color's value updates the Home tab's Highlight Color dropdown swatch immediately (no reload needed).
3. Deleting a color removes it from the dropdown immediately.
4. Deleting all 5 colors makes the "Highlight Color" dropdown disappear from the Home tab entirely.
5. Adding a new color (name + color value + Add) makes it appear in the dropdown immediately.

- [ ] **Step 4: Commit**

```bash
git add src/settings-tab.ts
git commit -m "feat: add Highlight colors settings section"
```

---

### Task 8: Vault-wide migration scan + review modal

**Files:**
- Create: `src/ribbon/commands/actions/highlightMigrationModal.ts`
- Modify: `src/settings-tab.ts`

**Interfaces:**
- Consumes: `countHighlights`, `migrateHighlightsInText` (Task 2)
- Produces: `openHighlightMigrationModal(app: App, color: string): void`

No automated tests (`App`/`Vault`/`Modal`-dependent, manually verified per Global Constraints).

- [ ] **Step 1: Write `highlightMigrationModal.ts`**

```typescript
// src/ribbon/commands/actions/highlightMigrationModal.ts
import { App, ButtonComponent, Modal, Notice, Setting, TFile, ToggleComponent } from "obsidian";
import { countHighlights, migrateHighlightsInText } from "./highlightMigration";

export interface HighlightMigrationCandidate {
  file: TFile;
  count: number;
}

export async function scanVaultForHighlights(app: App): Promise<HighlightMigrationCandidate[]> {
  const files = app.vault.getMarkdownFiles();
  const candidates: HighlightMigrationCandidate[] = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    const count = countHighlights(content);
    if (count > 0) candidates.push({ file, count });
  }
  return candidates;
}

class HighlightMigrationModal extends Modal {
  private candidates: HighlightMigrationCandidate[] = [];
  private selected = new Set<string>();
  private toggles = new Map<string, ToggleComponent>();
  private migrateButton: ButtonComponent | undefined;

  constructor(
    app: App,
    private color: string
  ) {
    super(app);
    this.setTitle("Migrate highlights to <mark> tags");
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-highlight-migration-modal");
    contentEl.createEl("p", { text: "Scanning vault for ==highlights==..." });

    this.candidates = await scanVaultForHighlights(this.app);
    contentEl.empty();

    if (this.candidates.length === 0) {
      contentEl.createEl("p", { text: "No ==highlights== found in this vault." });
      return;
    }

    for (const candidate of this.candidates) this.selected.add(candidate.file.path);

    new Setting(contentEl)
      .addButton((button) => button.setButtonText("Select All").onClick(() => this.setAllSelected(true)))
      .addButton((button) => button.setButtonText("Deselect All").onClick(() => this.setAllSelected(false)));

    const listEl = contentEl.createDiv();
    for (const candidate of this.candidates) {
      new Setting(listEl)
        .setName(candidate.file.path)
        .setDesc(`${candidate.count} highlight${candidate.count === 1 ? "" : "s"}`)
        .addToggle((toggle) => {
          this.toggles.set(candidate.file.path, toggle);
          toggle.setValue(true).onChange((value) => {
            if (value) this.selected.add(candidate.file.path);
            else this.selected.delete(candidate.file.path);
            this.updateMigrateButtonLabel();
          });
        });
    }

    new Setting(contentEl).addButton((button) => {
      this.migrateButton = button;
      button.setCta().onClick(() => void this.migrateSelected());
      this.updateMigrateButtonLabel();
    });
  }

  private setAllSelected(value: boolean): void {
    for (const candidate of this.candidates) {
      if (value) this.selected.add(candidate.file.path);
      else this.selected.delete(candidate.file.path);
      this.toggles.get(candidate.file.path)?.setValue(value);
    }
    this.updateMigrateButtonLabel();
  }

  private updateMigrateButtonLabel(): void {
    this.migrateButton?.setButtonText(
      `Migrate ${this.selected.size} file${this.selected.size === 1 ? "" : "s"}`
    );
  }

  private async migrateSelected(): Promise<void> {
    let migrated = 0;
    for (const candidate of this.candidates) {
      if (!this.selected.has(candidate.file.path)) continue;
      try {
        const content = await this.app.vault.read(candidate.file);
        const rewritten = migrateHighlightsInText(content, this.color);
        await this.app.vault.modify(candidate.file, rewritten);
        migrated++;
      } catch (error) {
        console.error("Ribbon Bar: failed to migrate highlights in", candidate.file.path, error);
      }
    }
    new Notice(`Migrated highlights in ${migrated} file${migrated === 1 ? "" : "s"}.`);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function openHighlightMigrationModal(app: App, color: string): void {
  new HighlightMigrationModal(app, color).open();
}
```

- [ ] **Step 2: Wire the settings-tab button**

In `src/settings-tab.ts`, add this block right after the "Highlight colors" section from Task 7 (after the "Add color" `Setting`, still inside `display()`):

```typescript
    new Setting(containerEl)
      .setName("Migrate ==highlights== to <mark> tags")
      .setDesc(
        this.plugin.settings.highlightColors.length === 0
          ? "Add at least one highlight color above before migrating."
          : "Scans every note in the vault for ==...== highlights and lets you choose which ones to convert."
      )
      .addButton((button) => {
        button.setButtonText("Scan vault");
        button.setDisabled(this.plugin.settings.highlightColors.length === 0);
        button.onClick(() => {
          const color = this.plugin.settings.highlightColors[0]?.color;
          if (!color) return;
          void import("./ribbon/commands/actions/highlightMigrationModal")
            .then((module) => module.openHighlightMigrationModal(this.app, color))
            .catch((error) => console.error("Ribbon Bar: failed to open highlight migration modal", error));
        });
      });
```

- [ ] **Step 3: Verify the build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 4: Manual verification**

```bash
cp main.js manifest.json styles.css /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

Reload the plugin. In the dev vault:
1. Create (or reuse) a note containing a few `==highlighted==` spans, including at least one inside a fenced code block that should be ignored.
2. Settings → Ribbon Bar → "Scan vault" under "Migrate ==highlights== to <mark> tags". Confirm the modal shows a "Scanning…" state, then lists the note with its match count (not counting the one inside the code fence).
3. Toggle a file off, confirm the "Migrate N files" button's count updates. Click Select All / Deselect All and confirm both the toggles and the button count update together.
4. Click "Migrate N files" with at least one file selected. Confirm a completion notice appears, the modal closes, and the note's `==...==` spans are now `<mark style="background-color: ...">` tags using the first configured color — while the one inside the code fence is untouched.
5. Remove every highlight color in settings, confirm the "Scan vault" button becomes disabled with the explanatory description.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/highlightMigrationModal.ts src/settings-tab.ts
git commit -m "feat: add vault-wide ==highlight== to <mark> migration modal"
```

---

### Task 9: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: every test file passes, including all new tests from Tasks 1-4.

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no new warnings beyond the pre-existing, unrelated `state_referenced_locally` Svelte warning in `RibbonBar.svelte` (present before this feature; do not attempt to fix it here).

- [ ] **Step 3: Deploy to the dev vault**

```bash
cp main.js manifest.json styles.css /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

- [ ] **Step 4: End-to-end manual walkthrough**

Reload the plugin, then confirm, in order:
1. Home tab: the old "Highlight" button is gone; "Highlight Color ▾" is present in the Font group with a swatch + name per configured color.
2. Selecting text and choosing a color wraps it in the correct `<mark style="background-color: ...">` tag; with no selection, it inserts and selects the "highlighted text" placeholder.
3. Clear Formatting on a selection containing a `<mark>`-highlighted span does **not** need to strip it (out of scope for this feature — only `==...==`/other existing markers are stripped); confirm this is indeed the current, expected behavior and not a surprise regression.
4. Settings → Ribbon Bar: add, edit, and remove highlight colors; confirm the ribbon dropdown updates live in an already-open note without reloading the plugin.
5. Migration: scan, review, selectively migrate, and confirm the resulting note content and the completion notice.

- [ ] **Step 5: Report results**

Summarize what was verified and flag anything that didn't match the spec before considering this feature complete.
