export function buildTableText(columns: number, rows: number): string {
  const emptyRow = "|" + " |".repeat(columns);
  const separatorRow = "|" + " --- |".repeat(columns);
  const bodyRows = Array(rows - 1).fill(emptyRow);
  return [emptyRow, separatorRow, ...bodyRows].join("\n") + "\n";
}
