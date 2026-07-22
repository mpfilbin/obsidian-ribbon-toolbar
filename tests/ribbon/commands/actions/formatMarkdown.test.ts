import { describe, expect, it } from "vitest";
import {
  stripHeadingTrailingHashes,
  normalizeBulletMarkers,
  trimTrailingWhitespace,
  alignTables,
  normalizeBlankLines,
} from "../../../../src/ribbon/commands/actions/formatMarkdown";

describe("stripHeadingTrailingHashes", () => {
  it("strips a trailing run of # characters from an ATX heading", () => {
    expect(stripHeadingTrailingHashes("## Title ##")).toBe("## Title");
  });

  it("leaves a heading with no trailing # untouched", () => {
    expect(stripHeadingTrailingHashes("# Just a heading")).toBe("# Just a heading");
  });

  it("leaves a non-heading line untouched, even if it ends in #", () => {
    expect(stripHeadingTrailingHashes("Not a heading #")).toBe("Not a heading #");
  });
});

describe("normalizeBulletMarkers", () => {
  it("normalizes *, +, and - markers to - consistently", () => {
    expect(normalizeBulletMarkers("* Item one\n+ Item two\n- Item three")).toBe(
      "- Item one\n- Item two\n- Item three"
    );
  });

  it("preserves indentation on nested list items", () => {
    expect(normalizeBulletMarkers("  * nested")).toBe("  - nested");
  });

  it("does not touch a line that merely starts with * but isn't a list item", () => {
    expect(normalizeBulletMarkers("*emphasis* text")).toBe("*emphasis* text");
  });

  it("does not touch ordered list markers", () => {
    expect(normalizeBulletMarkers("1. First\n2. Second")).toBe("1. First\n2. Second");
  });
});

describe("trimTrailingWhitespace", () => {
  it("preserves exactly two trailing spaces (a hard line break) but trims other trailing whitespace", () => {
    expect(trimTrailingWhitespace("Line one  \nLine two   \nLine three ")).toBe(
      "Line one  \nLine two\nLine three"
    );
  });

  it("trims a trailing tab", () => {
    expect(trimTrailingWhitespace("Line\t")).toBe("Line");
  });
});

describe("alignTables", () => {
  it("pads cells and rebuilds the separator row with alignment markers", () => {
    expect(alignTables("| Name | Age |\n|:-|--:|\n| Bob | 30 |")).toBe(
      "| Name | Age |\n| :--- | --: |\n| Bob  |  30 |"
    );
  });

  it("pads cells with a plain separator row (no alignment colons)", () => {
    expect(alignTables("| Name | Age |\n| --- | --- |\n| Bob | 30 |")).toBe(
      "| Name | Age |\n| ---- | --- |\n| Bob  | 30  |"
    );
  });

  it("handles multiple independent tables in one document", () => {
    expect(
      alignTables("| A | B |\n| - | - |\n| 1 | 22 |\nSome text.\n| X | Y |\n| - | - |\n| longvalue | z |")
    ).toBe(
      "| A | B  |\n| - | -- |\n| 1 | 22 |\nSome text.\n| X         | Y |\n| --------- | - |\n| longvalue | z |"
    );
  });

  it("leaves non-table text untouched", () => {
    expect(alignTables("Just a paragraph.\nAnother line.")).toBe("Just a paragraph.\nAnother line.");
  });
});

describe("normalizeBlankLines", () => {
  it("forces a blank line before and after a heading", () => {
    expect(normalizeBlankLines("Text right after heading\n## Heading\nMore text")).toBe(
      "Text right after heading\n\n## Heading\n\nMore text"
    );
  });

  it("collapses a run of blank lines down to exactly one", () => {
    expect(normalizeBlankLines("Para one.\n\n\n\nPara two.")).toBe("Para one.\n\nPara two.");
  });

  it("removes leading and trailing blank lines", () => {
    expect(normalizeBlankLines("\n\nHello\n\n")).toBe("Hello");
  });

  it("leaves consecutive list items touching with no forced blank line", () => {
    expect(normalizeBlankLines("- Item one\n- Item two")).toBe("- Item one\n- Item two");
  });

  it("forces a blank line before and after a fenced code block", () => {
    expect(normalizeBlankLines("Text\n```\ncode line\n```\nMore text")).toBe(
      "Text\n\n```\ncode line\n```\n\nMore text"
    );
  });

  it("preserves a single blank line that already separates two paragraphs", () => {
    expect(normalizeBlankLines("Para A.\n\nPara B.")).toBe("Para A.\n\nPara B.");
  });

  it("forces a blank line around a table block", () => {
    expect(normalizeBlankLines("Text\n| A | B |\n| - | - |\n| 1 | 2 |\nMore")).toBe(
      "Text\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nMore"
    );
  });
});
