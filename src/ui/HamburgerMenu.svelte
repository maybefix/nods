<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { clickOutside } from "./clickOutside";

    export let open = false;
    const dispatch = createEventDispatcher<{ close: void; export: void; load: void; clear: void; refresh: void }>();

    let dialogEl: HTMLDivElement | null = null;

    function close() { dispatch("close"); }
    function doExport() { dispatch("export"); }
    function doLoad() { dispatch("load"); }
    function doClear() { dispatch("clear"); }
    function onRefresh() {dispatch("refresh");
  }

    // 初期フォーカス（スクリーンリーダー/キーボード操作のため）
    onMount(() => {
        if (open) queueMicrotask(() => dialogEl?.focus());
    });

    $: if (open) queueMicrotask(() => dialogEl?.focus());
</script>

<!-- Escape はウィンドウで拾う（overlay に keydown を付けない） -->
<svelte:window on:keydown={(e) => { if (open && e.key === "Escape") close(); }} />

{#if open}
    <!-- overlay は表示用。クリック外で閉じる処理は menu 側に任せる or 背景クリックで閉じるならここで on:click={close} も可 -->
    <div class="overlay" role="presentation">
        <div
            class="menu"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            bind:this={dialogEl}
            use:clickOutside={close}
        >
            <h4 id="nods-menu-title">Nods メニュー</h4>
            <div class="btns" aria-labelledby="nods-menu-title">
                <button on:click={doExport}>ログを書き出す…</button>
                <button on:click={doLoad}>ファイルを読み込む…</button>
                <button on:click={onRefresh}>ログを更新</button><!-- ★ 追加 -->
                <button on:click={doClear}>現在のログをクリア…</button>
                <button on:click={close} aria-label="閉じる">閉じる</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 99999;
        display: grid;
        place-items: start end;
    }
    .menu {
        margin: 16px;
        padding: 12px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        min-width: 240px;
        box-shadow: var(--shadow-s);
        display: grid;
        gap: 8px;
        outline: none; /* tabindex=-1 で focus() したときのブラウザ既定アウトライン抑制（必要なら） */
    }
    .btns {
        display: grid;
        gap: 6px;
    }
</style>
