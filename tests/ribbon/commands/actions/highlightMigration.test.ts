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
});
