import { App, Modal, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { buildExternalLinkText } from "./externalLinkText";

class ExternalLinkFormModal extends Modal {
  private textInput!: HTMLInputElement;
  private urlInput!: HTMLInputElement;
  private hasInitialText: boolean;

  constructor(
    app: App,
    private editor: EditorLike
  ) {
    super(app);
    this.setTitle("Insert link");
    this.hasInitialText = editor.somethingSelected();
  }

  onOpen(): void {
    const { contentEl } = this;

    const initialText = this.hasInitialText ? this.editor.getSelection() : "";
    new Setting(contentEl).setName("Text").addText((text) => {
      this.textInput = text.inputEl;
      text.setValue(initialText);
      text.setPlaceholder("link text");
      text.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    new Setting(contentEl).setName("URL").addText((text) => {
      this.urlInput = text.inputEl;
      text.setPlaceholder("https://example.com");
      text.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Insert")
        .setCta()
        .onClick(() => this.submit())
    );

    (this.hasInitialText ? this.urlInput : this.textInput).focus();
  }

  private handleFieldKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  private submit(): void {
    const text = this.textInput.value.trim() || "link text";
    const url = this.urlInput.value.trim() || "url";
    this.editor.replaceSelection(buildExternalLinkText(text, url));
    this.close();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openExternalLinkModal(editor: EditorLike, app: App): void {
  new ExternalLinkFormModal(app, editor).open();
}
