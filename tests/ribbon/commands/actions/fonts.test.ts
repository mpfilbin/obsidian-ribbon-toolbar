import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { applyFont, FONT_OPTIONS } from "../../../../src/ribbon/commands/actions/fonts";

describe("applyFont", () => {
  it("wraps the selection in a span styled with the font's family", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    applyFont("Georgia, 'Times New Roman', serif")(editor);
    expect(editor.getValue()).toBe('<span style="font-family: Georgia, \'Times New Roman\', serif;">hi</span>');
  });

  it("inserts a selected placeholder when nothing is selected", () => {
    const editor = createMockEditor("");
    applyFont("Arial, Helvetica, sans-serif")(editor);
    expect(editor.getValue()).toBe('<span style="font-family: Arial, Helvetica, sans-serif;">text</span>');
    expect(editor.getSelection()).toBe("text");
  });
});

describe("FONT_OPTIONS", () => {
  it("has a unique id and non-empty family for every font", () => {
    const ids = FONT_OPTIONS.map((font) => font.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const font of FONT_OPTIONS) {
      expect(font.name.length).toBeGreaterThan(0);
      expect(font.family.length).toBeGreaterThan(0);
    }
  });
});
