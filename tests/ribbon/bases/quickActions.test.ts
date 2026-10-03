// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notices, obsidianLog } from "obsidian";
import { addBaseFilter, addBaseView, editBase, quickFilterSpecs } from "../../../src/ribbon/bases/quickActions";
import { createMockEditor } from "../../support/mockEditor";
import { makeBaseApp } from "../../support/baseEnv";

beforeEach(() => obsidianLog.reset());

const block = "```base\nviews:\n  - type: table\n    name: Table\n```";
const settle = () => vi.waitFor(() => expect(notices.length).toBeGreaterThan(0));

describe("editBase", () => {
  it("applies a change to the base the cursor is in and reports it", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    await editBase(editor, app, (config) => ({ config: { ...config, formulas: { a: "price" } }, message: "Done." }));
    expect(editor.getValue()).toContain("formulas:\n  a: price");
    expect(notices).toEqual(["Done."]);
  });

  it("leaves the base alone when the change declines", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    await editBase(editor, app, () => null);
    expect(editor.getValue()).toBe(block);
    expect(notices).toEqual([]);
  });

  it("does nothing, with a message, when there is no base", async () => {
    const { app } = makeBaseApp();
    await editBase(createMockEditor("plain"), app, () => ({ config: {}, message: "never" }));
    expect(notices[0]).toContain("No base in this note yet");
  });

  it("refuses to edit YAML it can't read", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor("```base\nviews: [oops\n```", { line: 1, ch: 0 });
    await editBase(editor, app, () => ({ config: {}, message: "never" }));
    expect(notices[0]).toContain("can't be read");
    expect(editor.getValue()).toBe("```base\nviews: [oops\n```");
  });

  it("reports an error thrown while saving", async () => {
    const { app } = makeBaseApp({ "T.base": "views: []" });
    app.vault.process = async () => {
      throw new Error("locked");
    };
    await editBase(createMockEditor("![[T.base]]", { line: 0, ch: 3 }), app, (config) => ({ config, message: "never" }));
    expect(notices[0]).toBe("Couldn't update the base: locked");
  });
});

describe("addBaseView", () => {
  it("adds a view of the chosen type, named after it", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    addBaseView("cards")(editor, app);
    await settle();
    expect(editor.getValue()).toContain("- type: cards\n    name: Cards");
    expect(notices[0]).toBe('Added the view "Cards".');
  });

  it("numbers the name when it is taken", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    addBaseView("table")(editor, app);
    await settle();
    expect(editor.getValue()).toContain("name: Table 2");
  });

  it("adds to a standalone base file", async () => {
    const { app, contents } = makeBaseApp({ "T.base": "views:\n  - type: table\n    name: Table\n" });
    addBaseView("list")(createMockEditor("![[T.base]]", { line: 0, ch: 3 }), app);
    await settle();
    expect(contents.get("T.base")).toContain("type: list");
  });
});

describe("addBaseFilter and quick filters", () => {
  it("adds the condition to the base's own filters", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    addBaseFilter(() => ({ kind: "linksToThis" }))(editor, app);
    await settle();
    expect(editor.getValue()).toContain("filters:\n  and:\n    - file.hasLink(this.file)");
    expect(notices[0]).toBe("Added the filter file.hasLink(this.file)");
  });

  it("says when a filter can't be built, without touching the note", () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(block, { line: 1, ch: 0 });
    addBaseFilter(() => null)(editor, app);
    expect(notices).toEqual(["That filter can't be added from here."]);
    expect(editor.getValue()).toBe(block);
  });

  it("offers the note's folder plus the ready-made filters", () => {
    expect(quickFilterSpecs().map((q) => q.id)).toEqual([
      "this-folder",
      "links-to-this",
      "linked-from-this",
      "modified-7",
      "created-7",
      "modified-30",
    ]);
  });

  it("derives the folder filter from the active note, and has none for a root note", () => {
    const folder = quickFilterSpecs()[0];
    expect(folder.specFor(makeBaseApp({}, "A/B/Note.md").app)).toEqual({ kind: "folder", folder: "A/B" });
    expect(folder.specFor(makeBaseApp({}, "Note.md").app)).toBeNull();
  });
});

describe("edge cases", () => {
  it("reports a failure that isn't an Error", async () => {
    const { app } = makeBaseApp({ "T.base": "views: []" });
    app.vault.process = async () => Promise.reject("busy");
    await editBase(createMockEditor("![[T.base]]", { line: 0, ch: 3 }), app, (config) => ({ config, message: "never" }));
    expect(notices[0]).toBe("Couldn't update the base: busy");
  });

  it("has no folder filter when no note is active", () => {
    const { app } = makeBaseApp();
    app.workspace.getActiveFile = () => null;
    expect(quickFilterSpecs()[0].specFor(app)).toBeNull();
  });
});
