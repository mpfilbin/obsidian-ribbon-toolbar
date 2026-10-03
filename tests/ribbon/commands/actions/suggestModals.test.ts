// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, modals, obsidianLog, type TFile } from "obsidian";
import { openLinkModal } from "../../../../src/ribbon/commands/actions/linkModal";
import { openHeadingLinkModal } from "../../../../src/ribbon/commands/actions/headingLinkModal";
import { openEmbedModal } from "../../../../src/ribbon/commands/actions/embedModal";
import { createMockEditor } from "../../../support/mockEditor";
import { makeFile } from "../../../support/vault";

// The suggest modals are driven the way Obsidian drives them: ask for
// suggestions, render each one, then choose one.
interface SuggestModalLike {
  placeholder: string;
  getSuggestions(query: string): unknown[] | Promise<unknown[]>;
  renderSuggestion(item: unknown, el: HTMLElement): void;
  onChooseSuggestion(item: unknown, evt: unknown): void;
}

const latest = () => modals.at(-1) as unknown as SuggestModalLike & { close(): void; opened: boolean };

function rendered(modal: SuggestModalLike, item: unknown): HTMLElement {
  const el = document.createElement("div");
  modal.renderSuggestion(item, el);
  return el;
}

function fakeApp(files: TFile[], extra: Record<string, unknown> = {}) {
  const active = files[0] ?? null;
  const app = new App() as any;
  app.vault = {
    getMarkdownFiles: () => files.filter((f) => f.extension === "md"),
    getFiles: () => files,
    cachedRead: vi.fn(async () => ""),
  };
  app.workspace = { getActiveFile: () => active };
  app.metadataCache = {
    fileToLinktext: (file: TFile) => file.basename,
    getFirstLinkpathDest: (link: string) => files.find((f) => f.basename === link) ?? null,
    getFileCache: () => null,
    ...extra,
  };
  return app;
}

beforeEach(() => obsidianLog.reset());

describe("link modal", () => {
  const files = [makeFile("Alpha.md"), makeFile("notes/Beta.md"), makeFile("notes/Gamma.md")];

  function open(selection?: string) {
    const editor = createMockEditor(selection ?? "");
    if (selection) editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: selection.length });
    const focus = vi.spyOn(editor, "focus");
    openLinkModal(editor, fakeApp(files));
    return { editor, focus, modal: latest() };
  }

  it("lists every markdown file when the query is empty, with no create option", () => {
    const { modal } = open();
    expect(modal.placeholder).toBe("Find or create a note...");
    expect(modal.getSuggestions("")).toHaveLength(3);
  });

  it("fuzzy filters files and offers to create a note when there is no exact match", () => {
    const { modal } = open();
    const results = modal.getSuggestions("bet") as any[];
    expect(results.map((r) => r.type)).toEqual(["file", "create"]);
    expect(results[0].file.basename).toBe("Beta");
    expect(results[1].name).toBe("bet");
  });

  it("does not offer to create a note that already exists (case-insensitive)", () => {
    const { modal } = open();
    const results = modal.getSuggestions("alpha") as any[];
    expect(results.some((r) => r.type === "create")).toBe(false);
  });

  it("caps file suggestions at 20", () => {
    const many = Array.from({ length: 30 }, (_, i) => makeFile(`Note${i}.md`));
    const editor = createMockEditor("");
    openLinkModal(editor, fakeApp(many));
    expect(latest().getSuggestions("")).toHaveLength(20);
  });

  it("renders file rows with their folder, root files without, and the create row", () => {
    const { modal } = open();
    expect(rendered(modal, { type: "file", file: files[1] }).textContent).toContain("notes");
    expect(rendered(modal, { type: "file", file: files[0] }).querySelector("small")).toBeNull();
    expect(rendered(modal, { type: "create", name: "New" }).textContent).toBe('Create new note: "New"');
  });

  it("inserts a wikilink to the chosen file and refocuses the editor", () => {
    const { modal, editor, focus } = open();
    modal.onChooseSuggestion({ type: "file", file: files[1] }, null);
    expect(editor.getValue()).toBe("[[Beta]]");
    expect(focus).toHaveBeenCalled();
  });

  it("uses the selected text as the alias and the typed name for new notes", () => {
    const { modal, editor } = open("click me");
    modal.onChooseSuggestion({ type: "create", name: "Brand New" }, null);
    expect(editor.getValue()).toBe("[[Brand New|click me]]");
  });

  it("resolves link text against the active file's path, or an empty path with no active file", () => {
    const editor = createMockEditor("");
    const app = fakeApp(files);
    app.workspace.getActiveFile = () => null;
    const fileToLinktext = vi.fn((file: TFile, source: string) => `${source}|${file.basename}`);
    app.metadataCache.fileToLinktext = fileToLinktext;
    openLinkModal(editor, app);
    latest().onChooseSuggestion({ type: "file", file: files[0] }, null);
    expect(fileToLinktext).toHaveBeenCalledWith(files[0], "");
    expect(editor.getValue()).toBe("[[|Alpha]]");
  });

  it("refocuses the editor when closed", () => {
    const { modal, focus } = open();
    modal.opened = true;
    modal.close();
    expect(focus).toHaveBeenCalled();
  });
});

describe("heading link modal", () => {
  const doc = "# Intro\ntext\n## Setup Steps\n### Deep Dive\n```\n# not a heading\n```";

  function open(selection?: string) {
    const editor = createMockEditor(selection ? `${selection}\n${doc}` : doc);
    if (selection) editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: selection.length });
    const focus = vi.spyOn(editor, "focus");
    openHeadingLinkModal(editor, new App() as never);
    return { editor, focus, modal: latest() };
  }

  it("lists the note's headings (ignoring fenced code) when the query is empty", () => {
    const { modal } = open();
    expect(modal.placeholder).toBe("Find a heading in this note...");
    expect((modal.getSuggestions("") as any[]).map((h) => h.text)).toEqual(["Intro", "Setup Steps", "Deep Dive"]);
  });

  it("fuzzy filters headings", () => {
    const { modal } = open();
    expect((modal.getSuggestions("dd") as any[]).map((h) => h.text)).toEqual(["Deep Dive"]);
    expect(modal.getSuggestions("zzz")).toEqual([]);
  });

  it("indents rendered rows by heading level", () => {
    const { modal } = open();
    const row = rendered(modal, { line: 3, level: 3, text: "Deep Dive" }).firstElementChild as HTMLElement;
    expect(row.textContent).toBe("Deep Dive");
    expect(row.style.paddingLeft).toBe("32px");
  });

  it("refocuses the editor when closed", () => {
    const { modal, focus } = open();
    modal.opened = true;
    modal.close();
    expect(focus).toHaveBeenCalled();
  });

  it("inserts a heading link, with the selection as alias when there is one", () => {
    const plain = open();
    plain.modal.onChooseSuggestion({ line: 0, level: 1, text: "Intro" }, null);
    expect(plain.editor.getValue().startsWith("[[#Intro]]")).toBe(true);
    expect(plain.focus).toHaveBeenCalled();

    const aliased = open("see this");
    aliased.modal.onChooseSuggestion({ line: 1, level: 1, text: "Intro" }, null);
    expect(aliased.editor.getValue().startsWith("[[#Intro|see this]]")).toBe(true);
  });
});

describe("embed modal", () => {
  const note = makeFile("Note.md");
  const image = makeFile("assets/pic.png");
  const files = [note, image];

  function open(opts: { selection?: string; cache?: unknown; content?: string } = {}) {
    const editor = createMockEditor(opts.selection ?? "");
    if (opts.selection) editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: opts.selection.length });
    const focus = vi.spyOn(editor, "focus");
    const app = fakeApp(files, { getFileCache: () => opts.cache ?? null });
    app.vault.cachedRead = vi.fn(async () => opts.content ?? "");
    openEmbedModal(editor, app);
    return { editor, focus, app, modal: latest() };
  }

  const cache = {
    headings: [
      { heading: "Alpha Section", level: 1 },
      { heading: "Beta Section", level: 2 },
    ],
    blocks: { abc123: { position: { start: { line: 1 } } }, zzz9: { position: { start: { line: 2 } } } },
  };
  const content = "first\nA block ^abc123\nZ block ^zzz9";

  it("lists all vault files, not just markdown", async () => {
    const { modal } = open();
    expect(await modal.getSuggestions("")).toHaveLength(2);
  });

  it("offers a create option for unknown names and no create option for exact matches", async () => {
    const { modal } = open();
    const results = (await modal.getSuggestions("brand new")) as any[];
    expect(results.at(-1)).toEqual({ type: "create", name: "brand new" });
    expect(((await modal.getSuggestions("note")) as any[]).some((r) => r.type === "create")).toBe(false);
  });

  it("suggests headings after Note#, filtered by the text after #", async () => {
    const { modal } = open({ cache });
    const all = (await modal.getSuggestions("Note#")) as any[];
    expect(all.map((r) => r.heading)).toEqual(["Alpha Section", "Beta Section"]);
    const filtered = (await modal.getSuggestions("Note#beta")) as any[];
    expect(filtered.map((r) => r.heading)).toEqual(["Beta Section"]);
  });

  it("suggests headings of the active note for a bare #", async () => {
    const { modal } = open({ cache });
    expect(((await modal.getSuggestions("#")) as any[]).length).toBe(2);
  });

  it("suggests blocks after Note#^ with previews read from the file, reading it only once", async () => {
    const { modal, app } = open({ cache, content });
    const results = (await modal.getSuggestions("Note#^")) as any[];
    expect(results.map((r) => [r.blockId, r.preview])).toEqual([
      ["abc123", "A block ^abc123"],
      ["zzz9", "Z block ^zzz9"],
    ]);
    const filtered = (await modal.getSuggestions("Note#^zz")) as any[];
    expect(filtered.map((r) => r.blockId)).toEqual(["zzz9"]);
    expect(app.vault.cachedRead).toHaveBeenCalledTimes(1);
  });

  it("returns nothing for fragments of non-markdown files or files without a cache", async () => {
    const { modal } = open({ cache });
    // "pic" resolves to a png: no headings to offer, so it falls back to inserting as typed.
    expect(await modal.getSuggestions("pic#")).toEqual([]);
    const noCache = open();
    expect(await noCache.modal.getSuggestions("Note#")).toEqual([]);
  });

  it("falls back to inserting raw text when nothing matches, but not for a bare fragment delimiter", async () => {
    const { modal } = open();
    expect(await modal.getSuggestions("Missing#Head")).toEqual([{ type: "raw", target: "Missing#Head" }]);
    expect(await modal.getSuggestions("Missing#")).toEqual([]);
  });

  it("renders every suggestion type", () => {
    const { modal } = open();
    expect(rendered(modal, { type: "raw", target: "x" }).textContent).toContain('Embed "x"');
    expect(rendered(modal, { type: "create", name: "N" }).textContent).toContain('Create new note: "N"');
    expect(rendered(modal, { type: "file", file: note }).textContent).toBe("Note");
    const png = rendered(modal, { type: "file", file: image });
    expect(png.textContent).toContain("pic.png");
    expect(png.textContent).toContain("assets");
    const heading = rendered(modal, { type: "heading", file: note, heading: "H" });
    expect(heading.textContent).toBe("HNote");
    const block = rendered(modal, { type: "block", file: note, blockId: "b1", preview: "text" });
    expect(block.textContent).toBe("^b1text");
  });

  it.each([
    [{ type: "file", file: note }, "![[Note]]"],
    [{ type: "heading", file: note, heading: "Head" }, "![[Note#Head]]"],
    [{ type: "block", file: note, blockId: "b1", preview: "" }, "![[Note#^b1]]"],
    [{ type: "create", name: "Fresh" }, "![[Fresh]]"],
    [{ type: "raw", target: "typed#thing" }, "![[typed#thing]]"],
  ])("inserts the right embed for a chosen %j", (suggestion, expected) => {
    const { modal, editor, focus } = open();
    modal.onChooseSuggestion(suggestion, null);
    expect(editor.getValue()).toBe(expected);
    expect(focus).toHaveBeenCalled();
  });

  it("offers no block suggestions when the note has no block ids", async () => {
    const { modal, app } = open({ cache: { headings: [], blocks: {} } });
    expect(await modal.getSuggestions("Note#^")).toEqual([]);
    expect(app.vault.cachedRead).not.toHaveBeenCalled();
  });

  it("refocuses the editor when closed", () => {
    const { modal, focus } = open();
    modal.opened = true;
    modal.close();
    expect(focus).toHaveBeenCalled();
  });

  it("uses the selected text as the embed alias", () => {
    const { modal, editor } = open({ selection: "size" });
    modal.onChooseSuggestion({ type: "file", file: note }, null);
    expect(editor.getValue()).toBe("![[Note|size]]");
  });
});
