// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, TFile, modals, notices, obsidianLog } from "obsidian";
import { newNote, openSaveAsModal, openNote, moveNote, exportPdf } from "../../../../src/ribbon/commands/actions/file";
import { createMockEditor } from "../../../support/mockEditor";
import { makeFile } from "../../../support/vault";

beforeEach(() => obsidianLog.reset());

function makeApp(files: Record<string, string> = {}, activePath: string | null = "Note.md", newFileFolder = "/") {
  const tfiles = new Map<string, TFile>();
  const contents = new Map<string, string>();
  for (const [path, text] of Object.entries(files)) {
    tfiles.set(path, makeFile(path));
    contents.set(path, text);
  }
  const folders = new Set<string>();
  const openFile = vi.fn(async () => undefined);
  const getLeaf = vi.fn(() => ({ openFile }));
  const executeCommandById = vi.fn(() => true);

  const app = new App() as any;
  app.vault = {
    read: async (file: TFile) => contents.get(file.path) ?? "",
    create: async (path: string, data: string) => {
      const file = makeFile(path);
      tfiles.set(path, file);
      contents.set(path, data);
      return file;
    },
    createFolder: async (path: string) => void folders.add(path),
    getAbstractFileByPath: (path: string) => tfiles.get(path) ?? (folders.has(path) ? ({ path } as never) : null),
  };
  app.workspace = { getActiveFile: () => (activePath ? makeFile(activePath) : null), getLeaf };
  app.fileManager = { getNewFileParent: () => ({ path: newFileFolder }) };
  app.commands = { executeCommandById };
  return { app, contents, folders, openFile, getLeaf, executeCommandById };
}

const editor = createMockEditor("");

describe("newNote", () => {
  it("creates Untitled.md in the new-note folder and opens it in a new tab", async () => {
    const { app, contents, openFile, getLeaf } = makeApp({}, "Note.md", "inbox");
    await newNote(editor, app);
    expect(contents.get("inbox/Untitled.md")).toBe("");
    expect(getLeaf).toHaveBeenCalledWith("tab");
    expect(openFile).toHaveBeenCalledOnce();
  });

  it("numbers the name when Untitled.md is taken, and uses the root for '/'", async () => {
    const { app, contents } = makeApp({ "Untitled.md": "x" });
    await newNote(editor, app);
    expect(contents.has("Untitled 1.md")).toBe(true);
  });
});

describe("Save As", () => {
  function openModal(app: unknown) {
    openSaveAsModal(editor, app as never);
    const modal = modals[modals.length - 1];
    const input = modal.contentEl.querySelector("input") as HTMLInputElement;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event("input"));
    };
    const save = () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      return new Promise((resolve) => setTimeout(resolve, 0));
    };
    return { modal, input, type, save };
  }

  it("suggests a copy beside the original", () => {
    const { app } = makeApp({ "a/Note.md": "hi" }, "a/Note.md");
    expect(openModal(app).input.value).toBe("a/Note copy.md");
  });

  it("copies the note's text, creates missing folders, opens the copy and closes", async () => {
    const { app, contents, folders, openFile } = makeApp({ "Note.md": "hello" });
    const { modal, type, save } = openModal(app);
    type("archive/Backup");
    await save();
    expect(contents.get("archive/Backup.md")).toBe("hello");
    expect(folders.has("archive")).toBe(true);
    expect(openFile).toHaveBeenCalledOnce();
    expect(modal.opened).toBe(false);
  });

  it("refuses an empty name", async () => {
    const { app, openFile } = makeApp({ "Note.md": "hello" });
    const { modal, type, save } = openModal(app);
    type("   ");
    await save();
    expect(notices).toContain("Ribbon Bar: enter a file name.");
    expect(openFile).not.toHaveBeenCalled();
    expect(modal.opened).toBe(true);
  });

  it("refuses to overwrite an existing file", async () => {
    const { app, contents } = makeApp({ "Note.md": "hello", "Other.md": "keep" });
    const { type, save } = openModal(app);
    type("Other.md");
    await save();
    expect(notices).toContain("Ribbon Bar: Other.md already exists.");
    expect(contents.get("Other.md")).toBe("keep");
  });

  it("does nothing but warn when no note is open", () => {
    const { app } = makeApp({}, null);
    openSaveAsModal(editor, app as never);
    expect(modals).toHaveLength(0);
    expect(notices).toContain("Ribbon Bar: no note is open.");
  });
});

describe("Obsidian command shortcuts", () => {
  it("Open runs the quick switcher", () => {
    const { app, executeCommandById } = makeApp();
    openNote(editor, app);
    expect(executeCommandById).toHaveBeenCalledWith("switcher:open");
  });

  it("Move and Export PDF run Obsidian's commands for the open note, and need one", () => {
    const { app, executeCommandById } = makeApp();
    moveNote(editor, app);
    exportPdf(editor, app);
    expect(executeCommandById.mock.calls).toEqual([["file-explorer:move-file"], ["workspace:export-pdf"]]);

    const none = makeApp({}, null);
    moveNote(editor, none.app);
    expect(none.executeCommandById).not.toHaveBeenCalled();
  });
});
