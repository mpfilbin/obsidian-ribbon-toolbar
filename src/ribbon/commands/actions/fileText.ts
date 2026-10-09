/** Splits "folder/name.ext" into its parts; the folder is "" for the vault root. */
export function splitPath(path: string): { folder: string; basename: string; extension: string } {
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { folder, basename: name, extension: "" };
  return { folder, basename: name.slice(0, dot), extension: name.slice(dot + 1) };
}

export function joinPath(folder: string, name: string): string {
  const clean = folder.replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/${name}` : name;
}

/**
 * A path in `folder` that `exists` does not report as taken: "Name.md", then
 * "Name 1.md", "Name 2.md", ...
 */
export function uniquePath(folder: string, basename: string, extension: string, exists: (path: string) => boolean): string {
  const suffix = extension ? `.${extension}` : "";
  let path = joinPath(folder, `${basename}${suffix}`);
  for (let n = 1; exists(path); n++) {
    path = joinPath(folder, `${basename} ${n}${suffix}`);
  }
  return path;
}

/** The suggested Save As target: the note's own folder and name plus " copy". */
export function defaultSaveAsPath(sourcePath: string): string {
  const { folder, basename, extension } = splitPath(sourcePath);
  return joinPath(folder, `${basename} copy.${extension || "md"}`);
}

/** Trims what the user typed and gives it a Markdown extension when it has none. */
export function normalizeSaveAsPath(input: string): string {
  const path = input.trim().replace(/^\/+/, "");
  if (!path || path.endsWith("/")) return "";
  return splitPath(path).extension ? path : `${path}.md`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const HTML_STYLE = `body{max-width:48rem;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.6;color:#222}
pre,code{font-family:ui-monospace,monospace;background:#f4f4f4}pre{padding:.75rem;overflow:auto}code{padding:.1rem .3rem}
blockquote{margin-left:0;padding-left:1rem;border-left:3px solid #ccc;color:#555}
table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.3rem .6rem}img{max-width:100%}`;

/** Wraps rendered note HTML in a standalone page. */
export function buildHtmlDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${HTML_STYLE}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
