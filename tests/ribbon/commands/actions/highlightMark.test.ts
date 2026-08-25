import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { highlightWithColor } from "../../../../src/ribbon/commands/actions/highlightMark";

describe("highlightWithColor", () => {
  it("wraps the selection in a <mark> tag with the given background color", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe('<mark style="background-color: #ffd700;">hi</mark>');
  });

  it("inserts a placeholder and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe('<mark style="background-color: #ffd700;">highlighted text</mark>');
    expect(editor.getSelection()).toBe("highlighted text");
  });
});
