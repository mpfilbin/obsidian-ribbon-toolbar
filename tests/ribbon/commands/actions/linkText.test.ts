import { describe, expect, it } from "vitest";
import { buildLinkText } from "../../../../src/ribbon/commands/actions/linkText";

describe("linkText", () => {
  it("buildLinkText wraps the target in double brackets with no alias", () => {
    expect(buildLinkText("My Note", null)).toBe("[[My Note]]");
  });

  it("buildLinkText adds a pipe-separated alias when given one", () => {
    expect(buildLinkText("My Note", "display text")).toBe("[[My Note|display text]]");
  });
});
