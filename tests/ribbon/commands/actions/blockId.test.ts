import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  planBlockId,
  randomBlockId,
  uniqueBlockId,
  validateBlockId,
} from "../../../../src/ribbon/commands/actions/blockId";

function run(text: string, line = 0, id = "abc123"): string {
  const editor = createMockEditor(text, { line, ch: 0 });
  const plan = planBlockId(editor);
  if (plan.type === "insert") plan.insert(id);
  return editor.getValue();
}

function skipReason(text: string, line = 0): string | null {
  const plan = planBlockId(createMockEditor(text, { line, ch: 0 }));
  return plan.type === "skip" ? plan.reason : null;
}

describe("planBlockId", () => {
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

  it("does not stretch a paragraph across a following heading, list or fence", () => {
    expect(run("para\n# Head")).toBe("para ^abc123\n# Head");
    expect(run("para\n- item")).toBe("para ^abc123\n- item");
    expect(run("para\n```\ncode\n```")).toBe("para ^abc123\n```\ncode\n```");
  });

  it("skips blank lines, headings and fenced code, saying why", () => {
    expect(skipReason("a\n\nb", 1)).toMatch(/paragraph, list item, quote or table/);
    expect(skipReason("# Heading")).toMatch(/Heading Link/);
    expect(skipReason("```\ncode\n```", 1)).toMatch(/fenced code/);
    expect(run("# Heading")).toBe("# Heading");
  });

  it("skips blocks that already have an ID and names it", () => {
    expect(skipReason("Text ^exist-1")).toBe("This block already has an ID (^exist-1).");
    expect(skipReason("> quote\n\n^own1", 0)).toBe("This block already has an ID (^own1).");
    expect(run("Text ^exist-1")).toBe("Text ^exist-1");
  });

  it("does not treat a caret mid-line as an existing ID", () => {
    expect(run("x ^2 is a power")).toBe("x ^2 is a power ^abc123");
  });

  it("reports the IDs already used in the note, including standalone ones", () => {
    const plan = planBlockId(createMockEditor("a ^one\n\nb\n\n> q\n\n^two", { line: 2, ch: 0 }));
    expect(plan.type === "insert" && [...plan.taken].sort()).toEqual(["one", "two"]);
  });
});

describe("uniqueBlockId", () => {
  it("regenerates an ID that is already taken", () => {
    const ids = ["taken1", "taken1", "fresh2"];
    expect(uniqueBlockId(new Set(["taken1"]), () => ids.shift()!)).toBe("fresh2");
  });

  it("makes six lowercase alphanumeric characters by default", () => {
    for (let i = 0; i < 50; i++) expect(randomBlockId()).toMatch(/^[a-z0-9]{6}$/);
  });
});

describe("validateBlockId", () => {
  it("accepts letters, numbers and hyphens, ignoring a typed ^ and surrounding space", () => {
    expect(validateBlockId("my-block-1", new Set())).toEqual({ id: "my-block-1" });
    expect(validateBlockId("  ^My-Id  ", new Set())).toEqual({ id: "My-Id" });
  });

  it("rejects empty IDs and other characters", () => {
    for (const bad of ["", "^", "has space", "under_score", "dot."]) {
      expect(validateBlockId(bad, new Set())).toEqual({ error: expect.stringContaining("letters, numbers and hyphens") });
    }
  });

  it("rejects an ID already used in the note", () => {
    expect(validateBlockId("^dup", new Set(["dup"]))).toEqual({ error: "^dup is already used in this note." });
  });
});
