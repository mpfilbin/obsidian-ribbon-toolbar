import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { HIGHLIGHT_COLORS, highlightWithColor } from "../../../../src/ribbon/commands/actions/highlight";

describe("highlightWithColor", () => {
  it("wraps the selection in == with the color emoji right after the opening delimiter", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    highlightWithColor("🔴")(editor);
    expect(editor.getValue()).toBe("==🔴hi==");
  });

  it("wraps the selection in plain == when the color emoji is empty (Default)", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    highlightWithColor("")(editor);
    expect(editor.getValue()).toBe("==hi==");
  });

  it("inserts a selected placeholder when nothing is selected", () => {
    const editor = createMockEditor("");
    highlightWithColor("🟢")(editor);
    expect(editor.getValue()).toBe("==🟢highlighted text==");
    expect(editor.getSelection()).toBe("highlighted text");
  });
});

describe("HIGHLIGHT_COLORS", () => {
  it("lists Default plus the Obsidian native highlight colors", () => {
    expect(HIGHLIGHT_COLORS.map((color) => color.name)).toEqual([
      "Default",
      "Red",
      "Orange",
      "Yellow",
      "Green",
      "Blue",
      "Purple",
    ]);
    expect(HIGHLIGHT_COLORS.map((color) => color.emoji)).toEqual(["", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣"]);
  });
});
