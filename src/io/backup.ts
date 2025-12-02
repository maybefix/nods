import { App, TFolder, TFile, normalizePath } from "obsidian";
import type { Session } from "../types";
import { buildMarkdownBody } from "./export";

/** 現セッションを .md としてバックアップし、古いものを削除（世代上限） */
export async function backupSessionMarkdown(app: App, folder: TFolder, session: Session, generations: number): Promise<TFile | null> {
    if (generations <= 0) return null;

    const body = buildMarkdownBody(session);
    const name = `nods-${stampYYYYMMDD_HHmmss(new Date())}.md`;
    const path = normalizePath(`${folder.path}/${name}`);
    const file = await app.vault.create(path, body);

    // ローテーション：nods-backup-*.md を古い順に削除して上限内に
    const backups = app.vault.getFiles()
        .filter((f) => f.path.startsWith(folder.path + "/") && /^nods-backup-.*\.md$/.test(f.name))
        .sort((a, b) => (a.stat.mtime ?? 0) - (b.stat.mtime ?? 0));

    while (backups.length > generations) {
        const old = backups.shift();
        if (old) await app.vault.delete(old).catch(() => {});
    }
    return file;
}

/* ---------- 小さな日時フォーマッタ ---------- */
function pad2(n: number) { return n.toString().padStart(2, "0"); }
function stampYYYYMMDD_HHmmss(d: Date) {
    const y = d.getFullYear();
    const M = pad2(d.getMonth() + 1);
    const D = pad2(d.getDate());
    const H = pad2(d.getHours());
    const m = pad2(d.getMinutes());
    const s = pad2(d.getSeconds());
    return `${y}${M}${D}-${H}${m}${s}`;
}
