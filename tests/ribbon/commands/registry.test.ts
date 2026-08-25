import { describe, expect, it } from "vitest";
import {
  buildPropertyCommands,
  COMMAND_REGISTRY,
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

  it("table row/column/alignment editing commands appear in the registry in 3x3 grid reading order", () => {
    const compactIds = COMMAND_REGISTRY.filter((entry) => entry.compact).map((entry) => entry.id);
    expect(compactIds).toEqual([
      "table-insert-row-above",
      "table-insert-column-left",
      "table-delete-row",
      "table-insert-row-below",
      "table-insert-column-right",
      "table-delete-column",
      "table-align-left",
      "table-align-center",
      "table-align-right",
    ]);
  });

  it("table column alignment commands are direct actions in the Insert tab's Tables group", () => {
    const alignmentCommands = [
      { id: "table-align-left", expectedAction: alignColumnLeft },
      { id: "table-align-center", expectedAction: alignColumnCenter },
      { id: "table-align-right", expectedAction: alignColumnRight },
    ];
    for (const { id, expectedAction } of alignmentCommands) {
      const entry = COMMAND_REGISTRY.find((e) => e.id === id);
      expect(entry?.tab).toBe("insert");
      expect(entry?.group).toBe("Tables");
      expect(entry?.action).toBe(expectedAction);
      expect(entry?.compact).toBe(true);
    }
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

  it("symbols offers a curated set of typography symbol options in the Insert tab", () => {
    const symbols = COMMAND_REGISTRY.find((entry) => entry.id === "symbols");
    expect(symbols?.tab).toBe("insert");
    expect(symbols?.group).toBe("Symbols");
    expect(symbols?.action).toBeUndefined();
    expect(symbols?.options?.length).toBe(14);
    for (const option of symbols?.options ?? []) {
      expect(typeof option.action).toBe("function");
    }
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
