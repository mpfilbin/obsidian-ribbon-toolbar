export function buildMatrixText(columns: number, rows: number): string {
  const row = Array(columns).fill("0").join(" & ");
  const body = Array(rows).fill(row).join(" \\\\\n  ");
  return `\\begin{pmatrix}\n  ${body}\n\\end{pmatrix}`;
}
