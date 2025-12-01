// 共通型とユーティリティ

export interface Message {
    id: string;          // uuid
    ts: string;          // ISO 8601
    text: string;        // ユーザー入力本文
    reply: "うん。";      // 常に固定
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

/** メッセージを追加して updatedAt を更新 */
export function pushMessage(session: Session, text: string): Session {
    const msg: Message = {
        id: uuid(),
        ts: isoNow(),
        text,
        reply: "うん。", // ここで確定
    };
    session.messages.push(msg);
    session.updatedAt = msg.ts;
    return session;
}

