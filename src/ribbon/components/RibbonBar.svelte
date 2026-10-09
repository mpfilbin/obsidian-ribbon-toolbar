<script lang="ts">
  import { untrack } from "svelte";
  import type { Writable } from "svelte/store";
  import type { App } from "obsidian";
  import { DEFAULT_TAB, TABS } from "../commands/registry";
  import type { TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import type { FrontmatterPropertyConfig } from "../commands/actions/frontmatter";
  import Tab from "./Tab.svelte";
  import RibbonPanel from "./RibbonPanel.svelte";

  let {
    editorStore,
    defaultCollapsed,
    propertiesStore,
    app,
    initialTab = DEFAULT_TAB,
    ontabchange,
  }: {
    editorStore: Writable<EditorLike | null>;
    defaultCollapsed: boolean;
    propertiesStore: Writable<FrontmatterPropertyConfig[]>;
    app: App;
    initialTab?: TabId;
    ontabchange?: (tab: TabId) => void;
  } = $props();

  let editor = $derived($editorStore);

  // initialTab and defaultCollapsed only seed the starting state: a ribbon keeps the tab
  // and collapsed state the user left it in, so later changes to them are ignored on purpose.
  let activeTab = $state<TabId>(untrack(() => (TABS.some((tab) => tab.id === initialTab) ? initialTab : DEFAULT_TAB)));
  let collapsed = $state(untrack(() => defaultCollapsed));

  function selectTab(tab: TabId) {
    activeTab = tab;
    ontabchange?.(tab);
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
    <RibbonPanel tab={activeTab} {editor} {propertiesStore} {app} />
  {/if}
</div>
