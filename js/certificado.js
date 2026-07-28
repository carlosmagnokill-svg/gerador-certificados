export class CertificateRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.config = null;
    this.image = null;
  }

  async load(config) {
    this.config = config;
    this.canvas.width = config.larguraOriginal;
    this.canvas.height = config.alturaOriginal;
    this.image = await this.#loadImage(config.imagem);
    this.draw("");
  }

  draw(name = "") {
    if (!this.config || !this.image) return;

    const { larguraOriginal, alturaOriginal, campoNome } = this.config;
    this.ctx.clearRect(0, 0, larguraOriginal, alturaOriginal);
    this.ctx.drawImage(this.image, 0, 0, larguraOriginal, alturaOriginal);

    const cleanName = this.#normalizeName(name);
    if (!cleanName) return;

    const fontPx = this.#fitFont(
      this.ctx,
      cleanName,
      campoNome.larguraMaxima,
      this.#ptToPx(campoNome.tamanhoPt),
      this.#ptToPx(campoNome.tamanhoMinimoPt),
      campoNome
    );

    this.ctx.save();
    this.ctx.fillStyle = campoNome.cor;
    this.ctx.textAlign = campoNome.alinhamento;
    this.ctx.textBaseline = "middle";
    this.ctx.font = `${campoNome.peso} ${fontPx}px ${campoNome.fonte}`;
    this.ctx.fillText(cleanName, campoNome.x, campoNome.y);
    this.ctx.restore();
  }

  async exportPng(name) {
    this.#validateName(name);

    const cfg = this.config;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cfg.larguraExportacao;
    exportCanvas.height = cfg.alturaExportacao;

    const ctx = exportCanvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.image, 0, 0, exportCanvas.width, exportCanvas.height);

    const sx = exportCanvas.width / cfg.larguraOriginal;
    const sy = exportCanvas.height / cfg.alturaOriginal;
    const field = cfg.campoNome;
    const cleanName = this.#normalizeName(name);

    const maxWidth = field.larguraMaxima * sx;
    const startPx = this.#ptToPx(field.tamanhoPt) * sy;
    const minPx = this.#ptToPx(field.tamanhoMinimoPt) * sy;

    const fontPx = this.#fitFont(ctx, cleanName, maxWidth, startPx, minPx, field);

    ctx.save();
    ctx.fillStyle = field.cor;
    ctx.textAlign = field.alinhamento;
    ctx.textBaseline = "middle";
    ctx.font = `${field.peso} ${fontPx}px ${field.fonte}`;
    ctx.fillText(cleanName, field.x * sx, field.y * sy);
    ctx.restore();

    return new Promise((resolve, reject) => {
      exportCanvas.toBlob(blob => {
        if (!blob) return reject(new Error("Não foi possível gerar o PNG."));
        resolve(blob);
      }, "image/png");
    });
  }

  async getPrintableDataUrl(name) {
    const blob = await this.exportPng(name);
    return URL.createObjectURL(blob);
  }

  #ptToPx(pt) {
    return pt * 96 / 72;
  }

  #normalizeName(name) {
    return String(name || "").trim().replace(/\s+/g, " ");
  }

  #validateName(name) {
    const cleanName = this.#normalizeName(name);
    if (cleanName.length < 3) {
      throw new Error("Informe o nome completo do participante.");
    }
  }

  #fitFont(ctx, text, maxWidth, startPx, minPx, field) {
    let size = startPx;

    while (size > minPx) {
      ctx.font = `${field.peso} ${size}px ${field.fonte}`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 1;
    }

    return size;
  }

  #loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Não foi possível carregar a arte: ${src}`));
      image.src = src;
    });
  }
}
