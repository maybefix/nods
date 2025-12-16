export interface NodsSettings {
    /** エクスポート（純Markdown）の保存先。Vault からの相対パスを推奨 */
    exportFolder: string;                 // 既定: ".nods/logs"

    /** PC: Enter=送信 を無効化（ON で Enter は改行のみ。送信はボタン or Ctrl/Cmd+Enter） */
    pcEnterSendDisabled: boolean;         // 既定: false

    /** モバイル: Enter=送信 を有効化（既定 OFF。ON で Enter 送信にする） */
    mobileEnterSendEnabled: boolean;      // 既定: false

    /** クリア時のバックアップ世代数（0 で無効） */
    backupGenerations: number;            // 既定: 1

    composerPlacementDesktop: "top" | "bottom";
    composerPlacementMobile: "top" | "bottom";
}

export const DEFAULT_SETTINGS: NodsSettings = {
    exportFolder: ".nods/logs",
    pcEnterSendDisabled: false,
    mobileEnterSendEnabled: false,
    backupGenerations: 1,
    composerPlacementDesktop: "top",
    composerPlacementMobile: "bottom",
};

