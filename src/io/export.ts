import { App, TFolder, TFile, normalizePath } from "obsidian";
import type { Session } from "../types";

export async function exportMarkdown(app: App, folder: TFolder, session: Session): Promise<TFile> {
    const body = buildMarkdownBody(session);
    // 例: nods-20250920-103837.md（sessionIdは付けない）
    const fileName = `nods-${stamp(new Date())}.md`;
    const fullPath = normalizePath(`${folder.path}/${fileName}`);
    return await app.vault.create(fullPath, body);
}

export function buildMarkdownBody(session: Session): string {
    const parts = session.messages.map((m) => rtrim(m.text));
    const joined = parts.join("\n\n");
    return joined.endsWith("\n") ? joined : joined + "\n";
}

function rtrim(s: string): string { return s.replace(/[ \t]+$/gm, ""); }

function pad2(n: number) { return n.toString().padStart(2, "0"); }
function stamp(d: Date) {
    return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}
