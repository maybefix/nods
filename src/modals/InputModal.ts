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

    const wrap = contentEl.createDiv("nods-input-wrap");

    const ta = wrap.createEl("textarea", {
      cls: "nods-input-textarea",
      attr: { placeholder: "話しかけてください。" },
    });

    ta.value = this.value;
    ta.addEventListener("input", (e) => {
      this.value = (e.target as HTMLTextAreaElement).value;
    });

    const buttons = wrap.createDiv("nods-input-buttons");

    const sendBtn = buttons.createEl("button", {
      cls: "nods-input-send",
      attr: { "aria-label": "送信" },
    });

    sendBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send-horizontal-icon lucide-send-horizontal"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg>
    `;

    sendBtn.addEventListener("click", () => {
      const v = this.value.trim();
      if (!v) {
        this.close();
        return;
      }
      this.onSubmit(v);
      this.close();
    });

    window.setTimeout(() => ta.focus(), 0);
  }

  onClose() {
    this.contentEl.empty();
  }
}
