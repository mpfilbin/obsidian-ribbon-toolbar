import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertFootnote } from "../../../../src/ribbon/commands/actions/references";

describe("insertFootnote", () => {
  it("inserts [^1] at the cursor and appends a definition on a new empty document", () => {
    const editor = createMockEditor("text");
    editor.setCursor({ line: 0, ch: 4 });
    insertFootnote(editor);
    expect(editor.getValue()).toBe("text[^1]\n\n[^1]: ");
  });

  it("picks the next unused footnote number", () => {
    const editor = createMockEditor("first[^1] second[^2]");
    editor.setCursor({ line: 0, ch: 21 });
    insertFootnote(editor);
    expect(editor.getValue()).toBe("first[^1] second[^2][^3]\n\n[^3]: ");
  });
});
