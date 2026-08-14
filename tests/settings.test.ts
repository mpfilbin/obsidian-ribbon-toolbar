import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/settings";

describe("DEFAULT_SETTINGS", () => {
  it("enables the ribbon and starts expanded by default", () => {
    expect(DEFAULT_SETTINGS.ribbonEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.defaultCollapsed).toBe(false);
  });

  it("defaults to tags/description/cssclasses/source", () => {
    expect(DEFAULT_SETTINGS.frontmatterProperties).toEqual([
      { name: "tags", type: "list" },
      { name: "description", type: "text" },
      { name: "cssclasses", type: "list" },
      { name: "source", type: "text" },
    ]);
  });
});

describe("mergeSettings", () => {
  it("returns the default values when nothing is stored", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("does not alias DEFAULT_SETTINGS.frontmatterProperties when nothing is stored", () => {
    const result = mergeSettings(null);
    expect(result.frontmatterProperties).not.toBe(DEFAULT_SETTINGS.frontmatterProperties);
  });

  it("mutating the returned settings never leaks into DEFAULT_SETTINGS (fresh-install regression)", () => {
    const originalLength = DEFAULT_SETTINGS.frontmatterProperties.length;

    const result = mergeSettings(null);
    result.frontmatterProperties.push({ name: "custom", type: "text" });

    expect(DEFAULT_SETTINGS.frontmatterProperties.length).toBe(originalLength);
  });

  it("mutating a returned property object never leaks into DEFAULT_SETTINGS", () => {
    const result = mergeSettings(null);
    result.frontmatterProperties[0].type = "number";

    expect(DEFAULT_SETTINGS.frontmatterProperties[0].type).toBe("list");
  });

  it("overrides individual top-level fields from stored data", () => {
    const result = mergeSettings({ ribbonEnabled: false });
    expect(result.ribbonEnabled).toBe(false);
    expect(result.defaultCollapsed).toBe(DEFAULT_SETTINGS.defaultCollapsed);
  });

  it("uses the stored frontmatterProperties array when present", () => {
    const stored = { frontmatterProperties: [{ name: "custom", type: "text" as const }] };
    expect(mergeSettings(stored).frontmatterProperties).toEqual([{ name: "custom", type: "text" }]);
  });
});
