import { describe, expect, it } from "vitest";
import { collectNoteProperties, kindOf, propertyOptions } from "../../../src/ribbon/bases/catalog";
import { buildStarterBase, baseFileName } from "../../../src/ribbon/bases/starter";
import { makeFile } from "../../support/vault";

function appWith(frontmatters: (Record<string, unknown> | undefined)[]) {
  const files = frontmatters.map((_, i) => makeFile(`n${i}.md`));
  return {
    vault: { getMarkdownFiles: () => files },
    metadataCache: { getFileCache: (file: { path: string }) => ({ frontmatter: frontmatters[Number(file.path.slice(1, -3))] }) },
  } as never;
}

describe("collectNoteProperties", () => {
  it("lists each property once, sorted, with a kind guessed from a sample", () => {
    const app = appWith([
      { status: "open", due: "2025-01-31", tags: ["a"], position: { start: 1 } },
      undefined,
      { rating: 4, done: true, status: "closed" },
    ]);
    expect(collectNoteProperties(app)).toEqual([
      { id: "note.done", kind: "boolean" },
      { id: "note.due", kind: "date" },
      { id: "note.rating", kind: "number" },
      { id: "note.status", kind: "text" },
      { id: "note.tags", kind: "list" },
    ]);
  });

  it("prefers a non-null sample when the first note has an empty value", () => {
    expect(collectNoteProperties(appWith([{ n: null }, { n: 3 }]))).toEqual([{ id: "note.n", kind: "number" }]);
  });

  it("copes with a vault without frontmatter", () => {
    expect(collectNoteProperties(appWith([undefined]))).toEqual([]);
  });
});

describe("propertyOptions", () => {
  it("combines file properties, note properties, formulas and anything the base already references", () => {
    const options = propertyOptions(
      {
        formulas: { total: "a" },
        properties: { "note.legacy": { displayName: "Old" } },
        views: [{ type: "table", name: "T", order: ["note.shown"], sort: [{ property: "note.sorted", direction: "ASC" }], groupBy: { property: "note.grouped", direction: "ASC" } }],
      },
      [{ id: "note.status", kind: "text" }]
    );
    const ids = options.map((o) => o.id);
    expect(ids.slice(0, 3)).toEqual(["file.name", "file.basename", "file.path"]);
    for (const id of ["note.status", "formula.total", "note.legacy", "note.shown", "note.sorted", "note.grouped"]) {
      expect(ids, id).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves kinds, falling back to inference for unknown properties", () => {
    const options = propertyOptions({}, [{ id: "note.n", kind: "number" }]);
    expect(kindOf(options, "note.n")).toBe("number");
    expect(kindOf(options, "file.mtime")).toBe("date");
    expect(kindOf(options, "note.unknown")).toBe("text");
  });
});

describe("buildStarterBase", () => {
  it("is a one-view base showing file names", () => {
    expect(buildStarterBase({ viewType: "table", scope: "all" })).toEqual({
      views: [{ type: "table", name: "Table", order: ["file.name"] }],
    });
  });

  it("names the view and picks its type", () => {
    const config = buildStarterBase({ viewType: "cards", viewName: " Gallery ", scope: "all" });
    expect(config.views![0]).toMatchObject({ type: "cards", name: "Gallery" });
  });

  it.each([
    [{ scope: "folder", notePath: "Projects/Active/N.md" }, 'file.inFolder("Projects/Active")'],
    [{ scope: "tag", tag: "#work" }, 'file.hasTag("work")'],
    [{ scope: "links" }, "file.hasLink(this.file)"],
  ] as const)("adds a first filter for %j", (extra, expression) => {
    const config = buildStarterBase({ viewType: "table", ...extra });
    expect(config.filters).toEqual({ and: [expression] });
  });

  it("skips the filter when it can't be built", () => {
    expect(buildStarterBase({ viewType: "table", scope: "folder", notePath: "Root.md" }).filters).toBeUndefined();
    expect(buildStarterBase({ viewType: "table", scope: "tag", tag: " " }).filters).toBeUndefined();
  });
});

describe("baseFileName", () => {
  it.each([
    ["Projects", "Projects.base"],
    ["Projects.base", "Projects.base"],
    ["PROJECTS.BASE", "PROJECTS.BASE"],
    ["  a/b:c  ", "a-b-c.base"],
    ["", "Untitled.base"],
    ["  ", "Untitled.base"],
  ])("%j -> %j", (input, expected) => {
    expect(baseFileName(input)).toBe(expected);
  });
});
