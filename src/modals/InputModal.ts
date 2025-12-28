import { App, Modal } from "obsidian";

export class NodsInputModal extends Modal {
  private value = "";
  private onSubmit: (text: string) => void;

  constructor(app: App, onSubmit: (text: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("nods-input-modal");

    // 中身全体のラッパ
    const wrap = contentEl.createDiv("nods-input-wrap");

    // 入力欄
    const ta = wrap.createEl("textarea", {
      cls: "nods-input-textarea",
      attr: { placeholder: "話しかけてください。" },
    });

    ta.value = this.value;
    ta.addEventListener("input", (e) => {
      this.value = (e.target as HTMLTextAreaElement).value;
    });

    // ボタン行
    const buttons = wrap.createDiv("nods-input-buttons");

    const addBtn = buttons.createEl("button", {
      text: "追加",
    });
    addBtn.classList.add("nods-input-add");
    addBtn.addEventListener("click", () => {
      const v = this.value.trim();
      if (!v) {
        this.close();
        return;
      }
      this.onSubmit(v);
      this.close();
    });

    // フォーカス
    window.setTimeout(() => ta.focus(), 0);
  }

  onClose() {
    this.contentEl.empty();
  }
}