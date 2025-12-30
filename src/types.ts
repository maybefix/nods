// 共通型とユーティリティ

export type ComposerPlacement = "top" | "bottom";
export type InputMode = "composer" | "modal";

export interface MessageAttachment {
    id: string;
    type: "image";
    url: string;
}
export interface Message {
    id: string;          // uuid
    ts: string;          // ISO 8601
    text: string;        // ユーザー入力本文
    reply: "うん。";      // 常に固定
    attachments?: MessageAttachment[];
}

export interface Session {
    sessionId: string;
    createdAt: string;   // ISO 8601
    updatedAt: string;   // ISO 8601
    messages: Message[];
    meta: {
        vault: string;
        appVersion: string;
    };
}

export interface TempLogJson {
    schema: 1;
    session: Session;
}

/** uuid 生成（crypto.randomUUID が無い環境へのフォールバック含む） */
export function uuid(): string {
    const g: any = globalThis as any;
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
    // 簡易フォールバック
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** ISO 文字列（ミリ秒無し） */
export function isoNow(): string {
    return new Date().toISOString();
}

/** 空のセッションを作成 */
export function createSession(vault: string, appVersion: string): Session {
    const now = isoNow();
    return {
        sessionId: uuid(),
        createdAt: now,
        updatedAt: now,
        messages: [],
        meta: { vault, appVersion },
    };
}

const IMAGE_MD_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;

/** ![](url) から URL を抜き出す */
export function extractImageUrls(text: string): string[] {
    const urls: string[] = [];
    if (!text) return urls;

    let m: RegExpExecArray | null;
    IMAGE_MD_RE.lastIndex = 0;
    while ((m = IMAGE_MD_RE.exec(text)) !== null) {
        const url = m[1];
        if (url) urls.push(url);
    }
    return urls;
}

/** 表示用に ![](url) を消したテキストを返す */
export function stripImageMarkdown(text: string): string {
    if (!text) return "";
    IMAGE_MD_RE.lastIndex = 0;
    const without = text.replace(IMAGE_MD_RE, "");
    // 空行が増えすぎるのを少しだけ詰める
    return without.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "");
}

/** URL 配列から添付オブジェクトを作る */
export function buildImageAttachments(urls: string[]): MessageAttachment[] {
    return urls.map((url) => ({
        id: uuid(),
        type: "image" as const,
        url,
    }));
}


/** メッセージを追加して updatedAt を更新 */
export function pushMessage(session: Session, text: string): Session {
    const urls = extractImageUrls(text);
    const attachments = buildImageAttachments(urls);

    const msg: Message = {
        id: uuid(),
        ts: isoNow(),
        text,
        reply: "うん。",
    };
    if (attachments.length > 0) {
        msg.attachments = attachments;
    }

    session.messages.push(msg);
    session.updatedAt = msg.ts;
    return session;
}


