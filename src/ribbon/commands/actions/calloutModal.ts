import { FuzzySuggestModal } from "obsidian";
import type { App } from "obsidian";
import type { EditorLike } from "./types";
import { insertAtCursor } from "./helpers";
import { CALLOUT_TYPES, calloutInsertText } from "./calloutTypes";

class CalloutSuggestModal extends FuzzySuggestModal<string> {
  constructor(
    app: App,
    private editor: EditorLike
  ) {
    super(app);
    this.setPlaceholder("Choose a callout type");
  }

  getItems(): string[] {
    return [...CALLOUT_TYPES];
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    insertAtCursor(this.editor, calloutInsertText(item));
    this.editor.focus();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openCalloutModal(editor: EditorLike, app: App): void {
  new CalloutSuggestModal(app, editor).open();
}
