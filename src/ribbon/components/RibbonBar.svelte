<script lang="ts">
  import type { Writable } from "svelte/store";
  import { TABS } from "../commands/registry";
  import type { TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import Tab from "./Tab.svelte";
  import RibbonPanel from "./RibbonPanel.svelte";

  let {
    editorStore,
    defaultCollapsed,
    propertiesStore,
  }: {
    editorStore: Writable<EditorLike | null>;
    defaultCollapsed: boolean;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
  } = $props();

  let editor = $derived($editorStore);

  let activeTab = $state<TabId>(TABS[0].id);
  let collapsed = $state(defaultCollapsed);

  function selectTab(tab: TabId) {
    activeTab = tab;
  }

  function toggleCollapsed() {
    collapsed = !collapsed;
  }
</script>

<div class="ribbon-bar" class:collapsed>
  <div class="ribbon-tab-strip">
    {#each TABS as tab (tab.id)}
      <Tab
        label={tab.label}
        active={tab.id === activeTab}
        onselect={() => selectTab(tab.id)}
        ondoubleclick={toggleCollapsed}
      />
    {/each}
  </div>
  {#if !collapsed}
    <RibbonPanel tab={activeTab} {editor} {propertiesStore} />
  {/if}
</div>
