import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { buildMarkOpenTag, highlightWithColor } from "../../../../src/ribbon/commands/actions/highlightMark";

describe("buildMarkOpenTag", () => {
  it("carries the shared styling class plus the per-color background inline", () => {
    expect(buildMarkOpenTag("#ffd700")).toBe(
      '<mark class="ribbon-bar-highlight" style="background-color: #ffd700;">'
    );
  });
});

describe("highlightWithColor", () => {
  it("wraps the selection in a <mark> tag with the styling class and the given background color", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe(
      '<mark class="ribbon-bar-highlight" style="background-color: #ffd700;">hi</mark>'
    );
  });

  it("inserts a placeholder and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    highlightWithColor("#ffd700")(editor);
    expect(editor.getValue()).toBe(
      '<mark class="ribbon-bar-highlight" style="background-color: #ffd700;">highlighted text</mark>'
    );
    expect(editor.getSelection()).toBe("highlighted text");
  });
});
