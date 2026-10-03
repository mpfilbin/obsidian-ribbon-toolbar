import { App, Notice, SuggestModal, TFile } from "obsidian";
import type { EditorLike } from "../commands/actions/types";
import { baseAtCursor, describeRef, findFenceEnd, isBaseFence, locateBases, type BaseRef } from "./locate";

/** A base that can be read and written back, wherever it is stored. */
export interface BaseTarget {
  /** Short description for titles and messages. */
  label: string;
  /** For an embed pinned to a view (![[x.base#View]]), that view's name. */
  viewName?: string;
  load(): Promise<string>;
  save(yaml: string): Promise<void>;
}

export function readLines(editor: EditorLike): string[] {
  const lines: string[] = [];
  for (let i = 0; i <= editor.lastLine(); i++) lines.push(editor.getLine(i));
  return lines;
}

/** A ```base block in the note: its YAML lives between the fences. */
export function inlineTarget(editor: EditorLike, startLine: number): BaseTarget {
  return {
    label: "inline base",
    async load() {
      const lines = readLines(editor);
      const end = isBaseFence(lines[startLine] ?? "") ? findFenceEnd(lines, startLine) : -1;
      if (end === -1) throw new Error("The base code block has moved or been removed.");
      return lines.slice(startLine + 1, end).join("\n");
    },
    async save(yaml: string) {
      const lines = readLines(editor);
      const end = isBaseFence(lines[startLine] ?? "") ? findFenceEnd(lines, startLine) : -1;
      if (end === -1) throw new Error("The base code block has moved or been removed.");
      const body = yaml.trimEnd();
      editor.replaceRange(body ? `${body}\n` : "", { line: startLine + 1, ch: 0 }, { line: end, ch: 0 });
    },
  };
}

/** A standalone .base file. */
export function fileTarget(app: App, file: TFile, viewName?: string): BaseTarget {
  return {
    label: file.name,
    viewName,
    load: () => app.vault.read(file),
    save: async (yaml: string) => {
      await app.vault.process(file, () => `${yaml.trimEnd()}\n`);
    },
  };
}

class BasePickerModal extends SuggestModal<BaseRef> {
  private settled = false;

  constructor(
    app: App,
    private refs: BaseRef[],
    private settle: (ref: BaseRef | null) => void
  ) {
    super(app);
    this.setPlaceholder("Which base do you want to edit?");
  }

  getSuggestions(query: string): BaseRef[] {
    const needle = query.trim().toLowerCase();
    return this.refs.filter((ref) => describeRef(ref).toLowerCase().includes(needle));
  }

  renderSuggestion(ref: BaseRef, el: HTMLElement): void {
    el.createEl("div", { text: describeRef(ref) });
  }

  onChooseSuggestion(ref: BaseRef): void {
    this.settled = true;
    this.settle(ref);
  }

  onClose(): void {
    // Obsidian closes the modal before reporting the choice, so give a choice
    // the chance to arrive before treating the close as a cancel.
    setTimeout(() => {
      if (!this.settled) this.settle(null);
    }, 0);
  }
}

function pickBase(app: App, refs: BaseRef[]): Promise<BaseRef | null> {
  return new Promise((resolve) => new BasePickerModal(app, refs, resolve).open());
}

function targetFor(editor: EditorLike, app: App, ref: BaseRef): BaseTarget | null {
  if (ref.type === "block") return inlineTarget(editor, ref.startLine);

  const sourcePath = app.workspace.getActiveFile()?.path ?? "";
  const file = app.metadataCache.getFirstLinkpathDest(ref.linkpath, sourcePath);
  if (!file) {
    new Notice(`Can't find the base file "${ref.linkpath}".`);
    return null;
  }
  return fileTarget(app, file, ref.viewName);
}

/**
 * Decides which base a command should act on: the one the cursor is in or on,
 * else the note's only base, else one the user picks. Tells the user when there
 * is nothing to act on.
 */
export async function resolveBaseTarget(editor: EditorLike, app: App): Promise<BaseTarget | null> {
  const refs = locateBases(readLines(editor));
  if (refs.length === 0) {
    new Notice("No base in this note yet. Use New Base or Embed Base first.");
    return null;
  }

  let ref = baseAtCursor(refs, editor.getCursor());
  if (!ref) ref = refs.length === 1 ? refs[0] : await pickBase(app, refs);
  return ref ? targetFor(editor, app, ref) : null;
}
