import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  buildHeadingLinkText,
  collectHeadings,
} from "../../../../src/ribbon/commands/actions/headingLinkText";

describe("collectHeadings", () => {
  it("collects every heading line with its level and text", () => {
    const editor = createMockEditor("# Title\n\nsome text\n\n## Section One\n\ntext\n\n### Sub Section");
    expect(collectHeadings(editor)).toEqual([
      { line: 0, level: 1, text: "Title" },
      { line: 4, level: 2, text: "Section One" },
      { line: 8, level: 3, text: "Sub Section" },
    ]);
  });

  it("returns an empty array when the document has no headings", () => {
    const editor = createMockEditor("just a paragraph\n\nanother one");
    expect(collectHeadings(editor)).toEqual([]);
  });

  it("trims trailing whitespace from the heading text", () => {
    const editor = createMockEditor("##   Section Two   ");
    expect(collectHeadings(editor)).toEqual([{ line: 0, level: 2, text: "Section Two" }]);
  });
});

describe("buildHeadingLinkText", () => {
  it("wraps the heading text in a same-note heading link with no alias", () => {
    expect(buildHeadingLinkText("Section One", null)).toBe("[[#Section One]]");
  });

  it("adds a pipe-separated alias when given one", () => {
    expect(buildHeadingLinkText("Section One", "see above")).toBe("[[#Section One|see above]]");
  });
});
