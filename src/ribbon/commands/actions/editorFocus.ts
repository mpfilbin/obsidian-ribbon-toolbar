import type { EditorLike } from "./types";

/**
 * Hands keyboard focus back to the editor after a dialog closes. Obsidian
 * restores focus to whatever had it before the dialog opened (here, a ribbon
 * button) after onClose has run, which would undo a plain focus() call made
 * there, so focus again once that has happened.
 */
export function returnFocusToEditor(editor: EditorLike): void {
  editor.focus();
  window.setTimeout(() => editor.focus(), 0);
}
