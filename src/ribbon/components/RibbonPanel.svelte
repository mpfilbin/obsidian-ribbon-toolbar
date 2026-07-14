<script lang="ts">
  import type { CommandEntry, TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import { commandsForTab, groupsForTab } from "../commands/registry";
  import Group from "./Group.svelte";

  let { tab, editor }: { tab: TabId; editor: EditorLike | null } = $props();

  let groups = $derived(groupsForTab(tab));
  let commands = $derived(commandsForTab(tab));
</script>

<div class="ribbon-panel">
  {#each groups as group (group)}
    <Group label={group} commands={commands.filter((c: CommandEntry) => c.group === group)} {editor} />
  {/each}
</div>
