import { describe, expect, it } from "vitest";
import { collectBlockCandidates } from "../../../../src/ribbon/commands/actions/embedBlocks";

describe("collectBlockCandidates", () => {
  it("returns an empty array when the cache has no blocks or list items", () => {
    expect(collectBlockCandidates({})).toEqual([]);
  });

  it("includes paragraph/heading-level blocks from cache.blocks", () => {
    const cache = {
      blocks: {
        abc123: { id: "abc123", position: { start: { line: 4, col: 0, offset: 0 }, end: { line: 4, col: 10, offset: 10 } } },
      },
    };
    expect(collectBlockCandidates(cache)).toEqual([{ id: "abc123", line: 4 }]);
  });

  it("includes a block ID attached to a list item, even when cache.blocks omits it", () => {
    const cache = {
      listItems: [
        {
          position: { start: { line: 2, col: 0, offset: 0 }, end: { line: 2, col: 12, offset: 12 } },
        },
        {
          id: "list",
          position: { start: { line: 3, col: 0, offset: 0 }, end: { line: 3, col: 15, offset: 15 } },
        },
      ],
    };
    expect(collectBlockCandidates(cache)).toEqual([{ id: "list", line: 3 }]);
  });

  it("merges cache.blocks and list-item block IDs together", () => {
    const cache = {
      blocks: {
        abc123: { id: "abc123", position: { start: { line: 4, col: 0, offset: 0 }, end: { line: 4, col: 10, offset: 10 } } },
      },
      listItems: [
        {
          id: "list",
          position: { start: { line: 3, col: 0, offset: 0 }, end: { line: 3, col: 15, offset: 15 } },
        },
      ],
    };
    expect(collectBlockCandidates(cache)).toEqual([
      { id: "abc123", line: 4 },
      { id: "list", line: 3 },
    ]);
  });

  it("excludes list items with no block ID", () => {
    const cache = {
      listItems: [
        { position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 5, offset: 5 } } },
        { position: { start: { line: 1, col: 0, offset: 0 }, end: { line: 1, col: 5, offset: 5 } } },
      ],
    };
    expect(collectBlockCandidates(cache)).toEqual([]);
  });

  it("includes a whole-list block ID recorded on the list's section entry", () => {
    const cache = {
      listItems: [
        { position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 5, offset: 5 } } },
        { position: { start: { line: 1, col: 0, offset: 0 }, end: { line: 1, col: 5, offset: 5 } } },
      ],
      sections: [
        {
          type: "list",
          id: "list",
          position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 2, col: 5, offset: 20 } },
        },
      ],
    };
    expect(collectBlockCandidates(cache)).toEqual([{ id: "list", line: 0 }]);
  });

  it("excludes sections with no block ID", () => {
    const cache = {
      sections: [
        { type: "paragraph", position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 5, offset: 5 } } },
      ],
    };
    expect(collectBlockCandidates(cache)).toEqual([]);
  });

  it("does not duplicate an ID that appears in more than one cache source", () => {
    const cache = {
      blocks: {
        list: { id: "list", position: { start: { line: 2, col: 0, offset: 0 }, end: { line: 2, col: 5, offset: 5 } } },
      },
      sections: [
        { type: "list", id: "list", position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 2, col: 5, offset: 20 } } },
      ],
    };
    expect(collectBlockCandidates(cache)).toEqual([{ id: "list", line: 2 }]);
  });
});
