import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("DEFAULT_SETTINGS", () => {
  it("enables the ribbon and starts expanded by default", () => {
    expect(DEFAULT_SETTINGS).toEqual({ ribbonEnabled: true, defaultCollapsed: false });
  });
});
