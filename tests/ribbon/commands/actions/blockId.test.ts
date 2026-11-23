import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertBlockId, randomBlockId } from "../../../../src/ribbon/commands/actions/blockId";

function run(text: string, line = 0, generate: () => string = () => "abc123"): string {
  const editor = createMockEditor(text, { line, ch: 0 });
  insertBlockId(editor, generate);
  return editor.getValue();
}

describe("insertBlockId", () => {
  it("appends an ID to the end of the cursor's paragraph", () => {
    expect(run("Some text")).toBe("Some text ^abc123");
  });

  it("puts the ID on the last line of a multi-line paragraph, whichever line the cursor is on", () => {
    expect(run("one\ntwo\n\nnext", 0)).toBe("one\ntwo ^abc123\n\nnext");
    expect(run("one\ntwo\n\nnext", 1)).toBe("one\ntwo ^abc123\n\nnext");
  });

  it("puts the ID on the list item itself, not the end of the list", () => {
    expect(run("- a\n- b\n- c", 1)).toBe("- a\n- b ^abc123\n- c");
    expect(run("1. a\n2. b", 0)).toBe("1. a ^abc123\n2. b");
  });

  it("replaces trailing whitespace instead of leaving a gap", () => {
    expect(run("Some text   ")).toBe("Some text ^abc123");
  });

  it("puts the ID on its own line below quotes and tables", () => {
    expect(run("> quoted\n> more\n\nafter", 0)).toBe("> quoted\n> more\n\n^abc123\n\nafter");
    expect(run("| a | b |\n|---|---|\n| 1 | 2 |", 2)).toBe("| a | b |\n|---|---|\n| 1 | 2 |\n\n^abc123");
  });

  it("does nothing on blank lines, headings and fenced code", () => {
    expect(run("a\n\nb", 1)).toBe("a\n\nb");
    expect(run("# Heading")).toBe("# Heading");
    expect(run("```\ncode\n```", 1)).toBe("```\ncode\n```");
  });

  it("does not stretch a paragraph across a following heading, list or fence", () => {
    expect(run("para\n# Head")).toBe("para ^abc123\n# Head");
    expect(run("para\n- item")).toBe("para ^abc123\n- item");
    expect(run("para\n```\ncode\n```")).toBe("para ^abc123\n```\ncode\n```");
  });

  it("leaves blocks that already have an ID untouched", () => {
    expect(run("Text ^exist-1")).toBe("Text ^exist-1");
    expect(run("> quote\n\n^own1", 0)).toBe("> quote\n\n^own1");
  });

  it("does not treat a caret mid-line as an existing ID", () => {
    expect(run("x ^2 is a power")).toBe("x ^2 is a power ^abc123");
  });

  it("regenerates an ID that is already used elsewhere in the note", () => {
    const ids = ["taken1", "taken1", "fresh2"];
    expect(run("a ^taken1\n\nb", 2, () => ids.shift()!)).toBe("a ^taken1\n\nb ^fresh2");
  });
});

describe("randomBlockId", () => {
  it("makes six lowercase alphanumeric characters", () => {
    for (let i = 0; i < 50; i++) expect(randomBlockId()).toMatch(/^[a-z0-9]{6}$/);
  });
});
