<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import { icon } from "./Button.svelte";
  import { isOutsideClick } from "./clickOutside";

  let { command, editor }: { command: CommandEntry; editor: EditorLike | null } = $props();

  let open = $state(false);
  let menuStyle = $state("");
  let rootEl: HTMLDivElement | undefined = $state();
  let toggleEl: HTMLButtonElement | undefined = $state();
  let menuEl: HTMLUListElement | undefined = $state();

  // The ribbon panel scrolls horizontally, which (per CSS overflow rules) also
  // clips vertical overflow of descendants — so the menu is moved to <body> and
  // positioned via the toggle button's viewport rect instead of being an
  // absolutely-positioned descendant of the clipped panel.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function toggleOpen() {
    open = !open;
    if (open && toggleEl) {
      const rect = toggleEl.getBoundingClientRect();
      menuStyle = `position: fixed; top: ${rect.bottom + 2}px; left: ${rect.left}px;`;
    }
  }

  function choose(action: (editor: EditorLike) => void) {
    if (editor) {
      action(editor);
      editor.focus();
    }
    open = false;
  }

  function handleWindowClick(event: MouseEvent) {
    if (!(event.target instanceof Node)) return;
    if (isOutsideClick(event.target, rootEl, menuEl)) open = false;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="ribbon-dropdown" bind:this={rootEl}>
  <button
    class="ribbon-button"
    type="button"
    title={command.label}
    aria-label={command.label}
    disabled={!editor}
    onclick={toggleOpen}
    bind:this={toggleEl}
  >
    <span class="ribbon-button-icon" use:icon={command.icon}></span>
    <span class="ribbon-button-label">{command.label} ▾</span>
  </button>
  {#if open}
    <ul class="ribbon-dropdown-menu" style={menuStyle} use:portal bind:this={menuEl}>
      {#each command.options ?? [] as option (option.id)}
        <li>
          <button type="button" onclick={() => choose(option.action)}>{option.label}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
