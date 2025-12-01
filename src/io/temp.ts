import { App, TFile } from "obsidian";
import type { TempLogJson, Session } from "../types";

/**
 * .md 内の最初の fenced JSON（```json ... ```）を抽出してパース
 * 見つからなければ null を返す
 */
export function parseTempJsonFromMarkdown(md: string): TempLogJson | null {
    // ```json ... ``` を最初の1つだけ対象
    const re = /```json\s*([\s\S]*?)```/m;
    const m = re.exec(md);
    if (!m) return null;
    try {
        const obj = JSON.parse(m[1].trim());
        // 最低限の形だけ確認
        if (obj && obj.session && obj.schema === 1) {
            return obj as TempLogJson;
        }
    } catch (_) {
        // 破損時は null
    }
    return null;
}

/** TempLogJson から .md を生成（コメント + fenced JSON のみのシンプル構造） */
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

/** temp ファイルから Session を読み出し（破損時は例外を投げる） */
export async function loadSessionFromTempFile(app: App, file: TFile): Promise<Session> {
    const md = await app.vault.read(file);
    const parsed = parseTempJsonFromMarkdown(md);
    if (!parsed) {
        throw new Error("一時ログの形式が不正です（fenced JSON が見つからない／JSON 破損）。");
    }
    return parsed.session;
}

/**
 * Session を temp .md に保存
 * - 既存ファイルがあれば置換（最初の fenced JSON のみを使うため、丸ごと書き換えで簡潔に実装）
 */
export async function saveSessionToTempFile(app: App, file: TFile, session: Session): Promise<void> {
    const json: TempLogJson = { schema: 1, session };
    const md = buildTempMarkdown(json);
    await app.vault.modify(file, md);
}
