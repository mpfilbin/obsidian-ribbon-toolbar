import { describe, expect, it } from "vitest";
import {
  buildPropertyCommands,
  COMMAND_REGISTRY,
  TABS,
  commandsForTab,
  groupsForTab,
} from "../../../src/ribbon/commands/registry";

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

  it("every command is either a direct action or a non-empty set of options", () => {
    for (const entry of COMMAND_REGISTRY) {
      if (entry.options) {
        expect(entry.options.length).toBeGreaterThan(0);
        for (const option of entry.options) {
          expect(typeof option.action).toBe("function");
        }
      } else {
        expect(typeof entry.action).toBe("function");
      }
    }
  });

  it("groups commands within the Home tab in first-seen order", () => {
    expect(groupsForTab("home")).toEqual(["Font", "Paragraph"]);
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
