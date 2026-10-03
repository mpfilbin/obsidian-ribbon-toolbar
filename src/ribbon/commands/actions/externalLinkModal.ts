import { App, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { buildExternalLinkText } from "./externalLinkText";
import { FormModal } from "./formModal";

class ExternalLinkFormModal extends FormModal {
  private textInput!: HTMLInputElement;
  private urlInput!: HTMLInputElement;
  private hasInitialText: boolean;

  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Insert link");
    this.hasInitialText = editor.somethingSelected();
  }

  onOpen(): void {
    const { contentEl } = this;

    const initialText = this.hasInitialText ? this.editor.getSelection() : "";
    new Setting(contentEl).setName("Text").addText((text) => {
      this.textInput = text.inputEl;
      text.setValue(initialText);
      text.setPlaceholder("link text");
      this.submitOnEnter(text.inputEl);
    });

    new Setting(contentEl).setName("URL").addText((text) => {
      this.urlInput = text.inputEl;
      text.setPlaceholder("https://example.com");
      this.submitOnEnter(text.inputEl);
    });

    this.addInsertButton();

    (this.hasInitialText ? this.urlInput : this.textInput).focus();
  }

  protected submit(): void {
    const text = this.textInput.value.trim() || "link text";
    const url = this.urlInput.value.trim() || "url";
    this.editor.replaceSelection(buildExternalLinkText(text, url));
    this.close();
  }
}

export function openExternalLinkModal(editor: EditorLike, app: App): void {
  new ExternalLinkFormModal(app, editor).open();
}
