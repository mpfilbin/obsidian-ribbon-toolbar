import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPropertyCommands,
  COMMAND_REGISTRY,
  commandsForTabWithProperties,
  groupsOf,
  TABS,
  commandsForTab,
  groupsForTab,
} from "../../../src/ribbon/commands/registry";
import {
  insertRowAbove,
  insertRowBelow,
  insertColumnLeft,
  insertColumnRight,
  deleteRow,
  deleteColumn,
  alignColumnLeft,
  alignColumnCenter,
  alignColumnRight,
} from "../../../src/ribbon/commands/actions/tableEdit";
import { toggleComment, toUpperCase, toLowerCase, toTitleCase, toSentenceCase } from "../../../src/ribbon/commands/actions/home";
import { createMockEditor } from "../../support/mockEditor";

describe("COMMAND_REGISTRY", () => {
  it("has a unique id for every command", () => {
    const ids = COMMAND_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least one command for every tab", () => {
    for (const tab of TABS) {
      expect(commandsForTab(tab.id).length).toBeGreaterThan(0);
    }
  });

  it("every command is either a direct action, a modal, a grid picker, or a non-empty set of options", () => {
    for (const entry of COMMAND_REGISTRY) {
      if (entry.options) {
        expect(entry.options.length).toBeGreaterThan(0);
        for (const option of entry.options) {
          expect(typeof option.action).toBe("function");
        }
      } else if (entry.modal) {
        expect(typeof entry.modal).toBe("function");
      } else if (entry.grid) {
        expect(typeof entry.grid).toBe("function");
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

  it("embed command opens the embed modal instead of a direct action", () => {
    const embed = COMMAND_REGISTRY.find((entry) => entry.id === "embed");
    expect(embed?.modal).toBeTypeOf("function");
    expect(embed?.action).toBeUndefined();
  });

  it("table command opens the grid picker instead of a direct action", () => {
    const table = COMMAND_REGISTRY.find((entry) => entry.id === "table");
    expect(table?.grid).toBeTypeOf("function");
    expect(table?.action).toBeUndefined();
  });

  it("format-document command is a direct action on the Layout tab in a Formatting group", () => {
    const formatDocument = COMMAND_REGISTRY.find((entry) => entry.id === "format-document");
    expect(formatDocument?.tab).toBe("layout");
    expect(formatDocument?.group).toBe("Formatting");
    expect(typeof formatDocument?.action).toBe("function");
  });

  it("groups commands within the Home tab in first-seen order", () => {
    expect(groupsForTab("home")).toEqual(["Font", "Paragraph"]);
  });

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

  it("table-align offers Left/Center/Right options instead of a direct action, and is not compact", () => {
    const align = COMMAND_REGISTRY.find((entry) => entry.id === "table-align");
    expect(align?.tab).toBe("insert");
    expect(align?.group).toBe("Tables");
    expect(align?.action).toBeUndefined();
    expect(align?.compact).toBeFalsy();
    expect(align?.options).toEqual([
      { id: "table-align-left", label: "Align Left", action: alignColumnLeft },
      { id: "table-align-center", label: "Align Center", action: alignColumnCenter },
      { id: "table-align-right", label: "Align Right", action: alignColumnRight },
    ]);
  });

  it("the Table insert grid-picker command is not compact", () => {
    const table = COMMAND_REGISTRY.find((entry) => entry.id === "table");
    expect(table?.compact).toBeFalsy();
  });
});

describe("Document parity commands", () => {
  it("comment is a direct action in the Home tab's Font group", () => {
    const comment = COMMAND_REGISTRY.find((entry) => entry.id === "comment");
    expect(comment?.tab).toBe("home");
    expect(comment?.group).toBe("Font");
    expect(comment?.action).toBe(toggleComment);
  });

  it("change-case offers the four case-transform options in the Home tab's Font group", () => {
    const changeCase = COMMAND_REGISTRY.find((entry) => entry.id === "change-case");
    expect(changeCase?.tab).toBe("home");
    expect(changeCase?.group).toBe("Font");
    expect(changeCase?.action).toBeUndefined();
    expect(changeCase?.options).toEqual([
      { id: "case-upper", label: "UPPERCASE", action: toUpperCase },
      { id: "case-lower", label: "lowercase", action: toLowerCase },
      { id: "case-title", label: "Title Case", action: toTitleCase },
      { id: "case-sentence", label: "Sentence case", action: toSentenceCase },
    ]);
  });

  it("symbols offers a curated set of typography, math, and currency symbol options in the Insert tab", () => {
    const symbols = COMMAND_REGISTRY.find((entry) => entry.id === "symbols");
    expect(symbols?.tab).toBe("insert");
    expect(symbols?.group).toBe("Symbols");
    expect(symbols?.action).toBeUndefined();
    expect(symbols?.options?.length).toBe(45);
    for (const option of symbols?.options ?? []) {
      expect(typeof option.action).toBe("function");
    }
  });

  it("symbols is laid out as a multi-column grid with a compact glyph per option", () => {
    const symbols = COMMAND_REGISTRY.find((entry) => entry.id === "symbols");
    expect(symbols?.optionColumns).toBe(8);
    const emDash = symbols?.options?.find((option) => option.id === "sym-em-dash");
    expect(emDash?.display).toBe("—");
    const nbsp = symbols?.options?.find((option) => option.id === "sym-nbsp");
    expect(nbsp?.display).toBe("\u2423");
  });

  it("the Em Dash symbol option inserts an em dash at the cursor", () => {
    const symbols = COMMAND_REGISTRY.find((entry) => entry.id === "symbols");
    const emDash = symbols?.options?.find((option) => option.id === "sym-em-dash");
    const editor = createMockEditor("");
    emDash?.action(editor);
    expect(editor.getValue()).toBe("—");
  });

  it("ref-heading-link opens the heading link modal instead of a direct action", () => {
    const headingLink = COMMAND_REGISTRY.find((entry) => entry.id === "ref-heading-link");
    expect(headingLink?.tab).toBe("references");
    expect(headingLink?.group).toBe("Links");
    expect(headingLink?.modal).toBeTypeOf("function");
    expect(headingLink?.action).toBeUndefined();
  });
});

describe("highlight command", () => {
  const highlight = COMMAND_REGISTRY.find((entry) => entry.id === "highlight");

  it("is a static Home tab Font-group dropdown with Default plus the native colors", () => {
    expect(highlight?.tab).toBe("home");
    expect(highlight?.group).toBe("Font");
    expect(highlight?.action).toBeUndefined();
    expect(highlight?.options?.map((option) => option.label)).toEqual([
      "Default",
      "🔴  Red",
      "🟠  Orange",
      "🟡  Yellow",
      "🟢  Green",
      "🔵  Blue",
      "🟣  Purple",
    ]);
  });

  it("the Red option wraps the selection in a native color highlight", () => {
    const red = highlight?.options?.find((option) => option.id === "highlight-red");
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    red?.action(editor);
    expect(editor.getValue()).toBe("==🔴hi==");
  });

  it("the Default option wraps the selection in a plain highlight", () => {
    const plain = highlight?.options?.find((option) => option.id === "highlight-default");
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    plain?.action(editor);
    expect(editor.getValue()).toBe("==hi==");
  });
});

describe("LaTeX tab commands", () => {
  it("groups commands within the LaTeX tab in first-seen order", () => {
    expect(groupsForTab("latex")).toEqual([
      "Math",
      "Structures",
      "Environments",
      "Greek Letters",
      "Operators",
      "Arrows",
    ]);
  });

  it("Math and Structures commands are direct actions", () => {
    const ids = [
      "latex-inline-math",
      "latex-block-math",
      "latex-fraction",
      "latex-sqrt",
      "latex-superscript",
      "latex-subscript",
      "latex-sum",
      "latex-integral",
      "latex-limit",
    ];
    for (const id of ids) {
      const entry = COMMAND_REGISTRY.find((e) => e.id === id);
      expect(entry?.tab).toBe("latex");
      expect(typeof entry?.action).toBe("function");
    }
  });

  it("latex-matrix opens the grid picker instead of a direct action", () => {
    const matrix = COMMAND_REGISTRY.find((entry) => entry.id === "latex-matrix");
    expect(matrix?.group).toBe("Environments");
    expect(matrix?.grid).toBeTypeOf("function");
    expect(matrix?.action).toBeUndefined();
  });

  it("latex-cases and latex-align are direct actions in the Environments group", () => {
    for (const id of ["latex-cases", "latex-align"]) {
      const entry = COMMAND_REGISTRY.find((e) => e.id === id);
      expect(entry?.group).toBe("Environments");
      expect(typeof entry?.action).toBe("function");
    }
  });

  it("latex-greek offers a curated set of Greek letter options", () => {
    const greek = COMMAND_REGISTRY.find((entry) => entry.id === "latex-greek");
    expect(greek?.group).toBe("Greek Letters");
    expect(greek?.options?.length).toBe(17);
    expect(greek?.action).toBeUndefined();
  });

  it("latex-operators offers a curated set of operator/relation/set options", () => {
    const operators = COMMAND_REGISTRY.find((entry) => entry.id === "latex-operators");
    expect(operators?.group).toBe("Operators");
    expect(operators?.options?.length).toBe(16);
    expect(operators?.action).toBeUndefined();
  });

  it("latex-arrows offers a curated set of arrow options", () => {
    const arrows = COMMAND_REGISTRY.find((entry) => entry.id === "latex-arrows");
    expect(arrows?.group).toBe("Arrows");
    expect(arrows?.options?.length).toBe(7);
    expect(arrows?.action).toBeUndefined();
  });
});

describe("buildPropertyCommands", () => {
  const properties = [
    { name: "tags", type: "list" as const },
    { name: "description", type: "text" as const },
  ];

  it("merges the predefined properties into a single Properties menu", () => {
    const commands = buildPropertyCommands(properties);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ id: "property-menu", tab: "references", group: "Properties", label: "Properties" });
    expect(commands[0].action).toBeUndefined();
    expect(commands[0].options!.map((o) => [o.id, o.label])).toEqual([
      ["property-tags", "tags"],
      ["property-description", "description"],
    ]);
  });

  it("inserts the chosen property into the note's frontmatter", () => {
    const [menu] = buildPropertyCommands(properties);
    const editor = createMockEditor("body");
    menu.options![0].action(editor, {} as never);
    expect(editor.getValue()).toBe("---\ntags:\n  - \n---\nbody");
  });

  it("returns no menu for an empty property list", () => {
    expect(buildPropertyCommands([])).toEqual([]);
  });
});

describe("Properties group on the References tab", () => {
  const props = [{ name: "status", type: "text" as const }];

  it("always offers Add Property, as a modal command", () => {
    const add = COMMAND_REGISTRY.find((c) => c.id === "property-add");
    expect(add).toMatchObject({ tab: "references", group: "Properties", label: "Add Property" });
    expect(add!.modal).toBeTypeOf("function");
    expect(groupsForTab("references")).toContain("Properties");
  });

  it("puts the predefined-properties menu ahead of Add Property", () => {
    const commands = commandsForTabWithProperties("references", props);
    const group = commands.filter((c) => c.group === "Properties").map((c) => c.label);
    expect(group).toEqual(["Properties", "Add Property"]);
  });

  it("leaves other groups and tabs alone", () => {
    expect(commandsForTabWithProperties("references", props).filter((c) => c.group !== "Properties")).toEqual(
      commandsForTab("references").filter((c) => c.group !== "Properties")
    );
    expect(commandsForTabWithProperties("insert", props)).toEqual(commandsForTab("insert"));
  });

  it("is just the static commands when no properties are configured", () => {
    expect(commandsForTabWithProperties("references", [])).toEqual(commandsForTab("references"));
  });

  it("groupsOf lists groups in first-seen order", () => {
    expect(groupsOf(commandsForTabWithProperties("references", props))).toEqual(groupsForTab("references"));
    expect(groupsOf([])).toEqual([]);
  });
});

describe("lazy-loaded modal commands", () => {
  const modalCommands: [string, string, string][] = [
    ["callout", "calloutModal", "openCalloutModal"],
    ["link", "externalLinkModal", "openExternalLinkModal"],
    ["internal-link", "linkModal", "openLinkModal"],
    ["embed", "embedModal", "openEmbedModal"],
    ["footnote", "footnoteModal", "openFootnoteModal"],
    ["property-add", "propertyModal", "openAddPropertyModal"],
    ["ref-heading-link", "headingLinkModal", "openHeadingLinkModal"],
  ];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [, file] of modalCommands) vi.doUnmock(`../../../src/ribbon/commands/actions/${file}`);
    vi.resetModules();
  });

  it.each(modalCommands)("%s opens its modal module with the editor and app", async (id, file, exportName) => {
    const open = vi.fn();
    vi.resetModules();
    vi.doMock(`../../../src/ribbon/commands/actions/${file}`, () => ({ [exportName]: open }));
    const { COMMAND_REGISTRY: registry } = await import("../../../src/ribbon/commands/registry");
    const entry = registry.find((c) => c.id === id);
    expect(entry?.modal, id).toBeTypeOf("function");

    const editor = createMockEditor("");
    const app = {} as never;
    entry!.modal!(editor, app);
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith(editor, app));
    vi.doUnmock(`../../../src/ribbon/commands/actions/${file}`);
  });

  it("logs instead of throwing when the modal fails to open", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    vi.doMock("../../../src/ribbon/commands/actions/calloutModal", () => ({
      openCalloutModal: () => {
        throw new Error("boom");
      },
    }));
    const { COMMAND_REGISTRY: registry } = await import("../../../src/ribbon/commands/registry");
    const entry = registry.find((c) => c.id === "callout")!;
    expect(() => entry.modal!(createMockEditor(""), {} as never)).not.toThrow();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(String(error.mock.calls[0][0])).toContain("callout");
  });
});

describe("registry integrity", () => {
  it("gives every command a unique id", () => {
    const ids = COMMAND_REGISTRY.map((entry) => entry.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });

  it("places every command on a known tab with a group, icon and label", () => {
    const tabIds = TABS.map((tab) => tab.id);
    for (const entry of COMMAND_REGISTRY) {
      expect(tabIds, entry.id).toContain(entry.tab);
      expect(entry.group, entry.id).not.toBe("");
      expect(entry.icon, entry.id).not.toBe("");
      expect(entry.label, entry.id).not.toBe("");
    }
  });

  it("gives every command exactly one way to run", () => {
    for (const entry of COMMAND_REGISTRY) {
      const behaviors = [entry.action, entry.options, entry.modal, entry.grid].filter((b) => b !== undefined);
      expect(behaviors, entry.id).toHaveLength(1);
    }
  });

  it("gives every dropdown option a unique id within its command and a runnable action", () => {
    for (const entry of COMMAND_REGISTRY.filter((c) => c.options)) {
      const ids = entry.options!.map((option) => option.id);
      expect(new Set(ids).size, entry.id).toBe(ids.length);
      for (const option of entry.options!) expect(option.action, option.id).toBeTypeOf("function");
    }
  });

  it("keeps every tab populated, in TABS order", () => {
    for (const tab of TABS) expect(commandsForTab(tab.id).length, tab.id).toBeGreaterThan(0);
  });

  it("only marks commands compact when they are plain buttons", () => {
    for (const entry of COMMAND_REGISTRY.filter((c) => c.compact)) {
      expect(entry.options ?? entry.grid, entry.id).toBeUndefined();
    }
  });
});

describe("code block command", () => {
  const codeBlock = COMMAND_REGISTRY.find((entry) => entry.id === "code-block");

  it("is an Insert > Code dropdown laid out as a grid of text labels", () => {
    expect(codeBlock?.tab).toBe("insert");
    expect(codeBlock?.group).toBe("Code");
    expect(codeBlock?.action).toBeUndefined();
    expect(codeBlock?.optionColumns).toBe(3);
    expect(codeBlock?.optionCellWidth).toBeGreaterThan(32);
  });

  it("starts with Plain text, then offers the common languages", () => {
    const labels = codeBlock?.options?.map((option) => option.label) ?? [];
    expect(labels[0]).toBe("Plain text");
    for (const language of ["JavaScript", "TypeScript", "HTML", "HTTP", "C#", "Java", "C", "C++", "CSS", "Bash / Shell", "PHP", "Ruby"]) {
      expect(labels, language).toContain(language);
    }
  });

  it.each([
    ["code-block-plain", "```\ncode\n```"],
    ["code-block-csharp", "```csharp\ncode\n```"],
    ["code-block-cpp", "```cpp\ncode\n```"],
    ["code-block-bash", "```bash\ncode\n```"],
    ["code-block-http", "```http\ncode\n```"],
  ])("%s inserts the right fenced block", (id, expected) => {
    const option = codeBlock?.options?.find((o) => o.id === id);
    const editor = createMockEditor("");
    option?.action(editor);
    expect(editor.getValue()).toBe(expected);
  });

  it("uses distinct, lowercase, whitespace-free fence ids", () => {
    const ids = codeBlock?.options?.map((o) => o.id.replace("code-block-", "")) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z+]+$/);
  });
});

describe("File tab", () => {
  it("comes first in the tab row and offers the note and export commands", () => {
    expect(TABS[0]).toEqual({ id: "file", label: "File" });
    expect(commandsForTab("file").map((entry) => entry.label)).toEqual([
      "New",
      "Open",
      "Open File",
      "Save As",
      "Move",
      "Export PDF",
      "Export HTML",
    ]);
    expect(groupsForTab("file")).toEqual(["Note", "Export"]);
  });
});
