import { describe, expect, it } from "vitest";
import { buildMatrixText } from "../../../../src/ribbon/commands/actions/latexText";

describe("latexText", () => {
  it("buildMatrixText builds a 2x2 matrix", () => {
    expect(buildMatrixText(2, 2)).toBe("\\begin{pmatrix}\n  0 & 0 \\\\\n  0 & 0\n\\end{pmatrix}");
  });

  it("buildMatrixText builds a single row with no row separator", () => {
    expect(buildMatrixText(3, 1)).toBe("\\begin{pmatrix}\n  0 & 0 & 0\n\\end{pmatrix}");
  });

  it("buildMatrixText builds a single column with row separators between each row", () => {
    expect(buildMatrixText(1, 3)).toBe("\\begin{pmatrix}\n  0 \\\\\n  0 \\\\\n  0\n\\end{pmatrix}");
  });
});
