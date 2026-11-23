import { App, TFile } from "obsidian";
import type { CachedMetadata } from "obsidian";
import type { EditorLike } from "./types";
import { collectBlockCandidates } from "./embedBlocks";
import { EditorSuggestModal } from "./editorSuggestModal";
import { fuzzyFilter, RESULT_LIMIT, suggestNotes, type NoteSuggestion } from "./fuzzySuggest";

export type NoteTargetSuggestion =
  | NoteSuggestion
  | { type: "heading"; file: TFile; heading: string }
  | { type: "block"; file: TFile; blockId: string; preview: string }
  | { type: "raw"; target: string };

/**
 * Shared picker behind the Internal Link and Embed dialogs. Typing a name
 * suggests files; `Note#` suggests that note's headings and `Note#^` its
 * blocks (a bare `#` / `#^` targets the active note). Subclasses decide which
 * files are offered and how the chosen target is turned into text.
 */
export abstract class NoteTargetSuggestModal extends EditorSuggestModal<NoteTargetSuggestion> {
  private blockContentCache: { file: TFile; lines: string[] } | null = null;

  constructor(
    app: App,
    editor: EditorLike,
    placeholder: string,
    private readonly rawLabel: string
  ) {
    super(app, editor, placeholder);
    this.scope.register([], "Tab", (evt) => {
      this.selectActiveSuggestion(evt);
      return false;
    });
  }

  /** Files offered when the query names a file. */
  protected abstract getCandidateFiles(): TFile[];

  /** Builds the text to insert for a resolved link target. */
  protected abstract buildText(target: string, alias: string | null): string;

  async getSuggestions(query: string): Promise<NoteTargetSuggestion[]> {
    const hashIndex = query.indexOf("#");
    const results =
      hashIndex === -1
        ? this.getFileSuggestions(query)
        : await this.getFragmentSuggestions(query.slice(0, hashIndex).trim(), query.slice(hashIndex + 1));

    const trimmed = query.trim();
    const isBareFragmentDelimiter = trimmed.endsWith("#") || trimmed.endsWith("#^");
    if (results.length === 0 && trimmed && !isBareFragmentDelimiter) {
      return [{ type: "raw", target: trimmed }];
    }
    return results;
  }

  private getFileSuggestions(query: string): NoteTargetSuggestion[] {
    return suggestNotes(this.getCandidateFiles(), query);
  }

  private async getFragmentSuggestions(filePart: string, fragmentPart: string): Promise<NoteTargetSuggestion[]> {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const file = filePart
      ? this.app.metadataCache.getFirstLinkpathDest(filePart, sourcePath)
      : this.app.workspace.getActiveFile();

    if (!file || file.extension !== "md") {
      return [];
    }

    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) {
      return [];
    }

    if (fragmentPart.startsWith("^")) {
      return this.getBlockSuggestions(file, cache, fragmentPart.slice(1));
    }
    return this.getHeadingSuggestions(file, cache, fragmentPart);
  }

  private getHeadingSuggestions(file: TFile, cache: CachedMetadata, headingQuery: string): NoteTargetSuggestion[] {
    const matches = fuzzyFilter(
      (cache.headings ?? []).map((h) => h.heading),
      headingQuery,
      (heading) => heading
    );

    return matches.slice(0, RESULT_LIMIT).map((heading) => ({ type: "heading" as const, file, heading }));
  }

  private async getBlockSuggestions(
    file: TFile,
    cache: CachedMetadata,
    blockQuery: string
  ): Promise<NoteTargetSuggestion[]> {
    const entries = collectBlockCandidates(cache);
    if (entries.length === 0) {
      return [];
    }

    if (!this.blockContentCache || this.blockContentCache.file !== file) {
      const content = await this.app.vault.cachedRead(file);
      this.blockContentCache = { file, lines: content.split("\n") };
    }
    const lines = this.blockContentCache.lines;

    const candidates = entries.map((entry) => ({
      id: entry.id,
      preview: lines[entry.line]?.trim() ?? "",
    }));

    const matches = fuzzyFilter(candidates, blockQuery, (candidate) => candidate.id);

    return matches
      .slice(0, RESULT_LIMIT)
      .map((c) => ({ type: "block" as const, file, blockId: c.id, preview: c.preview }));
  }

  renderSuggestion(item: NoteTargetSuggestion, el: HTMLElement): void {
    if (item.type === "raw") {
      el.createEl("div", { text: `${this.rawLabel} "${item.target}"` });
      el.createEl("small", { text: "No match found — inserted as typed", cls: "ribbon-bar-link-modal-path" });
      return;
    }
    if (item.type === "create") {
      el.createEl("div", { text: `Create new note: "${item.name}"` });
      return;
    }
    if (item.type === "file") {
      const displayName = item.file.extension === "md" ? item.file.basename : item.file.name;
      el.createEl("div", { text: displayName });
      if (item.file.parent && !item.file.parent.isRoot()) {
        el.createEl("small", { text: item.file.parent.path, cls: "ribbon-bar-link-modal-path" });
      }
      return;
    }
    if (item.type === "heading") {
      el.createEl("div", { text: item.heading });
      el.createEl("small", { text: item.file.basename, cls: "ribbon-bar-link-modal-path" });
      return;
    }
    el.createEl("div", { text: `^${item.blockId}` });
    el.createEl("small", { text: item.preview, cls: "ribbon-bar-link-modal-path" });
  }

  /**
   * Tab completes the highlighted suggestion into the search box instead of
   * choosing it, so the search can continue from that anchor (a note becomes
   * `Note#` to search its headings, a heading or block fills in the full target).
   */
  selectSuggestion(item: NoteTargetSuggestion, evt: MouseEvent | KeyboardEvent): void {
    if (evt instanceof KeyboardEvent && evt.key === "Tab") {
      this.completeInput(item);
      return;
    }
    super.selectSuggestion(item, evt);
  }

  private completeInput(item: NoteTargetSuggestion): void {
    const completion = this.getCompletion(item, this.inputEl.value);
    if (completion === null) return;
    this.inputEl.value = completion;
    this.inputEl.setSelectionRange(completion.length, completion.length);
    this.inputEl.dispatchEvent(new Event("input"));
  }

  private getCompletion(item: NoteTargetSuggestion, query: string): string | null {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    // Headings and blocks keep the note part exactly as typed (empty means the active note).
    const filePart = query.slice(0, Math.max(query.indexOf("#"), 0));
    switch (item.type) {
      case "file": {
        const linktext = this.app.metadataCache.fileToLinktext(item.file, sourcePath);
        return item.file.extension === "md" ? `${linktext}#` : linktext;
      }
      case "heading":
        return `${filePart}#${item.heading}`;
      case "block":
        return `${filePart}#^${item.blockId}`;
      default:
        return null;
    }
  }

  onChooseSuggestion(item: NoteTargetSuggestion): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const linktext = (file: TFile) => this.app.metadataCache.fileToLinktext(file, sourcePath);
    let target: string;
    switch (item.type) {
      case "file":
        target = linktext(item.file);
        break;
      case "heading":
        target = `${linktext(item.file)}#${item.heading}`;
        break;
      case "block":
        target = `${linktext(item.file)}#^${item.blockId}`;
        break;
      case "create":
        target = item.name;
        break;
      case "raw":
        target = item.target;
        break;
    }
    this.insert(this.buildText(target, this.alias));
  }
}
