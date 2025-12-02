import { App, Modal, TFile, TFolder } from "obsidian";

export interface LoadFileModalOpts {
    app: App;
    folder: TFolder;
    onPick: (file: TFile) => void;
}

export class LoadFileModal extends Modal {
    private opts: LoadFileModalOpts;
    private files: TFile[] = [];

    constructor(opts: LoadFileModalOpts) {
        super(opts.app);
        this.opts = opts;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText("ファイルを読み込む…");

        const prefix = this.opts.folder.path.endsWith("/") ? this.opts.folder.path : this.opts.folder.path + "/";
        this.files = this.opts.app.vault.getFiles()
            .filter((f) => f.path.startsWith(prefix) && f.extension === "md")
            // 一時ログは非表示（nods-temp.md / nods-temp-*.md）
            .filter((f) => !/(?:^|\/)nods-temp(?:-|\.md$)/.test(f.path))
            .sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0));

        const list = contentEl.createEl("div", { cls: "nods-load-list" });

        if (this.files.length === 0) {
            list.createEl("div", { text: "対象ファイルがありません。", cls: "nods-empty" });
            return;
        }

        for (const f of this.files) {
            const item = list.createEl("div", { cls: "nods-load-item" });
            const btn = item.createEl("button", { cls: "nods-load-button", text: f.name });
            btn.addEventListener("click", () => { this.opts.onPick(f); this.close(); });
        }
    }

    onClose() { this.contentEl.empty(); }
}
