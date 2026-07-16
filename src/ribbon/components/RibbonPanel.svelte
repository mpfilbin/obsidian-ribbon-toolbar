<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { App } from "obsidian";
  import type { CommandEntry, TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import { buildPropertyCommands, commandsForTab, groupsForTab } from "../commands/registry";
  import Group from "./Group.svelte";

  let {
    tab,
    editor,
    propertiesStore,
    app,
  }: {
    tab: TabId;
    editor: EditorLike | null;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
    app: App;
  } = $props();

  let properties = $derived($propertiesStore);
  let dynamicCommands = $derived(tab === "references" ? buildPropertyCommands(properties) : []);
  let groups = $derived(
    dynamicCommands.length > 0 ? [...groupsForTab(tab), "Properties"] : groupsForTab(tab)
  );
  let commands = $derived([...commandsForTab(tab), ...dynamicCommands]);
</script>

<div class="ribbon-panel">
  {#each groups as group (group)}
    <Group label={group} commands={commands.filter((c: CommandEntry) => c.group === group)} {editor} {app} />
  {/each}
</div>
