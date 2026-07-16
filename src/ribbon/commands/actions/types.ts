export interface EditorPosition {
  line: number;
  ch: number;
}

export interface EditorLike {
  getSelection(): string;
  replaceSelection(text: string): void;
  replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition): void;
  getCursor(from?: "from" | "to" | "head" | "anchor"): EditorPosition;
  setCursor(pos: EditorPosition): void;
  setSelection(anchor: EditorPosition, head: EditorPosition): void;
  somethingSelected(): boolean;
  getLine(line: number): string;
  setLine(line: number, text: string): void;
  lastLine(): number;
  focus(): void;
}
