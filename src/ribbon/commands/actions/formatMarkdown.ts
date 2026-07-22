export function stripHeadingTrailingHashes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^(#{1,6})(\s+)(.*)$/);
      if (!match) return line;
      const [, hashes, sp, rest] = match;
      const stripped = rest.replace(/\s+#+\s*$/, "");
      return `${hashes}${sp}${stripped}`;
    })
    .join("\n");
}

export function normalizeBulletMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^(\s*)[*+](\s+)/, "$1-$2"))
    .join("\n");
}

export function trimTrailingWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/[ \t]*$/);
      const trailing = match ? match[0] : "";
      if (trailing === "  ") return line;
      return line.slice(0, line.length - trailing.length);
    })
    .join("\n");
}
