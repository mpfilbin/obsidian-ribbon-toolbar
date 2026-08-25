import { App, SuggestModal, prepareFuzzySearch } from "obsidian";
import type { EditorLike } from "./types";
import { buildHeadingLinkText, collectHeadings, type HeadingEntry } from "./headingLinkText";

class HeadingLinkSuggestModal extends SuggestModal<HeadingEntry> {
  constructor(
    app: App,
    private editor: EditorLike,
    private alias: string | null
  ) {
    super(app);
    this.setPlaceholder("Find a heading in this note...");
  }

  getSuggestions(query: string): HeadingEntry[] {
    const headings = collectHeadings(this.editor);
    const trimmed = query.trim();
    if (!trimmed) return headings;

    const search = prepareFuzzySearch(trimmed);
    return headings
      .map((heading) => ({ heading, result: search(heading.text) }))
      .filter(
        (entry): entry is { heading: HeadingEntry; result: NonNullable<typeof entry.result> } =>
          entry.result !== null
      )
      .sort((a, b) => b.result.score - a.result.score)
      .map((entry) => entry.heading);
  }

  renderSuggestion(item: HeadingEntry, el: HTMLElement): void {
    const row = el.createEl("div", { text: item.text });
    row.style.paddingLeft = `${(item.level - 1) * 16}px`;
  }

  onChooseSuggestion(item: HeadingEntry): void {
    this.editor.replaceSelection(buildHeadingLinkText(item.text, this.alias));
    this.editor.focus();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openHeadingLinkModal(editor: EditorLike, app: App): void {
  const alias = editor.somethingSelected() ? editor.getSelection() : null;
  new HeadingLinkSuggestModal(app, editor, alias).open();
}
