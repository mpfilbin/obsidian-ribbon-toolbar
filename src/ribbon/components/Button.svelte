<script lang="ts" module>
  import { setIcon } from "obsidian";

  export function icon(node: HTMLElement, iconId: string) {
    setIcon(node, iconId);
    return {
      update(newIconId: string) {
        setIcon(node, newIconId);
      },
    };
  }
</script>

<script lang="ts">
  import type { App } from "obsidian";
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";

  let {
    command,
    editor,
    app,
    compact = false,
  }: { command: CommandEntry; editor: EditorLike | null; app: App; compact?: boolean } = $props();

  function handleClick() {
    if (!editor) return;
    if (command.modal) {
      command.modal(editor, app);
      return;
    }
    if (!command.action) return;
    command.action(editor);
    editor.focus();
  }
</script>

<button
  class="ribbon-button"
  class:ribbon-button-compact={compact}
  type="button"
  title={command.label}
  aria-label={command.label}
  disabled={!editor}
  onclick={handleClick}
>
  <span class="ribbon-button-icon" use:icon={command.icon}></span>
  {#if !compact}
    <span class="ribbon-button-label">{command.label}</span>
  {/if}
</button>
