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

  let { command, editor, app }: { command: CommandEntry; editor: EditorLike | null; app: App } = $props();

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
  type="button"
  title={command.label}
  aria-label={command.label}
  disabled={!editor}
  onclick={handleClick}
>
  <span class="ribbon-button-icon" use:icon={command.icon}></span>
  <span class="ribbon-button-label">{command.label}</span>
</button>
