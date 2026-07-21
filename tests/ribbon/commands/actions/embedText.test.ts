import { describe, expect, it } from "vitest";
import { buildEmbedText } from "../../../../src/ribbon/commands/actions/embedText";

describe("embedText", () => {
  it("buildEmbedText wraps the target in bang-double-brackets with no alias", () => {
    expect(buildEmbedText("My Note", null)).toBe("![[My Note]]");
  });

  it("buildEmbedText adds a pipe-separated alias when given one", () => {
    expect(buildEmbedText("My Note", "display text")).toBe("![[My Note|display text]]");
  });

  it("buildEmbedText works for heading targets", () => {
    expect(buildEmbedText("My Note#Section", null)).toBe("![[My Note#Section]]");
  });

  it("buildEmbedText works for block reference targets", () => {
    expect(buildEmbedText("My Note#^abc123", null)).toBe("![[My Note#^abc123]]");
  });
});
