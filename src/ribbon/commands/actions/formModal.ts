import { App, Modal, Setting } from "obsidian";
import type { EditorLike } from "./types";

/**
 * Base for the ribbon's "fill in a form, then Insert" dialogs. It owns the
 * parts every form shares: the title, the Insert button, submitting with the
 * keyboard, and handing focus back to the editor on close.
 */
export abstract class FormModal extends Modal {
  constructor(
    app: App,
    protected editor: EditorLike,
    title: string
  ) {
    super(app);
    this.setTitle(title);
  }

  /** Called when the user submits; implementations insert text and close(). */
  protected abstract submit(): void;

  /**
   * Makes Enter submit the form. In a textarea Enter must stay a newline, so
   * submitting needs Ctrl/Cmd+Enter there.
   */
  protected submitOnEnter(field: HTMLInputElement | HTMLTextAreaElement): void {
    const isTextarea = field instanceof HTMLTextAreaElement;
    (field as HTMLElement).addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || (isTextarea && !(event.ctrlKey || event.metaKey))) {
        return;
      }
      event.preventDefault();
      this.submit();
    });
  }

  protected addInsertButton(label = "Insert"): void {
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText(label)
        .setCta()
        .onClick(() => this.submit())
    );
  }

  onClose(): void {
    this.editor.focus();
  }
}
