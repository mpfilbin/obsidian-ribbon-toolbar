import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  insertAlign,
  insertCases,
  insertFraction,
  insertIntegral,
  insertLatexSymbol,
  insertLimit,
  insertMatrixGrid,
  insertSquareRoot,
  insertSummation,
  toggleBlockMath,
  toggleInlineMath,
  toggleLatexSubscript,
  toggleLatexSuperscript,
} from "../../../../src/ribbon/commands/actions/latex";

describe("LaTeX tab actions", () => {
  it("toggleInlineMath wraps the selection in single dollar signs", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleInlineMath(editor);
    expect(editor.getValue()).toBe("$hi$");
  });

  it("toggleInlineMath inserts a placeholder and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    toggleInlineMath(editor);
    expect(editor.getValue()).toBe("$x$");
    expect(editor.getSelection()).toBe("x");
  });

  it("toggleBlockMath wraps the selection on its own lines between double dollar signs", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleBlockMath(editor);
    expect(editor.getValue()).toBe("$$\nhi\n$$");
  });

  it("toggleBlockMath inserts a placeholder block and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    toggleBlockMath(editor);
    expect(editor.getValue()).toBe("$$\nx\n$$");
    expect(editor.getSelection()).toBe("x");
  });

  it("toggleLatexSuperscript wraps the selection in ^{}", () => {
    const editor = createMockEditor("2");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });
    toggleLatexSuperscript(editor);
    expect(editor.getValue()).toBe("^{2}");
  });

  it("toggleLatexSubscript wraps the selection in _{}", () => {
    const editor = createMockEditor("i");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });
    toggleLatexSubscript(editor);
    expect(editor.getValue()).toBe("_{i}");
  });

  it("insertSquareRoot wraps the selection in \\sqrt{}", () => {
    const editor = createMockEditor("2");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });
    insertSquareRoot(editor);
    expect(editor.getValue()).toBe("\\sqrt{2}");
  });

  it("insertFraction wraps the selection as the numerator and positions the cursor in the empty denominator", () => {
    const editor = createMockEditor("ab");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    insertFraction(editor);
    expect(editor.getValue()).toBe("\\frac{ab}{}");
    expect(editor.getCursor().ch).toBe(10);
  });

  it("insertFraction inserts an empty template and positions the cursor in the numerator when nothing is selected", () => {
    const editor = createMockEditor("");
    insertFraction(editor);
    expect(editor.getValue()).toBe("\\frac{}{}");
    expect(editor.getCursor().ch).toBe(6);
  });

  it("insertSummation inserts a summation template at the cursor", () => {
    const editor = createMockEditor("");
    insertSummation(editor);
    expect(editor.getValue()).toBe("\\sum_{i=1}^{n} ");
  });

  it("insertIntegral inserts an integral template at the cursor", () => {
    const editor = createMockEditor("");
    insertIntegral(editor);
    expect(editor.getValue()).toBe("\\int_{a}^{b} ");
  });

  it("insertLimit inserts a limit template at the cursor", () => {
    const editor = createMockEditor("");
    insertLimit(editor);
    expect(editor.getValue()).toBe("\\lim_{x \\to 0} ");
  });

  it("insertCases inserts a cases environment and selects the first placeholder", () => {
    const editor = createMockEditor("");
    insertCases(editor);
    expect(editor.getValue()).toBe(
      "\\begin{cases}\n  a & \\text{if } x > 0 \\\\\n  b & \\text{otherwise}\n\\end{cases}"
    );
    expect(editor.getSelection()).toBe("a");
  });

  it("insertAlign inserts an align environment and selects the first placeholder", () => {
    const editor = createMockEditor("");
    insertAlign(editor);
    expect(editor.getValue()).toBe("\\begin{align}\n  x &= y \\\\\n  z &= w\n\\end{align}");
    expect(editor.getSelection()).toBe("x");
  });

  it("insertMatrixGrid inserts a matrix of the given shape at the cursor", () => {
    const editor = createMockEditor("");
    insertMatrixGrid(editor, 2, 2);
    expect(editor.getValue()).toBe("\\begin{pmatrix}\n  0 & 0 \\\\\n  0 & 0\n\\end{pmatrix}");
  });

  it("insertMatrixGrid selects the first placeholder cell", () => {
    const editor = createMockEditor("");
    insertMatrixGrid(editor, 2, 2);
    expect(editor.getSelection()).toBe("0");
  });

  it("insertLatexSymbol returns an action that inserts the command with a trailing space", () => {
    const editor = createMockEditor("");
    insertLatexSymbol("\\alpha")(editor);
    expect(editor.getValue()).toBe("\\alpha ");
  });
});
