<script lang="ts">
  import type { Message } from "../types";
  import { Notice, setIcon } from "obsidian";
  import { createEventDispatcher, afterUpdate } from "svelte";

  export let messages: Message[] = [];
  export let containerEl: HTMLDivElement | null = null;

  // ★ 遅延表示済みID
  export let ackShownIds: string[] = [];
  $: ackSet = new Set(ackShownIds);

  const dispatch = createEventDispatcher<{
    edited: { id: string; text: string; index: number }; // 親が persist したい場合に拾える
  }>();

  let selfEl: HTMLDivElement | null = null;
  $: containerEl = selfEl;

  // 自動スクロール（追加分）
  let lastCount = 0;
  $: if (messages.length > lastCount) {
    lastCount = messages.length;
    queueMicrotask(() => {
      const el = containerEl ?? selfEl;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      new Notice("コピーしました");
    } catch {
      new Notice("コピーに失敗しました");
    }
  }

  // ====== インライン編集 ======
  let editingId: string | null = null;
  let editText = "";
  let editingTextarea: HTMLTextAreaElement | null = null;

  function startEditing(id: string) {
    const target = messages.find(m => m.id === id);
    if (!target) return;
    editingId = id;
    editText = target.text;
    queueMicrotask(() => editingTextarea?.focus());
  }

  async function saveEdit() {
    if (!editingId) return;
    const idx = messages.findIndex(m => m.id === editingId);
    if (idx === -1) { cancelEdit(); return; }
    // ★ 親に通知（ここで messages を直接書き換えない）
    dispatch("edited", { id: editingId, text: editText ?? "", index: idx });
    cancelEdit();
  }

  function cancelEdit() {
    editingId = null;
    editText = "";
    editingTextarea = null;
  }

  function onEditKey(e: KeyboardEvent) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  // ====== DnD: エディタへコピー ======
  function onDragStart(e: DragEvent, text: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.setData("text/markdown", text);
    e.dataTransfer.effectAllowed = "copy";
  }

  // コピーアイコン（Obsidianアイコン使うなら）
  function mountCopyIcon(el: HTMLButtonElement) {
    try { setIcon(el, "copy"); } catch {}
  }

  // 編集モードの textarea 高さを入力に合わせて伸縮
  afterUpdate(() => {
    const ta = editingTextarea;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(320, Math.max(64, ta.scrollHeight)) + "px";
  });
</script>

<div class="timeline" bind:this={selfEl}>
  {#if messages.length === 0}
    <div class="empty">まだメモはありません。</div>
  {:else}
    {#each messages as m, i (m.id)}
      <div class="row self">
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="bubble"
          draggable="true"
          on:dragstart={(e) => onDragStart(e, m.text)}
          on:dblclick={() => startEditing(m.id)}
          aria-label="ダブルクリックで編集"
        >
          {#if editingId === m.id}
            <textarea
              class="editor"
              bind:this={editingTextarea}
              bind:value={editText}
              on:keydown={onEditKey}
              on:blur={saveEdit}
            />
            <div class="edit-hint">Shift+Enterで保存 / Enterで改行 / Escでキャンセル</div>
          {:else}
            <div class="text">{m.text}</div>
            <button
              class="copy"
              use:mountCopyIcon
              aria-label="コピー"
              title="コピー"
              on:click={() => copy(m.text)}
            >⧉</button>
          {/if}
        </div>
      </div>

      {#if ackSet.has(m.id)}
        <div class="row ackrow">
          <div class="ack">うん。</div>
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  :global(body.theme-light) .bubble {
    background: hsla(var(--accent-h), var(--accent-s), calc(var(--accent-l) - 6%), 0.12);
  }
  :global(body.theme-dark) .bubble {
    background: hsla(var(--accent-h), var(--accent-s), calc(var(--accent-l) + 10%), 0.16);
  }

  .timeline {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty { opacity: 0.7; font-size: 16px; padding: 8px 0; }
  .row {
    width: 100%;
  }

  /* 自分の発言行：右寄せ */
  .row.self {
    display: flex;
    justify-content: flex-end;
  }

  /* ack 行：左寄せ */
  .row.ackrow {
    display: flex;
    justify-content: flex-start;
  }

  /* バブルは中身に合わせつつ最大幅を制限 */
  .row.self .bubble {
    max-width: 100%;
  }

  /* もし fit-content が環境で怪しければこっちでもOK
  .row.self .bubble { width: auto; max-width: min(92%, 42rem); }
  */


  .bubble {
    width: 100%;
    display: inline-block;
    position: relative;
    padding: 10px 32px 10px 12px;
    border-radius: 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    box-shadow: 0 1px 0 rgba(0,0,0,.06);
    white-space: pre-line;
    word-break: break-word;
  }

  .bubble .copy {
    position: absolute;
    right: 6px; top: 6px;
    opacity: .0;
    transition: opacity .12s ease;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    font-size: 12px;
    line-height: 1;
  }
  .bubble:hover .copy { opacity: .9; }

  /* 編集モード */
  .editor {
    width: 100%;
    min-height: 64px;
    max-height: 320px;
    resize: none;
    border: none;
    outline: none;
    background: var(--background-primary);
    color: var(--text-normal);
    font: inherit;
    padding: 8px;
    border-radius: 10px;
  }
  .edit-hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .ack {
    font-size: 16px;
    color: var(--text-muted);
    margin-top: 6px;
    margin-left: 6px;
    margin-bottom: 6px;
  }
</style>
