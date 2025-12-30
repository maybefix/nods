<script lang="ts">
  import type NodsPlugin from "../main";
  import { MarkdownRenderer, Component } from "obsidian";
  import { onMount, onDestroy } from "svelte";

  export let plugin: NodsPlugin;
  export let markdown = "";
  export let sourcePath = "";

  let container: HTMLDivElement;
  let component: Component | null = null;
  let lastMarkdown = "";

  async function render() {
    if (!container || !plugin) return;

    // 同じ内容なら描画しない
    if (markdown === lastMarkdown) return;
    lastMarkdown = markdown;

    // クリア
    // Obsidian の HTMLElement には empty が生えている
    // 型的に怒られるなら any キャストしてもよい
    (container as any).empty?.();
    while (container.firstChild) container.removeChild(container.firstChild);

    component?.unload();
    component = new Component();
    component.load();

    await MarkdownRenderer.render(
      plugin.app,
      markdown || "",
      container,
      sourcePath,
      component
    );
  }

  $: markdown, render();

  onMount(render);

  onDestroy(() => {
    component?.unload();
    component = null;
  });
</script>

<div bind:this={container} class="nods-markdown-preview"></div>

<style>
  .nods-markdown-preview {
    /* ここはお好みで微調整 */
    font-size: 0.95em;
    line-height: 1.5;
  }
</style>
