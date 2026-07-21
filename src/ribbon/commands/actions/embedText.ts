export function buildEmbedText(target: string, alias: string | null): string {
  return alias ? `![[${target}|${alias}]]` : `![[${target}]]`;
}
