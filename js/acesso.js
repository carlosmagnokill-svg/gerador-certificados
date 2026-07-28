const STORAGE_KEY = "certificados-access-lock-v2";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 3 * 60 * 1000;
const SPREADSHEET_URL = "data/Nomes-comadres-2026.xlsx";

export class AccessGate {
  constructor(elements) {
    this.elements = elements;
    this.participants = [];
    this.state = this.#readState();
    this.timer = null;
  }

  async init() {
    await this.#loadSpreadsheet();

    this.elements.input.addEventListener("input", () => {
      this.elements.input.value = this.elements.input.value.replace(/\D+/g, "");
      this.#clearMessage();
    });

    this.elements.form.querySelectorAll('input[name="tipoAcesso"]').forEach(input => {
      input.addEventListener("change", () => {
        this.elements.input.value = "";
        this.elements.input.maxLength = input.value === "cpf" ? 11 : 11;
        this.elements.input.placeholder =
          input.value === "cpf" ? "Digite o CPF, somente números" : "Digite o telefone, somente números";
        this.#clearMessage();
        this.elements.input.focus();
      });
    });

    this.elements.form.addEventListener("submit", event => {
      event.preventDefault();
      this.validate();
    });

    this.#refreshLockState();
  }

  async #loadSpreadsheet() {
    if (!window.XLSX) {
      throw new Error("A biblioteca de leitura da planilha não foi carregada.");
    }

    const response = await fetch(`${SPREADSHEET_URL}?v=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Não foi possível carregar ${SPREADSHEET_URL}.`);
    }

    const buffer = await response.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error("A planilha não possui nenhuma aba.");
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false
    });

    if (!rows.length) {
      throw new Error("A planilha de participantes está vazia.");
    }

    const headers = rows[0].map(value =>
      String(value || "").trim().toUpperCase()
    );

    const nameIndex = headers.indexOf("NOME");
    const phoneIndex = headers.indexOf("TELEFONE");
    const cpfIndex = headers.indexOf("CPF");

    if (nameIndex < 0 || phoneIndex < 0 || cpfIndex < 0) {
      throw new Error("A planilha precisa conter as colunas NOME, TELEFONE e CPF.");
    }

    this.participants = rows
      .slice(1)
      .map(row => ({
        nome: String(row[nameIndex] || "").trim(),
        telefone: this.#digits(row[phoneIndex]),
        cpf: this.#digits(row[cpfIndex])
      }))
      .filter(item => item.nome && (item.telefone || item.cpf));

    if (!this.participants.length) {
      throw new Error("Nenhum participante válido foi encontrado na planilha.");
    }
  }

  validate() {
    this.#refreshLockState();
    if (this.#isLocked()) return;

    const type = this.#selectedType();
    const value = this.#digits(this.elements.input.value);

    if (!value) {
      this.#showMessage(
        `Informe o ${type === "cpf" ? "CPF" : "telefone"} usando apenas números.`,
        "warning"
      );
      return;
    }

    const participant = this.participants.find(item => item[type] === value);

    if (participant) {
      this.#clearState();
      this.#showMessage("Acesso autorizado.", "success");
      this.onAuthorized?.(participant);
      return;
    }

    this.state.attemptsRemaining -= 1;

    if (this.state.attemptsRemaining <= 0) {
      this.state.lockedUntil = Date.now() + LOCK_MS;
      this.state.attemptsRemaining = 0;
      this.#saveState();
      this.#refreshLockState();
      return;
    }

    this.#saveState();
    const label = type === "cpf" ? "CPF" : "TELEFONE";
    this.#showMessage(
      `${label} inválido. ${this.state.attemptsRemaining} tentativa(s) restante(s).`,
      "warning"
    );
    this.#renderAttempts();
  }

  #selectedType() {
    return this.elements.form.querySelector(
      'input[name="tipoAcesso"]:checked'
    )?.value || "telefone";
  }

  #digits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  #readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (
        saved &&
        Number.isFinite(saved.attemptsRemaining) &&
        Number.isFinite(saved.lockedUntil)
      ) {
        if (saved.lockedUntil && Date.now() >= saved.lockedUntil) {
          return { attemptsRemaining: MAX_ATTEMPTS, lockedUntil: 0 };
        }
        return saved;
      }
    } catch (_) {
      // Um estado inválido é simplesmente reiniciado.
    }

    return { attemptsRemaining: MAX_ATTEMPTS, lockedUntil: 0 };
  }

  #saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  #clearState() {
    this.state = { attemptsRemaining: MAX_ATTEMPTS, lockedUntil: 0 };
    localStorage.removeItem(STORAGE_KEY);

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  #isLocked() {
    return this.state.lockedUntil > Date.now();
  }

  #refreshLockState() {
    if (!this.#isLocked()) {
      if (this.state.lockedUntil) {
        this.state = { attemptsRemaining: MAX_ATTEMPTS, lockedUntil: 0 };
        this.#saveState();
      }

      this.elements.input.disabled = false;
      this.elements.submit.disabled = false;
      this.elements.form
        .querySelectorAll('input[name="tipoAcesso"]')
        .forEach(input => {
          input.disabled = false;
        });

      this.#renderAttempts();
      return;
    }

    this.elements.input.disabled = true;
    this.elements.submit.disabled = true;
    this.elements.form
      .querySelectorAll('input[name="tipoAcesso"]')
      .forEach(input => {
        input.disabled = true;
      });

    const update = () => {
      const remaining = Math.max(0, this.state.lockedUntil - Date.now());

      if (remaining <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        this.state = { attemptsRemaining: MAX_ATTEMPTS, lockedUntil: 0 };
        this.#saveState();
        this.#clearMessage();
        this.#refreshLockState();
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.ceil((remaining % 60000) / 1000);

      this.#showMessage(
        `Limite de tentativas atingido. Tente novamente em ${minutes}:${String(seconds).padStart(2, "0")}.`,
        "warning"
      );

      this.elements.attempts.textContent = "Tentativas restantes: 0";
    };

    update();

    if (!this.timer) {
      this.timer = setInterval(update, 1000);
    }
  }

  #renderAttempts() {
    this.elements.attempts.textContent =
      `Tentativas restantes: ${this.state.attemptsRemaining}`;
  }

  #showMessage(text, type) {
    this.elements.message.textContent = text;
    this.elements.message.className =
      `access-message is-visible is-${type}`;
  }

  #clearMessage() {
    this.elements.message.textContent = "";
    this.elements.message.className = "access-message";
  }
}
