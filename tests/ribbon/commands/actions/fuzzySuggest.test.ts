import { describe, expect, it } from "vitest";
import { fuzzyFilter, RESULT_LIMIT, suggestNotes } from "../../../../src/ribbon/commands/actions/fuzzySuggest";
import { makeFile } from "../../../support/vault";

describe("fuzzyFilter", () => {
  const words = ["banana", "apple", "grape"];

  it("keeps everything, in order, for a blank query", () => {
    expect(fuzzyFilter(words, "", (w) => w)).toBe(words);
    expect(fuzzyFilter(words, "   ", (w) => w)).toBe(words);
  });

  it("keeps only matches", () => {
    expect(fuzzyFilter(words, "ap", (w) => w)).toEqual(["apple", "grape"]);
    expect(fuzzyFilter(words, "zzz", (w) => w)).toEqual([]);
  });

  it("ranks tighter matches first", () => {
    expect(fuzzyFilter(["a long name with p", "ap"], "ap", (w) => w)).toEqual(["ap", "a long name with p"]);
  });

  it("matches against the text the caller extracts, returning the original items", () => {
    const items = [{ id: 1, name: "Alpha" }, { id: 2, name: "Beta" }];
    expect(fuzzyFilter(items, "bet", (i) => i.name)).toEqual([items[1]]);
  });
});

describe("suggestNotes", () => {
  const files = [makeFile("Alpha.md"), makeFile("Beta.md")];

  it("lists files for a blank query without a create option", () => {
    expect(suggestNotes(files, "").map((s) => s.type)).toEqual(["file", "file"]);
  });

  it("appends a create option carrying the trimmed query when nothing matches exactly", () => {
    expect(suggestNotes(files, "  bet ").at(-1)).toEqual({ type: "create", name: "bet" });
  });

  it("omits the create option for an exact, case-insensitive match", () => {
    expect(suggestNotes(files, "ALPHA").some((s) => s.type === "create")).toBe(false);
  });

  it(`caps file results at ${RESULT_LIMIT} but still offers to create`, () => {
    const many = Array.from({ length: 30 }, (_, i) => makeFile(`Note${i}.md`));
    const results = suggestNotes(many, "note");
    expect(results.filter((s) => s.type === "file")).toHaveLength(RESULT_LIMIT);
    expect(results.at(-1)).toEqual({ type: "create", name: "note" });
  });
});
