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
    // isFocused変数はレイアウト制御に使わないため削除しても良いが、状態管理用に残す
    let isFocused = false; 

    export function focus() {
        if (!textarea) return;
        textarea.focus();
        // Set cursor to end
        const len = textarea.value.length;
        textarea.setSelectionRange?.(len, len);
    }

    function submit() {
        const text = value.trim();
        if (!text) return;
        dispatch("submit", text);
        
        // 送信後、即座に空にして高さを戻す
        value = "";
        resetTextareaHeight();
        
        // 【重要】PCならフォーカス維持、モバイルならUX次第だが
        // チャットアプリ風ならフォーカス維持が基本
        // requestAnimationFrameを使うとiOSでの再フォーカスが安定する
        requestAnimationFrame(() => {
             textarea?.focus();
        });
    }

    // 【重要】iOSの「ゴーストクリック/キーボード閉じ」防止用ハンドラ
    function handleSendPress(e: Event) {
        // これが最重要。ボタンを押してもテキストボックスからフォーカスを奪わせない
        e.preventDefault(); 
        submit();
    }

    function onKeydown(e: KeyboardEvent) {
        // ... (既存のロジックそのまま) ...
        if (e.key === "Enter" && performance.now() < ignoreEnterUntil) {
            e.stopPropagation?.();
            return;
        }
        if (!isMobile && pcEnterSendDisabled && e.key === "Enter" && !e.shiftKey) {
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
        textarea.value = "";
        textarea.style.height = "";
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
        on:focus={() => isFocused = true}
        on:blur={() => isFocused = false}
        autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="話しかけてください"
    />
    
    <button 
        type="button" 
        class="send" 
        on:touchstart|nonpassive={handleSendPress} 
        on:mousedown={handleSendPress}
        aria-label="送信" 
        title="送信" 
        disabled={!value.trim()}
    >
        <SendHorizontal size={20} strokeWidth={1.75} />
    </button>
</div>

<style>
    /* composerFixedクラス（position: fixed切り替え）は、
       iOSレイアウト崩れの元凶なので削除し、通常のフロー配置にするか、
       親側で制御することを強く推奨。
    */

    .composer {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: end;
        padding: 10px;
        
        /* ボーダーや背景はOK */
        border-top: 1px solid var(--background-modifier-border);
        background: var(--background-primary);

        /* デフォルトのpadding-bottom設定。
           iOSの場合、フォーカス時は 0 にしないと二重余白になる。
           これはCSS側で :has() を使って制御するか、親のクラスで制御する。
           padding-bottom: calc(10px + env(safe-area-inset-bottom));
        */
        padding-bottom: 10px;
    }

    /* もし「キーボードが出ている時は safe-area 分の余白を消したい」なら
       以下のようにメディアクエリやクラスで制御する 
    */
    @media (hover: none) and (pointer: coarse) {
        /* モバイルでフォーカスされている時（親要素にクラスをつける等の工夫が必要だが、簡易的には以下） */
        /* Note: Svelteの変数でクラスを付け替える場合 */
        /* .composer.focused { padding-bottom: 10px; } */
    }

    .composer-textarea {
        resize: none;
        line-height: 1.5;
        border-radius: 14px;
        border: 1px solid var(--background-modifier-border);
        padding: 10px 12px;
        background: var(--background-secondary);
        font-size: 16px;
        max-height: 200px; /* 自動リサイズの上限 */
    }
    .send {
        width: 40px; height: 40px;
        border-radius: 50%;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        font-size: 20px;
        /* 中央揃えのために flex を追加 */
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
    }
    .send:disabled { opacity: .5; cursor: default; }
</style>