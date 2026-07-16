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
