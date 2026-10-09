import { App, Component, MarkdownRenderer, Notice, Setting, TFile } from "obsidian";
import type { EditorLike } from "./types";
import { FormModal } from "./formModal";
import { buildHtmlDocument, defaultSaveAsPath, normalizeSaveAsPath, splitPath, uniquePath } from "./fileText";

/** Runs one of Obsidian's own commands; they are not part of the typed API. */
function runObsidianCommand(app: App, id: string): void {
  const commands = (app as unknown as { commands?: { executeCommandById(id: string): boolean } }).commands;
  if (!commands?.executeCommandById(id)) new Notice(`Ribbon Bar: command "${id}" is not available.`);
}

function activeNote(app: App): TFile | null {
  const file = app.workspace.getActiveFile();
  if (!file) new Notice("Ribbon Bar: no note is open.");
  return file;
}

async function openInNewTab(app: App, file: TFile): Promise<void> {
  await app.workspace.getLeaf("tab").openFile(file);
}

export async function newNote(_editor: EditorLike, app: App): Promise<void> {
  const folder = app.fileManager.getNewFileParent(app.workspace.getActiveFile()?.path ?? "").path;
  const path = uniquePath(folder === "/" ? "" : folder, "Untitled", "md", (p) => app.vault.getAbstractFileByPath(p) !== null);
  await openInNewTab(app, await app.vault.create(path, ""));
}

export function openNote(_editor: EditorLike, app: App): void {
  runObsidianCommand(app, "switcher:open");
}

export function moveNote(_editor: EditorLike, app: App): void {
  if (activeNote(app)) runObsidianCommand(app, "file-explorer:move-file");
}

export function exportPdf(_editor: EditorLike, app: App): void {
  if (activeNote(app)) runObsidianCommand(app, "workspace:export-pdf");
}

/** Asks for a file from outside the vault with the system file dialog. */
function pickFileFromDisk(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Copies a Markdown or text file from disk into the vault and opens it. */
export async function openFileFromDisk(_editor: EditorLike, app: App): Promise<void> {
  const picked = await pickFileFromDisk();
  if (!picked) return;
  const { basename, extension } = splitPath(picked.name);
  const folder = app.fileManager.getNewFileParent(app.workspace.getActiveFile()?.path ?? "").path;
  const path = uniquePath(folder === "/" ? "" : folder, basename, extension === "txt" ? "md" : extension || "md", (p) => app.vault.getAbstractFileByPath(p) !== null);
  await openInNewTab(app, await app.vault.create(path, await picked.text()));
  new Notice(`Ribbon Bar: imported ${picked.name} as ${path}.`);
}

class SaveAsModal extends FormModal {
  private path: string;

  constructor(
    app: App,
    editor: EditorLike,
    private source: TFile
  ) {
    super(app, editor, "Save as");
    this.path = defaultSaveAsPath(source.path);
  }

  onOpen(): void {
    new Setting(this.contentEl)
      .setName("Save a copy as")
      .setDesc("A path in the vault. Folders are created as needed.")
      .addText((text) => {
        text.setValue(this.path);
        text.onChange((value) => (this.path = value));
        this.submitOnEnter(text.inputEl);
        window.setTimeout(() => text.inputEl.select(), 0);
      });
    this.addInsertButton("Save");
  }

  protected submit(): void {
    void this.save();
  }

  private async save(): Promise<void> {
    const path = normalizeSaveAsPath(this.path);
    if (!path) {
      new Notice("Ribbon Bar: enter a file name.");
      return;
    }
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(`Ribbon Bar: ${path} already exists.`);
      return;
    }
    const folder = splitPath(path).folder;
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    const copy = await this.app.vault.create(path, await this.app.vault.read(this.source));
    this.close();
    await openInNewTab(this.app, copy);
  }
}

export function openSaveAsModal(editor: EditorLike, app: App): void {
  const file = activeNote(app);
  if (file) new SaveAsModal(app, editor, file).open();
}

/** Lets the user choose where to save: the browser save dialog, else a download. */
async function saveWithDialog(name: string, html: string): Promise<boolean> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>;
  }).showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description: "HTML", accept: { "text/html": [".html"] } }] });
      const writable = await handle.createWritable();
      await writable.write(html);
      await writable.close();
      return true;
    } catch (error) {
      if ((error as Error).name === "AbortError") return false;
      throw error;
    }
  }

  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function exportHtml(_editor: EditorLike, app: App): Promise<void> {
  const file = activeNote(app);
  if (!file) return;

  const container = document.createElement("div");
  const component = new Component();
  component.load();
  try {
    await MarkdownRenderer.render(app, await app.vault.read(file), container, file.path, component);
    // Embeds and code blocks finish rendering shortly after render() resolves.
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    if (await saveWithDialog(`${file.basename}.html`, buildHtmlDocument(file.basename, container.innerHTML))) {
      new Notice(`Ribbon Bar: exported ${file.basename}.html.`);
    }
  } finally {
    component.unload();
  }
}
