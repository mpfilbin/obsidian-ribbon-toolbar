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

  it("calloutInsertText with only a type omits the title and leaves a trailing content line", () => {
    expect(calloutInsertText("tip")).toBe("> [!tip]\n> ");
  });

  it("calloutInsertText includes a title when one is given", () => {
    expect(calloutInsertText("tip", "Heads up")).toBe("> [!tip] Heads up\n> ");
  });

  it("calloutInsertText trims a whitespace-only title down to no title", () => {
    expect(calloutInsertText("tip", "   ")).toBe("> [!tip]\n> ");
  });

  it("calloutInsertText prefixes every content line with '> '", () => {
    expect(calloutInsertText("tip", "Heads up", "line one\nline two")).toBe(
      "> [!tip] Heads up\n> line one\n> line two"
    );
  });

  it("calloutInsertText falls back to the note type when type is blank", () => {
    expect(calloutInsertText("   ", "Heads up", "content")).toBe("> [!note] Heads up\n> content");
  });

  it("calloutInsertText trims the type", () => {
    expect(calloutInsertText("  tip  ")).toBe("> [!tip]\n> ");
  });
});
