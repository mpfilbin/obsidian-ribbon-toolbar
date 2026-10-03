// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import Button from "../../../src/ribbon/components/Button.svelte";
import type { CommandEntry } from "../../../src/ribbon/commands/registry";
import { createMockEditor } from "../../support/mockEditor";
import { click, render } from "../../support/svelte";

const app = {} as never;

function command(overrides: Partial<CommandEntry> = {}): CommandEntry {
  return { id: "x", tab: "home", group: "Font", icon: "bold", label: "Bold", action: vi.fn(), ...overrides };
}

describe("Button", () => {
  it("renders the icon, label, tooltip and accessible name", () => {
    const editor = createMockEditor("");
    const target = render(Button, { command: command(), editor, app });
    const button = target.querySelector("button")!;
    expect(button.getAttribute("title")).toBe("Bold");
    expect(button.getAttribute("aria-label")).toBe("Bold");
    expect(button.querySelector(".ribbon-button-icon")!.getAttribute("data-icon")).toBe("bold");
    expect(button.querySelector(".ribbon-button-label")!.textContent).toBe("Bold");
    expect(button.disabled).toBe(false);
  });

  it("hides the label and adds the compact class in compact mode", () => {
    const target = render(Button, { command: command(), editor: createMockEditor(""), app, compact: true });
    const button = target.querySelector("button")!;
    expect(button.classList.contains("ribbon-button-compact")).toBe(true);
    expect(button.querySelector(".ribbon-button-label")).toBeNull();
    expect(button.getAttribute("aria-label")).toBe("Bold");
  });

  it("is disabled when there is no editor (e.g. Reading mode)", () => {
    const target = render(Button, { command: command(), editor: null, app });
    expect(target.querySelector("button")!.disabled).toBe(true);
  });

  it("runs the action against the editor, then refocuses it", () => {
    const editor = createMockEditor("");
    const focus = vi.spyOn(editor, "focus");
    const action = vi.fn();
    const target = render(Button, { command: command({ action }), editor, app });
    click(target.querySelector("button")!);
    expect(action).toHaveBeenCalledWith(editor);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("opens the command's modal instead of running an action, leaving focus to the modal", () => {
    const editor = createMockEditor("");
    const focus = vi.spyOn(editor, "focus");
    const modal = vi.fn();
    const action = vi.fn();
    const target = render(Button, { command: command({ modal, action }), editor, app });
    click(target.querySelector("button")!);
    expect(modal).toHaveBeenCalledWith(editor, app);
    expect(action).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it("does nothing when a command has neither an action nor a modal", () => {
    const editor = createMockEditor("");
    const focus = vi.spyOn(editor, "focus");
    const target = render(Button, { command: command({ action: undefined }), editor, app });
    click(target.querySelector("button")!);
    expect(focus).not.toHaveBeenCalled();
  });
});
