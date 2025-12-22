import { App, TFile } from "obsidian";
import type { Session, TempLogJson } from "../types";

// これは既存のまま使う想定
export function buildTempMarkdown(json: TempLogJson): string {
    // 既存実装のまま
    return "";
}

// これは既存のまま残す
export async function saveSessionToTempFile(app: App, file: TFile, session: Session): Promise<void> {
    const json: TempLogJson = { schema: 1, session };
    const md = buildTempMarkdown(json);
    await app.vault.modify(file, md);
}

// fenced JSON を探す。無ければ null。壊れてたら throw。
export function parseTempJsonFromMarkdown(md: string): TempLogJson | null {
    const re = /```json\s*([\s\S]*?)```/m;
    const m = re.exec(md);
    if (!m) return null;

    const raw = m[1].trim();
    if (!raw) return null;

    let obj: unknown;
    try {
        obj = JSON.parse(raw);
    } catch {
        throw new Error("一時ログの JSON が破損しています。");
    }

    const t = obj as any;
    if (!t || t.schema !== 1 || !t.session) {
        throw new Error("一時ログの形式が不正です。");
    }
    return t as TempLogJson;
}

function isSession(x: any): x is Session {
    return !!x
        && typeof x.sessionId === "string"
        && typeof x.createdAt === "string"
        && typeof x.updatedAt === "string"
        && x.meta
        && typeof x.meta.vault === "string"
        && typeof x.meta.appVersion === "string"
        && Array.isArray(x.messages);
}

// 初回空や fenced JSON 無しは正常として「空セッション」を返す
export async function loadSessionFromTempFile(
    app: App,
    file: TFile,
    createSession: () => Session
): Promise<Session> {
    const md = await app.vault.read(file);
    if (!md.trim()) return createSession();

    const parsed = parseTempJsonFromMarkdown(md);
    if (!parsed) return createSession();

    if (!isSession(parsed.session)) {
        throw new Error("一時ログの session 形式が不正です。");
    }
    return parsed.session;
}
