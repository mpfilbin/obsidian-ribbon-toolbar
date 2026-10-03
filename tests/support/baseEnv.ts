import { App, TFile } from "obsidian";
import { makeFile } from "./vault";

/** A fake vault holding .base files, plus the metadata-cache bits bases use. */
export function makeBaseApp(files: Record<string, string> = {}, activePath = "Note.md", newFileFolder = "/") {
  const tfiles = new Map<string, TFile>();
  const contents = new Map<string, string>();
  for (const [path, text] of Object.entries(files)) {
    tfiles.set(path, makeFile(path));
    contents.set(path, text);
  }

  const app = new App() as any;
  app.vault = {
    read: async (file: TFile) => contents.get(file.path) ?? "",
    process: async (file: TFile, fn: (data: string) => string) => {
      const next = fn(contents.get(file.path) ?? "");
      contents.set(file.path, next);
      return next;
    },
    create: async (path: string, data: string) => {
      const file = makeFile(path);
      tfiles.set(path, file);
      contents.set(path, data);
      return file;
    },
    getFiles: () => [...tfiles.values()],
    getMarkdownFiles: () => [...tfiles.values()].filter((f) => f.extension === "md"),
    getAbstractFileByPath: (path: string) => tfiles.get(path) ?? null,
    createFolder: async () => undefined,
  };
  app.workspace = { getActiveFile: () => makeFile(activePath) };
  app.metadataCache = {
    getFirstLinkpathDest: (link: string) =>
      [...tfiles.values()].find((f) => f.path === link || f.name === link || f.basename === link) ?? null,
    getFileCache: () => null,
    fileToLinktext: (file: TFile) => file.path,
  };
  app.fileManager = { getNewFileParent: () => ({ path: newFileFolder }) };
  return { app, contents, tfiles };
}
