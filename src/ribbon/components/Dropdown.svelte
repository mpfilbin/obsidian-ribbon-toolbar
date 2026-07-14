<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";

  let { command, editor }: { command: CommandEntry; editor: EditorLike | null } = $props();

  let open = $state(false);
  const rootId = `ribbon-dropdown-${command.id}`;

  function toggleOpen() {
    open = !open;
  }

  function choose(action: (editor: EditorLike) => void) {
    if (editor) action(editor);
    open = false;
  }

  function handleWindowClick(event: MouseEvent) {
    if (!(event.target instanceof Node)) return;
    const root = document.getElementById(rootId);
    if (root && !root.contains(event.target)) open = false;
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
  >
    <span class="ribbon-button-label">{command.label} ▾</span>
  </button>
  {#if open}
    <ul class="ribbon-dropdown-menu">
      {#each command.options ?? [] as option (option.id)}
        <li>
          <button type="button" onclick={() => choose(option.action)}>{option.label}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
