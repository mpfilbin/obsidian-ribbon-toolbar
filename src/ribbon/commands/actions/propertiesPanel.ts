import { App, MarkdownView, TFile } from "obsidian";
import type { EditorLike } from "./types";

// How long to wait for Obsidian to finish re-reading the note before refreshing anyway.
const CACHE_WAIT_MS = 1500;

/**
 * Resolves when Obsidian's metadata cache next reports that `file` changed (it
 * learns of an edit only after the note is saved), or after CACHE_WAIT_MS.
 */
function cacheUpdated(app: App, file: TFile | null): Promise<void> {
  return new Promise((resolve) => {
    if (!file) return resolve();
    let timer = 0;
    const ref = app.metadataCache.on("changed", (changed) => {
      if (changed.path === file.path) done();
    });
    function done(): void {
      window.clearTimeout(timer);
      app.metadataCache.offref(ref);
      resolve();
    }
    timer = window.setTimeout(done, CACHE_WAIT_MS);
  });
}

/**
 * Makes an edit that changes nothing: replaces the last character of the last
 * non-empty line with itself, then puts the selection back where it was.
 */
function nudgeEditor(editor: EditorLike): void {
  let line = editor.lastLine();
  while (line > 0 && editor.getLine(line).length === 0) line--;
  const text = editor.getLine(line);
  if (text.length === 0) return;

  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  editor.replaceRange(text[text.length - 1], { line, ch: text.length - 1 }, { line, ch: text.length });
  editor.setSelection(from, to);
}

/**
 * Saves the note and makes the Properties panel at its top show the property that
 * was just added. In Live Preview that panel only redraws on an edit made after
 * Obsidian has re-read the note (typing a character in the note brought the new
 * property up), but we edit before it has, so it shows the old properties. Once
 * the metadata cache has caught up, make a do-nothing edit to prompt the redraw.
 */
export async function saveAndRefreshPropertiesPanel(app: App, editor: EditorLike): Promise<void> {
  try {
    const file = app.workspace.getActiveFile?.() ?? null;
    const updated = cacheUpdated(app, file);
    await app.workspace.getActiveViewOfType?.(MarkdownView)?.save();
    await updated;
    nudgeEditor(editor);
  } catch (error) {
    console.warn("Ribbon Bar: couldn't refresh the Properties panel after adding a property", error);
  }
}
