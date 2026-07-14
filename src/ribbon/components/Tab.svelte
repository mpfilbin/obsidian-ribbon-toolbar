<script lang="ts">
  let {
    label,
    active,
    onselect,
    ondoubleclick,
  }: { label: string; active: boolean; onselect: () => void; ondoubleclick: () => void } = $props();
</script>

<button type="button" class="ribbon-tab" class:active onclick={onselect} ondblclick={ondoubleclick}>
  {label}
</button>
