<script lang="ts">
  import Welcome from "./Welcome.svelte";
  import Timeline from "./Timeline.svelte";
  import Composer from "./Composer.svelte";
  import HamburgerMenu from "./HamburgerMenu.svelte";
  void [Welcome, Timeline, Composer, HamburgerMenu];
  import { tick } from "svelte"; 
  import { RefreshCw } from 'lucide-svelte';

  import type NodsPlugin from "../main";
  // ★ 値として使うので type なし
  import { Platform, Notice, normalizePath, TFile, TFolder } from "obsidian";

  // ★ types からは純粋な型/ロジック
  import { pushMessage, type Session, createSession, type Message } from "../types";

  // ★ splitMarkdownToMessages は io/temp から
  import { saveSessionToTempFile, loadSessionFromTempFile } from "../io/temp";
  import { exportMarkdown } from "../io/export";
  import { backupSessionMarkdown } from "../io/backup";
  import { TempWatcher } from "../io/watch";
  import { LoadFileModal } from "../modals/LoadFileModal";

  export let plugin: NodsPlugin;
  export let initialSession: Session;
  export let initialTempFile: TFile;
  export let api: any = {};      // props が無くても安全
  type EditPayload = { id: string; text: string; index: number };
  let composerRef: any = null;
  let ready = false;
  let session!: Session;
  let tempFile!: TFile;
  let timelineEl: HTMLDivElement | null = null;
  let ackShownIds: string[] = [];
  let menuOpen = false;
  let isMobile =
    Platform.isMobile || Platform.isMobileApp || /Mobi|Android/i.test(navigator.userAgent);
  export function focusComposer() {
    composerRef?.focus?.();
  }

  // 末尾メッセージのIDが変わったらスクロール
  $: lastMsgId = session?.messages?.length
    ? session.messages[session.messages.length - 1].id
    : null;
  $: ackVersion = ackShownIds.join("|");
  $: if (ready && (lastMsgId || ackVersion)) {
    scrollToBottom(true);
  }

  // ========== watcher ==========
  let watcher: any = null;
  function detachWatcher() {
    if (watcher) {
      try {
        if (typeof watcher.dispose === "function") watcher.dispose();
        else if (typeof watcher.unregister === "function") watcher.unregister();
        else if (typeof watcher.off === "function") watcher.off();
      } catch {}
    }
    watcher = null;
  }
  function attachWatcher() {
    if (!tempFile) return;
    detachWatcher();
    watcher = new TempWatcher(plugin.app, tempFile.path, async () => {
      // 必要なら外部更新追随を実装
    });
  }
  async function persistTempSelfWrite() {
    if (!tempFile) return;
    watcher?.markSelfWrite?.();
    await saveSessionToTempFile(plugin.app, tempFile, session);
  }

  // ========== フォルダ/ファイル ==========
  const TEMP_NAME = "nods-temp.md";

  function resolveExportFolder(): TFolder | null {
    const base = (plugin.settings as any).exportFolder?.trim() || ".nods/logs";
    const path = normalizePath(base);
    const af = plugin.app.vault.getAbstractFileByPath(path);
    return af instanceof TFolder ? af : null;
  }

  // ★ plugin.ensureExportFolderExists が無い前提のローカル実装
  async function ensureExportFolderExists(opts?: { showNotice?: boolean }): Promise<boolean> {
    const base = (plugin.settings as any).exportFolder?.trim() || ".nods/logs";
    const parts = base.split("/").filter(Boolean);
    let cur = "";
    try {
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        const af = plugin.app.vault.getAbstractFileByPath(cur);
        if (!af) {
          await plugin.app.vault.createFolder(cur);
        }
      }
      return true;
    } catch (e) {
      if (opts?.showNotice) new Notice("保存先フォルダを作成できませんでした。");
      return false;
    }
  }

  async function ensureTempFile() {
    const folder = resolveExportFolder();
    if (!folder) return;
    const path = normalizePath(`${folder.path}/${TEMP_NAME}`);
    const af = plugin.app.vault.getAbstractFileByPath(path);
    if (af instanceof TFile) {
      tempFile = af;
      return;
    }
    tempFile = await plugin.app.vault.create(path, "");
    await saveSessionToTempFile(plugin.app, tempFile, session);
  }

  // ========== 「うん。」遅延 ==========
  function scheduleAckForLast() {
    const last = session.messages[session.messages.length - 1];
    if (!last) return;
    const id = last.id;
    const delay = 1000 + Math.floor(Math.random() * 2000);
    setTimeout(async() => {
      if (!ackShownIds.includes(id)) {
        ackShownIds = [...ackShownIds, id];
        console.log(ackShownIds)
        await scrollToBottom(true); 
      }
    }, delay);
  }

  // ========== Welcome → 本体表示 ==========
  async function handleReady() {
    ready = true;
    session = initialSession;
    tempFile = initialTempFile;
    ackShownIds = session.messages.map(m => m.id);
    attachWatcher();

    // Welcome → 本体DOM確定を待つ
    await tick();

    // まずは既存の refreshLog API があれば使う
    let refreshed = false;
    if (typeof api?.refreshLog === "function") {
      try {
        await api.refreshLog();
        refreshed = true;
      } catch {
        // 失敗時はフォールバックへ
      }
    }

    // refreshLog が無い or 失敗した時のフォールバック
    if (!refreshed && tempFile) {
      try {
        const loaded = await loadSessionFromTempFile(plugin.app, tempFile);
        session = { ...loaded, messages: [...loaded.messages] };
        ackShownIds = loaded.messages.map(m => m.id);
      } catch (err) {
        new Notice("一時ログの読み込みに失敗: " + String(err));
      }
    }
  
    // ★ 最新状態で最下部へ
    await tick();
    await scrollToBottom(false); // 子TimelineのscrollToBottomを呼ぶ場合
    // もしくは: await scrollToBottom(false); // 親で持っているスクロール関数があれば
  }

  // ========== 送信 ==========
  async function onSubmit(text: string) {
    try {
      pushMessage(session, text);
      session = { ...session, messages: [...session.messages] }; // reactivity
      scheduleAckForLast();
      await persistTempSelfWrite();
      await scrollToBottom(true);
    } catch (e) {
      console.error(e);
      new Notice("入力の処理に失敗: " + String(e));
    }
  }

  function splitMarkdownToMessages(txt: string): Message[] {
      const blocks = txt
          .split(/\r?\n{2,}/)
          .map(s => s.replace(/\s+$/g, ""))
          .filter(s => s.length > 0);

      return blocks.map<Message>((b) => ({
          id: (globalThis.crypto?.randomUUID?.() ?? String(Math.random())),
          ts: new Date().toISOString(),
          text: b,
          reply: "うん。" as const,
      }));
  }

  function onTimelineEdited(e: CustomEvent<EditPayload>) {
    const { id, text } = e.detail;

    // 対象メッセージを探す
    const idx = session.messages.findIndex((m) => m.id === id);
    if (idx === -1) return;

    // ★ 不変更新で再代入：Svelteの反映を確実にする
    session = {
      ...session,
      messages: session.messages.map((m) => (m.id === id ? { ...m, text } : m)),
      updatedAt: new Date().toISOString(),
    };

    // ★ nods-tempへ即保存（あなたの既存関数名に合わせて）
    persistTempSelfWrite()
      .then(() => {
        // 保存後、最下部へ（必要なら）
        if (timelineEl) timelineEl.scrollTop = timelineEl.scrollHeight;
      })
      .catch(() => {});
}

    async function scrollToBottom(smooth = true) {
      await tick(); // DOM更新を待ってから
      await tick();
      const el = timelineEl;
      if (!el) return;
      // レイアウト反映後のフレームで確実に
      requestAnimationFrame(() => {
        try {
          el.scrollTo({
            top: el.scrollHeight,
            behavior: smooth ? "smooth" : "auto",
          });
        } catch {
          // 古い環境向けフォールバック
          el.scrollTop = el.scrollHeight;
        }
      });
    }

  /* ===== メニュー処理ブロック（あなたの現行コードを最小修正で採用） ===== */
  function doExport() { api.exportLog?.(); }
  function doLoad() { api.loadFile?.(); }
  function doClear() { api.clearLog?.(); }
  function doRefresh() { api.refreshLog?.(); }  // ★ 追加

  // main.ts からの API 実装
  api.exportLog = async () => {
    try {
      if (!resolveExportFolder()) {
        const ok = await ensureExportFolderExists({ showNotice: true }); // ← ローカル実装を使用
        if (!ok) throw new Error("出力先フォルダが見つかりません。");
      }
      const folder = resolveExportFolder();
      if (!folder) throw new Error("出力先フォルダが見つかりません。");
      await exportMarkdown(plugin.app, folder, session);
      new Notice("エクスポートしました。");
    } catch (e) {
      new Notice("エクスポートに失敗: " + String(e));
    } finally {
      menuOpen = false;
    }
  };

  api.loadFile = async () => {
    if (!resolveExportFolder()) {
      const ok = await ensureExportFolderExists({ showNotice: true }); // ← ローカル実装
      if (!ok) { new Notice("出力先フォルダが見つかりません。"); return; }
    }
    const folder = resolveExportFolder();
    if (!folder) { new Notice("出力先フォルダが見つかりません。"); return; }

    new LoadFileModal({
      app: plugin.app,
      folder,
      onPick: async (file: TFile) => {
        try {
          const txt = await plugin.app.vault.read(file);
          const msgs: Message[] = splitMarkdownToMessages(txt); // ← 型を明示
          session = { ...session, messages: msgs, updatedAt: new Date().toISOString() };
          ackShownIds = msgs.map((m: Message) => m.id); // ← 型を明示
          await persistTempSelfWrite();
          new Notice(`読み込み完了: ${file.name}`);
          await scrollToBottom(true);
        } catch (e) {
          new Notice("読み込みに失敗: " + String(e));
        }
      }
    }).open();
    menuOpen = false;
  };

  api.clearLog = async () => {
    try {
      let folder = resolveExportFolder();
      if (!folder) {
        const ok = await ensureExportFolderExists({ showNotice: true }); // ← ローカル実装
        if (ok) folder = resolveExportFolder();
      }
      if (!folder) throw new Error("出力先フォルダが見つかりません。");

      await backupSessionMarkdown(plugin.app, folder, session, (plugin.settings as any).backupGenerations);

      session = createSession(plugin.app.vault.getName(), (plugin as any).manifest?.version ?? "v1");
      ackShownIds = [];

      // 既存 tempFile が無ければ作る／あれば上書き保存
      if (!tempFile) {
        await ensureTempFile();
      }
      if (tempFile) {
        await saveSessionToTempFile(plugin.app, tempFile, session);
      }

      attachWatcher();
      new Notice("現在のログをクリアしました（バックアップ済み）。");
      if (timelineEl) timelineEl.scrollTop = 0;
    } catch (e) {
      new Notice("クリアに失敗: " + String(e));
    } finally {
      menuOpen = false;
    }
  };

   api.refreshLog = async () => {                 // ★ 追加
   try {
     if (!tempFile) { new Notice("一時ログが見つかりません。"); return; }
     const loaded = await loadSessionFromTempFile(plugin.app, tempFile);
     session = { ...loaded, messages: [...loaded.messages] }; // 参照更新で描画
     ackShownIds = loaded.messages.map((m: Message) => m.id);
     new Notice("ログを更新しました。");
     await scrollToBottom(true);
   } catch (e) {
     new Notice("ログの更新に失敗: " + String(e));
   } finally {
     menuOpen = false;
   }
 };
</script>

{#if !ready}
  <Welcome on:ready={handleReady} />
{:else}
  <div class="nods-root">
    <div class="header">
      <div class="left">
        <button class="hamburger" on:click={() => (menuOpen = true)} aria-label="メニュー">☰</button>
        <div class="title">Nods</div>
        <button class="refresh" on:click={doRefresh} aria-label="更新"><RefreshCw /></button>
      </div>
      <div class="tools">
      </div>
    </div>

    <div class="body">
      <Timeline messages={session.messages} bind:containerEl={timelineEl} on:edited={onTimelineEdited} {ackShownIds} />
    </div>

    <Composer
      bind:this={composerRef}
      isMobile={false}
      pcEnterSendDisabled={plugin.settings.pcEnterSendDisabled}
      mobileEnterSendEnabled={plugin.settings.mobileEnterSendEnabled}
      on:submit={(e) => onSubmit(e.detail)}
    />

    <HamburgerMenu
    bind:open={menuOpen}
    on:export={doExport}
    on:load={doLoad}
    on:clear={doClear}
    on:refresh={doRefresh}
    on:close={() => (menuOpen = false)}
    />
  </div>
{/if}

<style>
  .nods-root {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .header {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }
  .left { display: inline-flex; gap: 8px; align-items: center; }
  .title { font-weight: 600; }
  .hamburger {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    font-size: 16px; line-height: 1;
  }
  .refresh {
    width: 42px; height: 28px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    font-size: 16px; line-height: 1;
  }

  /* ★ ここが大事：タイムライン領域を親側で確保 */
  .body {
    flex: 1 1 auto;
    min-height: 0;       /* ← これがないとスクロール領域が潰れる */
    display: flex;       /* 子を 100% に広げやすくする */
  }

    :global(.workspace-leaf-content[data-type="nods-view"] > .view-content) {
    /* 上 右 下 左 */
    padding: 0 0 max(var(--safe-area-inset-bottom, 0px), var(--size-4-8)) 0;
    }

  /* 任意：Composer はそのまま下に */
</style>
