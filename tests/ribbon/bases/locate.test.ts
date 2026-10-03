import { describe, expect, it } from "vitest";
import {
  baseAtCursor,
  describeRef,
  findFenceEnd,
  formatBaseBlock,
  formatBaseEmbed,
  isBaseFence,
  locateBases,
} from "../../../src/ribbon/bases/locate";

const lines = (text: string) => text.split("\n");

describe("locateBases", () => {
  it("finds a base code block with its YAML", () => {
    const refs = locateBases(lines("intro\n```base\nviews:\n  - type: table\n```\noutro"));
    expect(refs).toEqual([{ type: "block", startLine: 1, endLine: 4, yaml: "views:\n  - type: table" }]);
  });

  it("finds embeds with optional view and alias", () => {
    const refs = locateBases(lines("see ![[Tasks.base]] and ![[Folder/Projects.base#Board|alias]]"));
    expect(refs).toEqual([
      { type: "embed", line: 0, from: 4, to: 19, linkpath: "Tasks.base", viewName: undefined },
      { type: "embed", line: 0, from: 24, to: 61, linkpath: "Folder/Projects.base", viewName: "Board" },
    ]);
  });

  it("ignores non-base fences, ordinary embeds, and embeds inside code fences", () => {
    const text = "```js\n![[Hidden.base]]\n```\n![[image.png]]\n![[note]]\n```ts\nx\n```";
    expect(locateBases(lines(text))).toEqual([]);
  });

  it("handles longer and tilde fences, and several bases in order", () => {
    const text = "````base\nviews: []\n````\n![[A.base]]\n~~~base\nviews: []\n~~~";
    const refs = locateBases(lines(text));
    expect(refs.map((r) => r.type)).toEqual(["block", "embed", "block"]);
    expect((refs[0] as { endLine: number }).endLine).toBe(2);
  });

  it("does not let a shorter inner fence close a longer one", () => {
    const text = "````base\n```\nnot closed yet\n````";
    expect(locateBases(lines(text))).toEqual([{ type: "block", startLine: 0, endLine: 3, yaml: "```\nnot closed yet" }]);
  });

  it("stops at an unclosed fence", () => {
    expect(locateBases(lines("```base\nviews: []\n![[A.base]]"))).toEqual([]);
  });

  it("returns nothing for an empty note", () => {
    expect(locateBases([""])).toEqual([]);
  });
});

describe("fences", () => {
  it("recognises base fences", () => {
    expect(isBaseFence("```base")).toBe(true);
    expect(isBaseFence("  ```base  ")).toBe(true);
    expect(isBaseFence("```basement")).toBe(false);
    expect(isBaseFence("```")).toBe(false);
  });

  it("finds a fence's end, or -1", () => {
    expect(findFenceEnd(["```base", "x", "```"], 0)).toBe(2);
    expect(findFenceEnd(["```base", "x"], 0)).toBe(-1);
    expect(findFenceEnd(["not a fence"], 0)).toBe(-1);
  });
});

describe("baseAtCursor", () => {
  const refs = locateBases(lines("```base\nviews: []\n```\ntext ![[A.base]] mid ![[B.base]]\nplain"));

  it("returns the block when the cursor is anywhere in it, fences included", () => {
    for (const line of [0, 1, 2]) expect(baseAtCursor(refs, { line, ch: 0 })).toBe(refs[0]);
  });

  it("returns the embed under the cursor, else the first on the line", () => {
    expect((baseAtCursor(refs, { line: 3, ch: 7 }) as { linkpath: string }).linkpath).toBe("A.base");
    expect((baseAtCursor(refs, { line: 3, ch: 28 }) as { linkpath: string }).linkpath).toBe("B.base");
    expect((baseAtCursor(refs, { line: 3, ch: 0 }) as { linkpath: string }).linkpath).toBe("A.base");
  });

  it("returns null elsewhere", () => {
    expect(baseAtCursor(refs, { line: 4, ch: 0 })).toBeNull();
    expect(baseAtCursor([], { line: 0, ch: 0 })).toBeNull();
  });
});

describe("formatting and descriptions", () => {
  it("formats blocks and embeds", () => {
    expect(formatBaseBlock("views: []\n")).toBe("```base\nviews: []\n```");
    expect(formatBaseEmbed("Tasks.base")).toBe("![[Tasks.base]]");
    expect(formatBaseEmbed("Tasks.base", "Board")).toBe("![[Tasks.base#Board]]");
  });

  it("describes references for pickers", () => {
    expect(describeRef({ type: "block", startLine: 4, endLine: 8, yaml: "" })).toBe("Inline base (line 5)");
    expect(describeRef({ type: "embed", line: 1, from: 0, to: 1, linkpath: "A.base" })).toBe("A.base (line 2)");
    expect(describeRef({ type: "embed", line: 1, from: 0, to: 1, linkpath: "A.base", viewName: "Board" })).toBe("A.base › Board (line 2)");
  });
});
