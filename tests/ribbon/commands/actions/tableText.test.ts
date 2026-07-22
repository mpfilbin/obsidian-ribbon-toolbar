import { describe, expect, it } from "vitest";
import { buildTableText } from "../../../../src/ribbon/commands/actions/tableText";

describe("tableText", () => {
  it("buildTableText builds a 2-column, 2-row table (1 header row + 1 body row)", () => {
    expect(buildTableText(2, 2)).toBe("| | |\n| --- | --- |\n| | |\n");
  });

  it("buildTableText builds a 3-column, 4-row table (1 header row + 3 body rows)", () => {
    expect(buildTableText(3, 4)).toBe("| | | |\n| --- | --- | --- |\n| | | |\n| | | |\n| | | |\n");
  });

  it("buildTableText builds a header-only table when rows is 1", () => {
    expect(buildTableText(2, 1)).toBe("| | |\n| --- | --- |\n");
  });

  it("buildTableText builds a single-column table", () => {
    expect(buildTableText(1, 3)).toBe("| |\n| --- |\n| |\n| |\n");
  });
});
