import { describe, expect, it } from "vitest";
import { buildExternalLinkText } from "../../../../src/ribbon/commands/actions/externalLinkText";

describe("externalLinkText", () => {
  it("buildExternalLinkText wraps the text and URL in markdown link syntax", () => {
    expect(buildExternalLinkText("site", "https://example.com")).toBe("[site](https://example.com)");
  });
});
