import type { CommandEntry } from "../types";
import { exportHtmlNote, exportPdfNote, moveNoteFile, newNoteFile, openNoteFile, openFileFromDiskDialog, openSaveAs } from "../modalLoaders";

export const FILE_COMMANDS: CommandEntry[] = [
  { id: "file-new", tab: "file", group: "Note", icon: "file-plus", label: "New", modal: newNoteFile },
  { id: "file-open", tab: "file", group: "Note", icon: "folder-open", label: "Open", modal: openNoteFile },
  { id: "file-open-file", tab: "file", group: "Note", icon: "file-up", label: "Open File", modal: openFileFromDiskDialog },
  { id: "file-save-as", tab: "file", group: "Note", icon: "save", label: "Save As", modal: openSaveAs },
  { id: "file-move", tab: "file", group: "Note", icon: "folder-input", label: "Move", modal: moveNoteFile },
  { id: "file-export-pdf", tab: "file", group: "Export", icon: "file-text", label: "Export PDF", modal: exportPdfNote },
  { id: "file-export-html", tab: "file", group: "Export", icon: "file-code", label: "Export HTML", modal: exportHtmlNote },
];
