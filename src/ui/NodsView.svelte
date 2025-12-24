<script lang="ts">
  import Welcome from "./Welcome.svelte";
  import Timeline from "./Timeline.svelte";
  import Composer from "./Composer.svelte";
  import HamburgerMenu from "./HamburgerMenu.svelte";
  void [Welcome, Timeline, Composer, HamburgerMenu];
  import { tick } from "svelte";
  import { RefreshCw } from "lucide-svelte";

  import type NodsPlugin from "../main";
  import { Platform, Notice, normalizePath, TFile, TFolder } from "obsidian";

  import { pushMessage, type Session, createSession, type Message, type ComposerPlacement } from "../types";
  import { saveSessionToTempFile, loadSessionFromTempFile } from "../io/temp";
  import { exportMarkdown } from "../io/export";
  import { backupSessionMarkdown } from "../io/backup";
  import { TempWatcher } from "../io/watch";
  import { LoadFileModal } from "../modals/LoadFileModal";

  export let plugin: NodsPlugin;
  export let initialSession: Session;
  export let initialTempFile: TFile;
  export let api: any = {};
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

  async function ensureExportFolderExists(opts?: { showNotice?: boolean }): Promise<boolean> {
    const base = (plugin.settings as any).exportFolder?.trim() || ".nods/logs";
    const parts = normalizePath(base.replace(/^\/+/, "")).split("/").filter(Boolean);
    let cur = "";
    try {
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        const af = plugin.app.vault.getAbstractFileByPath(cur);
        if (af) {
          if (af instanceof TFolder) continue;
          throw new Error(`Path exists but is not a folder: ${cur}`);
        }
        try {
          await plugin.app.vault.createFolder(cur);
        } catch (e) {
          const msg = String(e);
          if (!msg.includes("Folder already exists")) throw e;
        }
      }
      return true;
    } catch (e) {
      if (opts?.showNotice) new Notice("保存先フォルダを作成できませんでした。");
      return false;
    }
  }

  // ★「作成のみ」して、created を返す
  async function ensureTempFile(): Promise<{ file: TFile; created: boolean } | null> {
    let folder = resolveExportFolder();
    if (!folder) {
      const ok = await ensureExportFolderExists({ showNotice: true });
      if (!ok) return null;
      folder = resolveExportFolder();
    }
    if (!folder) return null;

    const path = normalizePath(`${folder.path}/${TEMP_NAME}`);
    const af = plugin.app.vault.getAbstractFileByPath(path);

    if (af instanceof TFile) {
      return { file: af, created: false };
    }

    try {
      const createdFile = await plugin.app.vault.create(path, "");
      return { file: createdFile, created: true };
    } catch (e) {
      const msg = String(e);
      if (msg.includes("already exists")) {
        const after = plugin.app.vault.getAbstractFileByPath(path);
        if (after instanceof TFile) return { file: after, created: false };
      }
      throw e;
    }
  }

  // ========== 「うん。」遅延 ==========
  function scheduleAckForLast() {
    const last = session.messages[session.messages.length - 1];
    if (!last) return;
    const id = last.id;
    const delay = 1000 + Math.floor(Math.random() * 2000);
    setTimeout(async () => {
      if (!ackShownIds.includes(id)) {
        ackShownIds = [...ackShownIds, id];
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

    await tick();

    let refreshed = false;
    if (typeof api?.refreshLog === "function") {
      try {
        await api.refreshLog();
        refreshed = true;
      } catch {}
    }

    // refreshLog が何もしなかった場合だけ、ここで読む
    if (!refreshed) {
      try {
        // tempFile が不正な可能性があるので、無ければ作る
        if (!tempFile) {
          const r = await ensureTempFile();
          if (!r) throw new Error("一時ログが作成できません。");
          tempFile = r.file;
          if (r.created) {
            await saveSessionToTempFile(plugin.app, tempFile, session);
          }
          attachWatcher();
        }

        const loaded = await loadSessionFromTempFile(plugin.app, tempFile);
        if (loaded) {
          session = { ...loaded, messages: [...loaded.messages] };
          ackShownIds = loaded.messages.map(m => m.id);
        }
      } catch (err) {
        new Notice("一時ログの読み込みに失敗: " + String(err));
      }
    }

    await tick();
    await scrollToBottom(false);
  }

  // ========== 送信 ==========
  async function onSubmit(text: string) {
    try {
      pushMessage(session, text);
      session = { ...session, messages: [...session.messages] };
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

    const idx = session.messages.findIndex((m) => m.id === id);
    if (idx === -1) return;

    session = {
      ...session,
      messages: session.messages.map((m) => (m.id === id ? { ...m, text } : m)),
      updatedAt: new Date().toISOString(),
    };

    persistTempSelfWrite()
      .then(() => {
        if (timelineEl) timelineEl.scrollTop = timelineEl.scrollHeight;
      })
      .catch(() => {});
  }

  async function scrollToBottom(smooth = true) {
    await tick();
    await tick();
    const el = timelineEl;
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  function doExport() { api.exportLog?.(); }
  function doLoad() { api.loadFile?.(); }
  function doClear() { api.clearLog?.(); }
  function doRefresh() { api.refreshLog?.(); }

  api.exportLog = async () => {
    try {
      if (!resolveExportFolder()) {
        const ok = await ensureExportFolderExists({ showNotice: true });
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
      const ok = await ensureExportFolderExists({ showNotice: true });
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
          const msgs: Message[] = splitMarkdownToMessages(txt);
          session = { ...session, messages: msgs, updatedAt: new Date().toISOString() };
          ackShownIds = msgs.map((m: Message) => m.id);
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
        const ok = await ensureExportFolderExists({ showNotice: true });
        if (ok) folder = resolveExportFolder();
      }
      if (!folder) throw new Error("出力先フォルダが見つかりません。");

      await backupSessionMarkdown(plugin.app, folder, session, (plugin.settings as any).backupGenerations);

      session = createSession(plugin.app.vault.getName(), (plugin as any).manifest?.version ?? "v1");
      ackShownIds = [];

      const r = await ensureTempFile();
      if (!r) throw new Error("一時ログが作成できません。");
      tempFile = r.file;

      // ★初回作成時のみ書き込む（更新で空にしない）
      if (r.created) {
        await saveSessionToTempFile(plugin.app, tempFile, session);
      } else {
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

  api.refreshLog = async () => {
    try {
      let tf = tempFile;
      if (!tf) {
        const r = await ensureTempFile();
        if (!r) { new Notice("一時ログが見つかりません。"); return; }
        tf = r.file;
        tempFile = tf;

        // ★初回のみ保存
        if (r.created) {
          await saveSessionToTempFile(plugin.app, tempFile, session);
        }
        attachWatcher();
      }

      const loaded = await loadSessionFromTempFile(plugin.app, tf);
      if (loaded) {
        session = { ...loaded, messages: [...loaded.messages] };
        ackShownIds = loaded.messages.map((m: Message) => m.id);
        new Notice("ログを更新しました。");
        await scrollToBottom(true);
      } else {
        // 初回空などは何もしない
      }
    } catch (e) {
      new Notice("ログの更新に失敗: " + String(e));
    } finally {
      menuOpen = false;
    }
  };

  let composerPlacementDesktop: ComposerPlacement = plugin.settings.composerPlacementDesktop;
  let composerPlacementMobile: ComposerPlacement = plugin.settings.composerPlacementMobile;

  $: placement = isMobile ? composerPlacementMobile : composerPlacementDesktop;

  export function onSettingsChanged() {
    composerPlacementDesktop = plugin.settings.composerPlacementDesktop;
    composerPlacementMobile = plugin.settings.composerPlacementMobile;
  }
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

    {#if placement === "top"}
      <Composer
        bind:this={composerRef}
        isMobile={isMobile}
        pcEnterSendDisabled={plugin.settings.pcEnterSendDisabled}
        mobileEnterSendEnabled={plugin.settings.mobileEnterSendEnabled}
        on:submit={(e) => onSubmit(e.detail)}
      />

      <div class="body">
        <Timeline
          messages={session.messages}
          bind:containerEl={timelineEl}
          on:edited={onTimelineEdited}
          {ackShownIds}
        />
      </div>
    {:else}
      <div class="body">
        <Timeline
          messages={session.messages}
          bind:containerEl={timelineEl}
          on:edited={onTimelineEdited}
          {ackShownIds}
        />
      </div>

      <Composer
        bind:this={composerRef}
        isMobile={isMobile}
        pcEnterSendDisabled={plugin.settings.pcEnterSendDisabled}
        mobileEnterSendEnabled={plugin.settings.mobileEnterSendEnabled}
        on:submit={(e) => onSubmit(e.detail)}
      />
    {/if}

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

  .body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
  }

  :global(.workspace-leaf-content[data-type="nods-view"] > .view-content) {
    padding: 0 0 max(var(--safe-area-inset-bottom, 0px), var(--size-4-8)) 0;
  }

  :global(body.is-mobile .workspace-leaf-content[data-type="nods-view"] > .view-content) {
    padding: 0 0 var(--safe-area-inset-bottom) 0;
  }
</style>
