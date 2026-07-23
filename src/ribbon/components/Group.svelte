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

  let mainCommands = $derived(commands.filter((c: CommandEntry) => !c.compact));
  let compactCommands = $derived(commands.filter((c: CommandEntry) => c.compact));
</script>

<div class="ribbon-group">
  <div class="ribbon-group-buttons">
    {#each mainCommands as command (command.id)}
      {#if command.grid}
        <TablePicker {command} {editor} />
      {:else if command.options}
        <Dropdown {command} {editor} />
      {:else}
        <Button {command} {editor} {app} />
      {/if}
    {/each}
    {#if compactCommands.length > 0}
      <div class="ribbon-compact-grid">
        {#each compactCommands as command (command.id)}
          <Button {command} {editor} {app} compact />
        {/each}
      </div>
    {/if}
  </div>
  <div class="ribbon-group-label">{label}</div>
</div>
