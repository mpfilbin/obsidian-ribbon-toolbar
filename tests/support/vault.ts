import { TFile } from "obsidian";

/** A TFile fixture; `path` like "folder/Note.md" derives name/basename/extension/parent. */
export function makeFile(path: string): TFile {
  const file = new TFile();
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  file.path = path;
  file.name = name;
  file.extension = dot === -1 ? "" : name.slice(dot + 1);
  file.basename = dot === -1 ? name : name.slice(0, dot);
  file.parent = {
    path: slash === -1 ? "/" : path.slice(0, slash),
    isRoot: () => slash === -1,
  };
  return file;
}
