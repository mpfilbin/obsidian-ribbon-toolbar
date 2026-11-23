import { App, TFile } from "obsidian";
import type { EditorLike } from "./types";
import { buildEmbedText } from "./embedText";
import { NoteTargetSuggestModal } from "./noteTargetSuggestModal";

class EmbedSuggestModal extends NoteTargetSuggestModal {
  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Find a file, or type Note# for headings, Note#^ for blocks...", "Embed");
  }

  protected getCandidateFiles(): TFile[] {
    return this.app.vault.getFiles();
  }

  protected buildText(target: string, alias: string | null): string {
    return buildEmbedText(target, alias);
  }
}

export function openEmbedModal(editor: EditorLike, app: App): void {
  new EmbedSuggestModal(app, editor).open();
}
