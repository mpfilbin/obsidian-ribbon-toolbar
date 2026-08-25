import { describe, expect, it } from "vitest";
import {
  countHighlights,
  migrateHighlightsInText,
} from "../../../../src/ribbon/commands/actions/highlightMigration";

describe("countHighlights", () => {
  it("counts ==...== spans outside fenced code blocks", () => {
    const text = "==one== and ==two==\ntext";
    expect(countHighlights(text)).toBe(2);
  });

  it("does not count '=='-looking text inside a fenced code block", () => {
    const text = "==real==\n\n```\n==not a highlight==\n```\n\n==also real==";
    expect(countHighlights(text)).toBe(2);
  });

  it("returns 0 for text with no highlights", () => {
    expect(countHighlights("just a paragraph")).toBe(0);
  });

  it("does not count a setext heading underline of 4 equals signs as a highlight", () => {
    expect(countHighlights("====")).toBe(0);
  });

  it("does not count a setext heading underline of 5 equals signs as a highlight", () => {
    expect(countHighlights("=====")).toBe(0);
  });

  it("does not count a real setext H1 heading as a highlight", () => {
    expect(countHighlights("Title\n====")).toBe(0);
  });

  it("does not count '==' comparison operators in plain prose as a highlight", () => {
    expect(countHighlights("assert a == b and c == d")).toBe(0);
  });

  it("does not count '==' inside inline code spans as a highlight", () => {
    expect(countHighlights("`x == y` plus `p == q`")).toBe(0);
  });
});

describe("migrateHighlightsInText", () => {
  it("rewrites ==...== spans to <mark> tags with the given color", () => {
    const text = "see ==this== and ==that==";
    expect(migrateHighlightsInText(text, "#ffd700")).toBe(
      'see <mark style="background-color: #ffd700;">this</mark> and <mark style="background-color: #ffd700;">that</mark>'
    );
  });

  it("leaves fenced code block content untouched", () => {
    const text = "==real==\n\n```\n==not a highlight==\n```\n\n==also real==";
    expect(migrateHighlightsInText(text, "#ffd700")).toBe(
      '<mark style="background-color: #ffd700;">real</mark>\n\n```\n==not a highlight==\n```\n\n<mark style="background-color: #ffd700;">also real</mark>'
    );
  });

  it("returns the text unchanged when there are no highlights", () => {
    expect(migrateHighlightsInText("just a paragraph", "#ffd700")).toBe("just a paragraph");
  });

  it("leaves a setext heading underline of 4 equals signs unchanged", () => {
    expect(migrateHighlightsInText("====", "#ffd700")).toBe("====");
  });

  it("leaves a setext heading underline of 5 equals signs unchanged", () => {
    expect(migrateHighlightsInText("=====", "#ffd700")).toBe("=====");
  });

  it("leaves a real setext H1 heading unchanged", () => {
    expect(migrateHighlightsInText("Title\n====", "#ffd700")).toBe("Title\n====");
  });

  it("still migrates a normal highlight (regression check)", () => {
    expect(migrateHighlightsInText("==hi==", "#ffd700")).toBe(
      '<mark style="background-color: #ffd700;">hi</mark>'
    );
  });

  it("leaves '==' comparison operators in plain prose unchanged", () => {
    expect(migrateHighlightsInText("assert a == b and c == d", "#ffd700")).toBe(
      "assert a == b and c == d"
    );
  });

  it("leaves '==' inside inline code spans unchanged", () => {
    expect(migrateHighlightsInText("`x == y` plus `p == q`", "#ffd700")).toBe(
      "`x == y` plus `p == q`"
    );
  });

  it("migrates a real highlight while leaving inline code on the same line untouched", () => {
    expect(migrateHighlightsInText("==highlight this== and `a == b` code", "#ffd700")).toBe(
      '<mark style="background-color: #ffd700;">highlight this</mark> and `a == b` code'
    );
  });

  it("strips an Extended Markdown Syntax color tag and uses the migration color instead", () => {
    expect(migrateHighlightsInText("=={cyan}Highlighted Text==", "#ffd700")).toBe(
      '<mark style="background-color: #ffd700;">Highlighted Text</mark>'
    );
  });

  it("strips a color tag alongside a normal highlight on the same line", () => {
    expect(migrateHighlightsInText("=={red}urgent== and ==normal==", "#ffd700")).toBe(
      '<mark style="background-color: #ffd700;">urgent</mark> and <mark style="background-color: #ffd700;">normal</mark>'
    );
  });
});
