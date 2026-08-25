import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { buildMarkStyle, highlightWithColor } from "../../../../src/ribbon/commands/actions/highlightMark";

describe("buildMarkStyle", () => {
  it("includes the background color plus rounded corners and breathing-room padding", () => {
    expect(buildMarkStyle("#ffd700")).toBe(
      "background-color: #ffd700; border-radius: 0.2em; padding: 0.1em 0.2em;"
    );
  });
});

describe("highlightWithColor", () => {
  it("wraps the selection in a <mark> tag with the given background color and rounded styling", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe(
      '<mark style="background-color: #ffd700; border-radius: 0.2em; padding: 0.1em 0.2em;">hi</mark>'
    );
  });

  it("inserts a placeholder and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe(
      '<mark style="background-color: #ffd700; border-radius: 0.2em; padding: 0.1em 0.2em;">highlighted text</mark>'
    );
    expect(editor.getSelection()).toBe("highlighted text");
  });
});
