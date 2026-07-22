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
} from "../../../src/ribbon/commands/actions/tableEdit";

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
    }
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
