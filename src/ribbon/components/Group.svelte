<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import Button from "./Button.svelte";
  import Dropdown from "./Dropdown.svelte";

  let {
    label,
    commands,
    editor,
  }: { label: string; commands: CommandEntry[]; editor: EditorLike | null } = $props();
</script>

<div class="ribbon-group">
  <div class="ribbon-group-buttons">
    {#each commands as command (command.id)}
      {#if command.options}
        <Dropdown {command} {editor} />
      {:else}
        <Button {command} {editor} />
      {/if}
    {/each}
  </div>
  <div class="ribbon-group-label">{label}</div>
</div>
