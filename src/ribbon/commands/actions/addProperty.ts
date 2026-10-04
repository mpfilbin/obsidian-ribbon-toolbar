import { App, MarkdownView } from "obsidian";
import type { EditorLike } from "./types";
import { insertPropertyLines } from "./frontmatter";
import type { PropertyValue } from "./propertyEntry";

/**
 * Adds a typed-in property to the active note. Obsidian's own frontmatter API is
 * used (what its Properties panel uses to write), so the panel at the top of the
 * note redraws with the new property; writing the text into the editor left that
 * panel showing the old properties until the next keystroke. The note is saved
 * first so the API sees what is in the editor. Without an active file, or if the
 * API fails, the property is written into the editor as text instead.
 */
export async function addPropertyToNote(
  app: App,
  editor: EditorLike,
  name: string,
  value: PropertyValue,
  lines: string[],
): Promise<void> {
  const file = app.workspace.getActiveFile?.() ?? null;
  if (file && app.fileManager?.processFrontMatter) {
    try {
      await app.workspace.getActiveViewOfType?.(MarkdownView)?.save();
      await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        frontmatter[name] = value;
      });
      editor.focus();
      return;
    } catch (error) {
      console.warn("Ribbon Bar: couldn't add the property through Obsidian, writing it into the note instead", error);
    }
  }
  insertPropertyLines(editor, name, lines);
  editor.focus();
}
