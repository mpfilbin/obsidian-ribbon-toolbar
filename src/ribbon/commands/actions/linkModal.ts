import { App, SuggestModal, TFile, prepareFuzzySearch } from "obsidian";
import type { EditorLike } from "./types";
import { buildLinkText } from "./linkText";

type LinkSuggestion = { type: "file"; file: TFile } | { type: "create"; name: string };

const RESULT_LIMIT = 20;

class LinkSuggestModal extends SuggestModal<LinkSuggestion> {
  constructor(
    app: App,
    private editor: EditorLike,
    private alias: string | null
  ) {
    super(app);
    this.setPlaceholder("Find or create a note...");
  }

  getSuggestions(query: string): LinkSuggestion[] {
    const files = this.app.vault.getMarkdownFiles();
    const trimmed = query.trim();

    let fileSuggestions: LinkSuggestion[];
    if (trimmed) {
      const search = prepareFuzzySearch(trimmed);
      fileSuggestions = files
        .map((file) => ({ file, result: search(file.basename) }))
        .filter(
          (entry): entry is { file: TFile; result: NonNullable<typeof entry.result> } => entry.result !== null
        )
        .sort((a, b) => b.result.score - a.result.score)
        .map((entry) => ({ type: "file" as const, file: entry.file }));
    } else {
      fileSuggestions = files.map((file) => ({ type: "file" as const, file }));
    }

    const results = fileSuggestions.slice(0, RESULT_LIMIT);

    const exactMatch = files.some((file) => file.basename.toLowerCase() === trimmed.toLowerCase());
    if (trimmed && !exactMatch) {
      results.push({ type: "create", name: trimmed });
    }

    return results;
  }

  renderSuggestion(item: LinkSuggestion, el: HTMLElement): void {
    if (item.type === "create") {
      el.createEl("div", { text: `Create new note: "${item.name}"` });
      return;
    }
    el.createEl("div", { text: item.file.basename });
    if (item.file.parent && !item.file.parent.isRoot()) {
      el.createEl("small", { text: item.file.parent.path, cls: "ribbon-bar-link-modal-path" });
    }
  }

  onChooseSuggestion(item: LinkSuggestion): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const target =
      item.type === "file" ? this.app.metadataCache.fileToLinktext(item.file, sourcePath) : item.name;
    this.editor.replaceSelection(buildLinkText(target, this.alias));
    this.editor.focus();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openLinkModal(editor: EditorLike, app: App): void {
  const alias = editor.somethingSelected() ? editor.getSelection() : null;
  new LinkSuggestModal(app, editor, alias).open();
}
