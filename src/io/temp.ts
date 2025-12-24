import { App, TFile } from "obsidian";
import type { TempLogJson, Session } from "../types";

/**
 * .md 内の最初の fenced JSON（```json ... ```）を抽出してパース
 * 見つからなければ null を返す
 */
export function parseTempJsonFromMarkdown(md: string): TempLogJson | null {
    const re = /```json\s*([\s\S]*?)```/m;
    const m = re.exec(md);
    if (!m) return null;

    const raw = (m[1] ?? "").trim();
    if (!raw) return null;

    let obj: unknown;
    try {
        obj = JSON.parse(raw);
    } catch {
        return null;
    }

    const t = obj as any;
    if (t && t.schema === 1 && t.session) {
        return t as TempLogJson;
    }
    return null;
}

/** TempLogJson から .md を生成（コメント + fenced JSON のみ） */
export function buildTempMarkdown(json: TempLogJson): string {
    const payload = JSON.stringify(json, null, 2);
    return [
        "<!-- Nods temp log: do not edit manually -->",
        "```json",
        payload,
        "```",
        "",
    ].join("\n");
}

/**
 * temp ファイルから Session を読み出し
 * - 初回起動などで空 or fenced JSON がない場合は null
 * - JSON 破損も null 扱い（初回で落とさない）
 */
export async function loadSessionFromTempFile(app: App, file: TFile): Promise<Session | null> {
    const md = await app.vault.read(file);
    if (!md.trim()) return null;

    const parsed = parseTempJsonFromMarkdown(md);
    if (!parsed) return null;

    return parsed.session;
}

/**
 * Session を temp .md に保存
 * （ここは殺さない）
 */
export async function saveSessionToTempFile(app: App, file: TFile, session: Session): Promise<void> {
    const json: TempLogJson = { schema: 1, session };
    const md = buildTempMarkdown(json);
    await app.vault.modify(file, md);
}
