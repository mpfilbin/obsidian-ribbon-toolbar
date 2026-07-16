import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";

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
