// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mount, unmount } from "svelte";
import Tab from "../../../src/ribbon/components/Tab.svelte";

describe("Tab", () => {
  it("renders its label, marks the active tab, and fires select and double-click", () => {
    const onselect = vi.fn();
    const ondoubleclick = vi.fn();
    const target = document.body.appendChild(document.createElement("div"));
    const component = mount(Tab, { target, props: { label: "Home", active: true, onselect, ondoubleclick } });

    const button = target.querySelector("button")!;
    expect(button.textContent?.trim()).toBe("Home");
    expect(button.classList.contains("active")).toBe(true);

    button.click();
    button.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(ondoubleclick).toHaveBeenCalledTimes(1);

    unmount(component);
    target.remove();
  });
});
