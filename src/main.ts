import {
  App,
  ItemView,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
  normalizePath,
} from "obsidian";
import NodsView from "./ui/NodsView.svelte";

// ★ types はここから扱う（io/temp には無い前提）
import { createSession, type Session, type ComposerPlacement } from "./types";

// io/temp は「ファイルI/O」専用として利用
import { loadSessionFromTempFile } from "./io/temp";

export const VIEW_TYPE_NODS = "nods-view";
export const RIBBON_ICON = "message-square";

export interface NodsSettings {
  exportFolder: string;       // 例: .nods/logs
  backupGenerations: number;  // 将来用（未使用でもOK）
  pcEnterSendDisabled: boolean;
  mobileEnterSendEnabled: boolean;
  composerPlacementDesktop: ComposerPlacement;
  composerPlacementMobile: ComposerPlacement;
}

const DEFAULT_SETTINGS: NodsSettings = {
  exportFolder: ".nods/logs",
  backupGenerations: 5,
  pcEnterSendDisabled: false,
  mobileEnterSendEnabled: false,
  composerPlacementDesktop: "top",
  composerPlacementMobile: "bottom",
};

export default class NodsPlugin extends Plugin {
  settings!: NodsSettings;

  refreshAllViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NODS);

    leaves.forEach((leaf) => {
      const view: any = leaf.view;
      if (typeof view?.onSettingsChanged === "function") {
        view.onSettingsChanged();
      }
    });
}

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_NODS, (leaf) => new NodsItemView(leaf, this));
    this.addRibbonIcon(RIBBON_ICON, "Open Nods", () => this.activateView());

    this.addCommand({
      id: "open-nods",
      name: "Open Nods",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "focus-nods-input",
      name: "Focus Nods input",
      callback: async () => {
        // ビューを開く（なければ作成）
        await this.activateView();
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_NODS)[0];
        const view = leaf?.view as any;
        if (view?.focusComposer) {
          view.focusComposer();
        } else {
          // 構築直後でまだ Svelte が繋がってないケースへの保険
          setTimeout(() => (leaf?.view as any)?.focusComposer?.(), 0);
        }
      },
    });

    if (this.app.workspace.layoutReady) {
      await this.activateView();
    } else {
      this.app.workspace.onLayoutReady(async () => await this.activateView());
    }

    this.addSettingTab(new NodsSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    // 特になし（Svelte 側で $destroy）
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** 右ペインに Nods を表示（なければ作成） */
  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_NODS);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    let leaf =
      this.app.workspace.getRightLeaf(false) ??
      this.app.workspace.getLeaf(true);

    if (!leaf) return;

    await leaf.setViewState({ type: VIEW_TYPE_NODS, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}

/** View 実装 */
class NodsItemView extends ItemView {
  plugin: NodsPlugin;
  comp: NodsView | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: NodsPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_NODS; }
  getDisplayText(): string { return "Nods"; }
  getIcon(): string { return RIBBON_ICON; }
  focusComposer() {
    try {
      this.comp?.focusComposer?.();
    } catch {}
  }
  onSettingsChanged() {
    // Svelte 側に通知
    this.comp?.onSettingsChanged?.();
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();

    // ★ 起動時に「nods-temp.md を読む／なければ作る」
    const initial = await ensureTempFromMain(
    this.app,
    this.plugin.manifest.version,
    this.plugin.settings
    );

    this.comp = new NodsView({
      target: container,
      props: {
        plugin: this.plugin,
        initialSession: initial.session,   // ← 必ず Session
        initialTempFile: initial.tempFile, // ← 必ず TFile
      },
    });
  }

  async onClose(): Promise<void> {
    try { (this.comp as any)?.$destroy?.(); } catch {}
    this.comp = null;
  }
  
}

/** main.ts 側で使う：nods-temp.md を「読む or 作る」 */
async function ensureTempFromMain(
  app: App,
  manifestVersion: string,
  settings: NodsSettings
): Promise<{ session: Session; tempFile: TFile }> {
  const folderPath = normalizePath(settings.exportFolder || ".nods/logs");
  let folder = app.vault.getAbstractFileByPath(folderPath);

  if (!folder) {
    await ensureFolders(app, folderPath);
    folder = app.vault.getAbstractFileByPath(folderPath);
  }
  if (!(folder instanceof TFolder)) {
    throw new Error("Export folder is not a folder: " + folderPath);
  }

  const tempPath = normalizePath(`${folder.path}/nods-temp.md`);
  const existing = app.vault.getAbstractFileByPath(tempPath);

  if (existing instanceof TFile) {
    const sess = await loadSessionFromTempFile(app, existing);
    return { session: sess, tempFile: existing };
  } else {
    const sess = createSession(app.vault.getName(), manifestVersion); // ← io/temp に依存せず自前で空を作る
    const tf = await app.vault.create(tempPath, "");
    return { session: sess, tempFile: tf };
  }
}

/** a/b/c のような階層フォルダも作成する */
async function ensureFolders(app: App, path: string): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    const af = app.vault.getAbstractFileByPath(cur);
    if (!af) {
      await app.vault.createFolder(cur);
    }
  }
}

/** 設定タブ */
class NodsSettingTab extends PluginSettingTab {
  plugin: NodsPlugin;

  constructor(app: App, plugin: NodsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Export folder")
      .setDesc("一時ログと出力ログの保存先（例: .nods/logs）")
      .addText((txt) => {
        txt.setPlaceholder(".nods/logs")
          .setValue(this.plugin.settings.exportFolder)
          .onChange(async (v) => {
            this.plugin.settings.exportFolder = (v ?? "").trim() || ".nods/logs";
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
    .setName("PC: Enterで改行")
    .setDesc("ONでEnter=改行。OFFでEnter=送信(Shift+Enterは改行)。")
    .addToggle((tg) =>
      tg
        .setValue(this.plugin.settings.pcEnterSendDisabled) // ← 反転しない
        .onChange(async (v) => {
          this.plugin.settings.pcEnterSendDisabled = v;     // ← そのまま保存
          await this.plugin.saveSettings();
        })
    );

    new Setting(containerEl)
    .setName("モバイル: Enterで送信")
    .setDesc("ONでEnter=送信。OFFでEnter=改行。")
    .addToggle((tg) =>
      tg
        .setValue(this.plugin.settings.mobileEnterSendEnabled) // ここは元から反転なしでOK
        .onChange(async (v) => {
          this.plugin.settings.mobileEnterSendEnabled = v;
          await this.plugin.saveSettings();
        })
    );

    new Setting(containerEl)
      .setName("入力欄の位置（デスクトップ）")
      .setDesc("Nods の入力欄を上に置くか下に置くか。")
      .addDropdown((dd) => {
        dd.addOption("top", "上")
          .addOption("bottom", "下")
          .setValue(this.plugin.settings.composerPlacementDesktop)
          .onChange(async (v) => {
            this.plugin.settings.composerPlacementDesktop = v as any;
            await this.plugin.saveSettings();
            this.plugin.refreshAllViews(); // ★ 追加
          });
      });

    new Setting(containerEl)
      .setName("入力欄の位置（モバイル）")
      .setDesc("Nods の入力欄を上に置くか下に置くか。")
      .addDropdown((dd) => {
        dd.addOption("top", "上")
          .addOption("bottom", "下")
          .setValue(this.plugin.settings.composerPlacementMobile)
          .onChange(async (v) => {
            this.plugin.settings.composerPlacementMobile = v as any;
            await this.plugin.saveSettings();
            this.plugin.refreshAllViews(); // ★ 追加
          });
      });
  }
}
