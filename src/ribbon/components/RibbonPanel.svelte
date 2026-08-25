<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { App } from "obsidian";
  import type { CommandEntry, TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import type { HighlightColorConfig } from "../commands/actions/highlightMark";
  import {
    buildHighlightColorCommands,
    buildPropertyCommands,
    commandsForTab,
    groupsForTab,
  } from "../commands/registry";
  import Group from "./Group.svelte";

  let {
    tab,
    editor,
    propertiesStore,
    highlightColorsStore,
    app,
  }: {
    tab: TabId;
    editor: EditorLike | null;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
    highlightColorsStore: Writable<HighlightColorConfig[]>;
    app: App;
  } = $props();

  let properties = $derived($propertiesStore);
  let highlightColors = $derived($highlightColorsStore);
  let dynamicCommands = $derived(
    tab === "references"
      ? buildPropertyCommands(properties)
      : tab === "home"
        ? buildHighlightColorCommands(highlightColors)
        : []
  );
  let dynamicGroups = $derived(tab === "references" && dynamicCommands.length > 0 ? ["Properties"] : []);
  let groups = $derived([...groupsForTab(tab), ...dynamicGroups]);
  let commands = $derived([...commandsForTab(tab), ...dynamicCommands]);
</script>

<div class="ribbon-panel">
  {#each groups as group (group)}
    <Group label={group} commands={commands.filter((c: CommandEntry) => c.group === group)} {editor} {app} />
  {/each}
</div>
