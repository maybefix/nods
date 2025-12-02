import { App, TFile, type EventRef } from "obsidian";

/**
 * temp ファイルの変更監視。
 * - 自己書込は 1 回だけ無視（isSelfWrite）。
 * - 変更イベントの連発は trailing throttle で最後の 1 回だけ処理。
 */
export class TempWatcher {
    private isSelfWrite = false;
    private scheduled = false;
    private lastRun = 0;
    private ref: EventRef | null = null;

    constructor(
        private app: App,
        private tempPath: string,
        private onReload: () => void,
        private delay = 600
    ) {}

    /** 自己書込フラグを立てる（保存直前に呼ぶ） */
    markSelfWrite() {
        this.isSelfWrite = true;
    }

    /** 監視開始（重複登録を避ける） */
    register(): void {
        if (this.ref) return;
        this.ref = this.app.vault.on("modify", (f) => {
            
            if (!(f instanceof TFile)) return;
            if (f.path !== this.tempPath) return;

            // 自己書込は 1 回だけ素通しして終了
            if (this.isSelfWrite) {
                this.isSelfWrite = false;
                return;
            }

            // trailing throttle
            if (this.scheduled) return;
            this.scheduled = true;
            const now = Date.now();
            const wait = Math.max(0, this.delay - (now - this.lastRun));
            window.setTimeout(() => {
                this.scheduled = false;
                this.lastRun = Date.now();
                this.onReload();
            }, wait);
        });
    }

    /** 監視停止 */
    unregister(): void {
        if (this.ref) {
            this.app.vault.offref(this.ref);
            this.ref = null;
        }
    }

    /** 監視対象パスを切り替え（ファイル差し替え時に使用） */
    setTempPath(nextPath: string) {
        this.tempPath = nextPath;
    }
}
