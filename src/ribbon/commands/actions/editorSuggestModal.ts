import { App, SuggestModal } from "obsidian";
import type { EditorLike } from "./types";
import { returnFocusToEditor } from "./editorFocus";

/**
 * Base for the ribbon's "pick something to insert" dialogs. Any selected text
 * becomes the link alias, and the editor regains focus once a choice is made
 * or the dialog is dismissed.
 */
export abstract class EditorSuggestModal<T> extends SuggestModal<T> {
  protected readonly alias: string | null;

  constructor(
    app: App,
    protected editor: EditorLike,
    placeholder: string
  ) {
    super(app);
    this.alias = editor.somethingSelected() ? editor.getSelection() : null;
    this.setPlaceholder(placeholder);
  }

  protected insert(text: string): void {
    this.editor.replaceSelection(text);
    this.editor.focus();
  }

  onClose(): void {
    returnFocusToEditor(this.editor);
  }
}
