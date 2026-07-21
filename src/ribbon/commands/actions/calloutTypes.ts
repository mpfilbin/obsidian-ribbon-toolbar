export const CALLOUT_TYPES: readonly string[] = [
  "note",
  "abstract",
  "summary",
  "tldr",
  "info",
  "todo",
  "tip",
  "hint",
  "important",
  "success",
  "check",
  "done",
  "question",
  "help",
  "faq",
  "warning",
  "caution",
  "attention",
  "failure",
  "fail",
  "missing",
  "danger",
  "error",
  "bug",
  "example",
  "quote",
  "cite",
];

export function calloutInsertText(type: string, title = "", content = ""): string {
  const resolvedType = type.trim() || "note";
  const trimmedTitle = title.trim();
  const header = trimmedTitle ? `> [!${resolvedType}] ${trimmedTitle}` : `> [!${resolvedType}]`;
  const lines = content.length > 0 ? content.split("\n") : [""];
  const body = lines.map((line) => `> ${line}`).join("\n");
  return `${header}\n${body}`;
}
