export interface SendEnv {
    isMobile: boolean;
    pcEnterSendDisabled: boolean;
    mobileEnterSendEnabled: boolean;
    isComposing: boolean;
}

export function shouldSend(e: KeyboardEvent, env: SendEnv): boolean {
  if (e.defaultPrevented || e.key !== "Enter") return false;
  if (env.isComposing || (e as any).isComposing) return false;
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return false;

  if (env.isMobile) {
    // モバイル：設定で許可されている場合のみ送信
    // （多くのIMEでShift+Enterは来ないが、来ても改行扱いにしたいので送信しない）
    return false;
  } else {
    // --- PC の挙動 ---
    if (env.pcEnterSendDisabled) {
      // 「Enter=改行」設定のとき → Shift+Enter で送信
      return e.shiftKey;
    } else {
      // 既定（Enter=送信、Shift+Enter=改行）
      return !e.shiftKey;
    }
  }
}
