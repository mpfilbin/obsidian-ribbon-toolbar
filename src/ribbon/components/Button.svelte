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
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";

  let { command, editor }: { command: CommandEntry; editor: EditorLike | null } = $props();

  function handleClick() {
    if (!editor || !command.action) return;
    command.action(editor);
  }
</script>

<button
  class="ribbon-button"
  type="button"
  title={command.label}
  aria-label={command.label}
  disabled={!editor}
  onclick={handleClick}
>
  <span class="ribbon-button-icon" use:icon={command.icon}></span>
  <span class="ribbon-button-label">{command.label}</span>
</button>
