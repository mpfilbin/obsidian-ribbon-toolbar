<script lang="ts">
  import type { App } from "obsidian";
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import Button from "./Button.svelte";
  import Dropdown from "./Dropdown.svelte";
  import TablePicker from "./TablePicker.svelte";

  let {
    label,
    commands,
    editor,
    app,
  }: { label: string; commands: CommandEntry[]; editor: EditorLike | null; app: App } = $props();
</script>

<div class="ribbon-group">
  <div class="ribbon-group-buttons">
    {#each commands as command (command.id)}
      {#if command.grid}
        <TablePicker {command} {editor} />
      {:else if command.options}
        <Dropdown {command} {editor} />
      {:else}
        <Button {command} {editor} {app} />
      {/if}
    {/each}
  </div>
  <div class="ribbon-group-label">{label}</div>
</div>
