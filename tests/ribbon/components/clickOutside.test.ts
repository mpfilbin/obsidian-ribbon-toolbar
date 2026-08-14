// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isOutsideClick } from "../../../src/ribbon/components/clickOutside";

describe("isOutsideClick", () => {
  it("is false when the target is inside one of the given containers", () => {
    const container = document.createElement("div");
    const child = document.createElement("button");
    container.appendChild(child);

    expect(isOutsideClick(child, container)).toBe(false);
  });

  it("is true when the target is outside every given container", () => {
    const container = document.createElement("div");
    const outsideEl = document.createElement("button");

    expect(isOutsideClick(outsideEl, container)).toBe(true);
  });

  it("checks multiple containers, and is false if any one contains the target", () => {
    const menu = document.createElement("ul");
    const item = document.createElement("li");
    menu.appendChild(item);
    const toggle = document.createElement("button");

    expect(isOutsideClick(item, toggle, menu)).toBe(false);
  });

  it("treats undefined/null containers as non-matching rather than throwing", () => {
    const outsideEl = document.createElement("button");

    expect(isOutsideClick(outsideEl, undefined, null)).toBe(true);
  });

  it("does not get fooled by another element elsewhere in the document sharing an id with a container", () => {
    // Regression: split panes render independent ribbon instances whose
    // dropdown/table-picker roots previously shared a DOM id derived only
    // from the command id, so document.getElementById(id) could resolve to
    // the wrong pane's element. isOutsideClick must never rely on ids.
    const paneOneContainer = document.createElement("div");
    paneOneContainer.id = "ribbon-dropdown-heading";
    const paneOneChild = document.createElement("button");
    paneOneContainer.appendChild(paneOneChild);

    const paneTwoContainer = document.createElement("div");
    paneTwoContainer.id = "ribbon-dropdown-heading";
    const paneTwoChild = document.createElement("button");
    paneTwoContainer.appendChild(paneTwoChild);

    document.body.appendChild(paneOneContainer);
    document.body.appendChild(paneTwoContainer);

    try {
      // A click inside pane two's dropdown must be recognized as "inside"
      // when checked against pane two's own container reference, even
      // though document.getElementById would resolve the shared id to
      // pane one's element.
      expect(isOutsideClick(paneTwoChild, paneTwoContainer)).toBe(false);
    } finally {
      paneOneContainer.remove();
      paneTwoContainer.remove();
    }
  });
});
