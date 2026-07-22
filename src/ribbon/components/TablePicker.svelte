<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import { icon } from "./Button.svelte";

  let { command, editor }: { command: CommandEntry; editor: EditorLike | null } = $props();

  const GRID_COLUMNS = 10;
  const GRID_ROWS = 8;

  let open = $state(false);
  let menuStyle = $state("");
  let hoverCol = $state(0);
  let hoverRow = $state(0);
  let toggleEl: HTMLButtonElement | undefined = $state();
  let menuEl: HTMLDivElement | undefined = $state();
  const rootId = `ribbon-table-picker-${command.id}`;

  // Same overflow-escape rationale as Dropdown.svelte: the ribbon panel scrolls
  // horizontally, which clips vertical overflow of descendants, so the popover is
  // portaled to <body> and positioned via the toggle button's viewport rect.
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
      hoverCol = 0;
      hoverRow = 0;
    }
  }

  function hover(col: number, row: number) {
    hoverCol = col;
    hoverRow = row;
  }

  function choose(col: number, row: number) {
    if (editor && command.grid) {
      command.grid(editor, col, row);
      editor.focus();
    }
    open = false;
  }

  function handleWindowClick(event: MouseEvent) {
    if (!(event.target instanceof Node)) return;
    const root = document.getElementById(rootId);
    const clickedRoot = root?.contains(event.target) ?? false;
    const clickedMenu = menuEl?.contains(event.target) ?? false;
    if (!clickedRoot && !clickedMenu) open = false;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="ribbon-dropdown" id={rootId}>
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
    <div class="ribbon-table-picker-menu" style={menuStyle} use:portal bind:this={menuEl}>
      <div class="ribbon-table-picker-grid">
        {#each Array.from({ length: GRID_ROWS }) as _, rowIndex (rowIndex)}
          {#each Array.from({ length: GRID_COLUMNS }) as _, colIndex (colIndex)}
            {@const row = rowIndex + 1}
            {@const col = colIndex + 1}
            <button
              type="button"
              class="ribbon-table-picker-cell"
              class:active={col <= hoverCol && row <= hoverRow}
              aria-label={`${row} × ${col} table`}
              onmouseenter={() => hover(col, row)}
              onclick={() => choose(col, row)}
            ></button>
          {/each}
        {/each}
      </div>
      <div class="ribbon-table-picker-label">
        {hoverCol > 0 && hoverRow > 0 ? `${hoverRow} × ${hoverCol} Table` : "Select table size"}
      </div>
    </div>
  {/if}
</div>
