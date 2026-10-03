import { beforeEach, describe, expect, it } from "vitest";
import { obsidianLog } from "obsidian";
import { registerCustomIcons } from "../../src/ribbon/icons";
import * as ids from "../../src/ribbon/iconIds";
import { COMMAND_REGISTRY } from "../../src/ribbon/commands/registry";

beforeEach(() => obsidianLog.reset());

describe("custom icons", () => {
  const customIds = Object.values(ids);

  it("registers an SVG body for every declared icon id", () => {
    registerCustomIcons();
    expect([...obsidianLog.icons.keys()].sort()).toEqual([...customIds].sort());
    for (const svg of obsidianLog.icons.values()) {
      expect(svg).toContain("<");
      expect(svg).toContain("currentColor");
    }
  });

  it("uses distinct artwork for each icon", () => {
    registerCustomIcons();
    expect(new Set(obsidianLog.icons.values()).size).toBe(customIds.length);
  });

  it("is used by the table commands (every custom id is referenced by a registry entry)", () => {
    const used = new Set(COMMAND_REGISTRY.map((c) => c.icon));
    for (const id of customIds) expect(used.has(id), id).toBe(true);
  });
});
