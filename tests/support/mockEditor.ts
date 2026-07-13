import type { EditorLike, EditorPosition } from "../../src/ribbon/commands/actions/types";

export function createMockEditor(
  text: string,
  cursor: EditorPosition = { line: 0, ch: 0 }
): EditorLike & { getValue(): string } {
  let lines = text.split("\n");
  let selectionFrom: EditorPosition = cursor;
  let selectionTo: EditorPosition = cursor;

  function posToOffset(pos: EditorPosition): number {
    let offset = 0;
    for (let i = 0; i < pos.line; i++) offset += lines[i].length + 1;
    return offset + pos.ch;
  }

  function offsetToPos(offset: number): EditorPosition {
    let remaining = offset;
    for (let line = 0; line < lines.length; line++) {
      if (remaining <= lines[line].length) return { line, ch: remaining };
      remaining -= lines[line].length + 1;
    }
    return { line: lines.length - 1, ch: lines[lines.length - 1].length };
  }

  return {
    getSelection() {
      const full = lines.join("\n");
      return full.slice(posToOffset(selectionFrom), posToOffset(selectionTo));
    },
    replaceSelection(replacement: string) {
      const full = lines.join("\n");
      const from = posToOffset(selectionFrom);
      const to = posToOffset(selectionTo);
      const newText = full.slice(0, from) + replacement + full.slice(to);
      lines = newText.split("\n");
      const newPos = offsetToPos(from + replacement.length);
      selectionFrom = newPos;
      selectionTo = newPos;
    },
    getCursor(from: "from" | "to" | "head" | "anchor" = "head") {
      return from === "from" || from === "anchor" ? selectionFrom : selectionTo;
    },
    setCursor(pos: EditorPosition) {
      selectionFrom = pos;
      selectionTo = pos;
    },
    setSelection(anchor: EditorPosition, head: EditorPosition) {
      selectionFrom = anchor;
      selectionTo = head;
    },
    somethingSelected() {
      return posToOffset(selectionFrom) !== posToOffset(selectionTo);
    },
    getLine(line: number) {
      return lines[line] ?? "";
    },
    setLine(line: number, text: string) {
      lines[line] = text;
    },
    lastLine() {
      return lines.length - 1;
    },
    getValue() {
      return lines.join("\n");
    },
  };
}
