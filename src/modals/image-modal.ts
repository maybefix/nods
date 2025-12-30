import { Modal, App } from "obsidian";

export class NodsImageModal extends Modal {
  private url: string;

  constructor(app: App, url: string) {
    super(app);
    this.url = url;
  }

  onOpen() {
    const { contentEl, modalEl } = this;

    modalEl.addClass("nods-image-modal-container");
    contentEl.empty();
    contentEl.addClass("nods-image-modal");

    const img = contentEl.createEl("img", {
      attr: {
        src: this.url,
        alt: "",
      },
    });

    img.addClass("nods-image-modal-img");
  }

  onClose() {
    this.contentEl.empty();
  }
}