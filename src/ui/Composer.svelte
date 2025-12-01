<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import type { SendEnv } from "./keystrokes";
    import { shouldSend } from "./keystrokes";
    import { SendHorizontal } from "lucide-svelte";

    export let isMobile = false;
    export let pcEnterSendDisabled = false;
    export let mobileEnterSendEnabled = false;

    const dispatch = createEventDispatcher<{ submit: string }>();
    let textarea: HTMLTextAreaElement;
    let lastMeasured = 0;
    let value = "";
    let isComposing = false;
    let ignoreEnterUntil = 0;

    export function focus() {
        if (!textarea) return;
        textarea.focus();
        // 末尾にキャレットを移動（任意）
        const len = textarea.value.length;
        textarea.setSelectionRange?.(len, len);
    }

    function submit() {
        const text = value.trim();
        if (!text) return;
        dispatch("submit", text);
        value = "";
        textarea?.focus();
        resetTextareaHeight();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && performance.now() < ignoreEnterUntil) {
            e.stopPropagation?.();
            return;
        }

        // ★ハードガード：PC × 「Enter=改行」設定 → Enter単独は絶対に送信しない
        if (!isMobile && pcEnterSendDisabled && e.key === "Enter" && !e.shiftKey) {
            // 改行はネイティブに任せるので preventDefault はしない
            e.stopPropagation?.();
            return;
        }
        const env: SendEnv = { isMobile, pcEnterSendDisabled, mobileEnterSendEnabled, isComposing };
        if (shouldSend(e, env)) {
            e.preventDefault();
            submit();
        }
    }
    function onCompStart() { isComposing = true; }
    function onCompEnd()   { isComposing = false; ignoreEnterUntil = performance.now() + 120;}

    function autoResize() {
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
        lastMeasured = textarea.scrollHeight;
    }

    function resetTextareaHeight() {
        if (!textarea) return;
        textarea.value = "";          // 念のため
        textarea.style.height = "";   // CSSの初期値 / min-height に戻す
        lastMeasured = 0;
    }

    $: if (typeof value === "string" && value.length === 0) {
        resetTextareaHeight();
    }
    onMount(() => { autoResize(); });
</script>

<div class="composer">
    <textarea
        bind:this={textarea}
        bind:value
        rows="1"
        class="composer-textarea"
        on:keydown={onKeydown}
        on:input={autoResize}
        on:compositionstart={onCompStart}
        on:compositionend={onCompEnd}
        autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
        enterkeyhint="enter"
        placeholder="話しかけてください"
    />
    <button type="button" class="send" on:click={submit} aria-label="送信" title="送信" disabled={!value.trim()}>
        <SendHorizontal size={20} strokeWidth={1.75} />
    </button>
</div>

<style>
    .composer {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: end;
        padding: 10px;
        border-top: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
    }
    .composer-textarea {
        resize: none;
        line-height: 1.5;
        border-radius: 14px;
        border: 1px solid var(--background-modifier-border);
        padding: 10px 12px;
        background: var(--background-secondary);
        font-size: 16px;
    }
    .send {
        width: 40px; height: 40px;
        border-radius: 50%;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        font-size: 20px;
    }
    .send:disabled { opacity: .5; }
</style>
