// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findInjectionPoint } from "../../src/ribbon/injectionPoint";

describe("findInjectionPoint", () => {
  it("finds the .view-content element within a container", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div class="view-header"></div><div class="view-content"><div class="markdown-source-view"></div></div>';
    const result = findInjectionPoint(container);
    expect(result).not.toBeNull();
    expect(result?.className).toBe("view-content");
  });

  it("returns null when there is no .view-content element", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div class="view-header"></div>';
    expect(findInjectionPoint(container)).toBeNull();
  });
});
