import { App, TFile } from "obsidian";
import type { EditorLike } from "./types";
import { buildLinkText } from "./linkText";
import { NoteTargetSuggestModal } from "./noteTargetSuggestModal";

class LinkSuggestModal extends NoteTargetSuggestModal {
  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Find or create a note, or type Note# for headings, Note#^ for blocks...", "Link to");
  }

  protected getCandidateFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  protected buildText(target: string, alias: string | null): string {
    return buildLinkText(target, alias);
  }
}

export function openLinkModal(editor: EditorLike, app: App): void {
  new LinkSuggestModal(app, editor).open();
}
