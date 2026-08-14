const STORAGE_KEY = "certificados-access-lock-v3";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 3 * 60 * 1000;
const ACCESS_ENDPOINT = "https://script.google.com/macros/s/AKfycbylofB3BfRtZqus9ctbR6Yg-n0A8AzvkMfGiFgQl7rUq3ydJ6pz2YhMDMsuDlfr1iOO7A/exec";

export class AccessGate {
  constructor(elements) {
    this.elements = elements;
    this.state = this.#readState();
    this.timer = null;
  }

  async init() {
    this.elements.input.addEventListener("input", () => {
      this.elements.input.value = this.elements.input.value.replace(/\D+/g, "");
      this.#clearMessage();
    });

    this.elements.form.querySelectorAll('input[name="tipoAcesso"]').forEach(input => {
      input.addEventListener("change", () => {
        this.elements.input.value = "";
        this.elements.input.maxLength = 11;
        this.elements.input.placeholder =
          input.value === "cpf"
            ? "Digite o CPF, somente números"
            : "Digite o telefone, somente números";
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

  async validate() {
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

    this.elements.submit.disabled = true;
    this.#showMessage("Validando acesso...", "success");

    try {
      const response = await fetch(ACCESS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8"
        },
        body: JSON.stringify({
          acao: "VALIDAR_ACESSO",
          tipoAcesso: type.toUpperCase(),
          identificador: value
        })
      });

      if (!response.ok) {
        throw new Error("Falha ao validar o acesso.");
      }

      const result = await response.json();

      if (result?.ok && result?.autorizado) {
        const participant = {
          nome: String(result.nome || "").trim()
        };

        const accessInfo = {
          tipoAcesso: type.toUpperCase(),
          identificador: value
        };

        this.#clearState();
        this.#showMessage("Acesso autorizado.", "success");
        this.onAuthorized?.(participant, accessInfo);
        return;
      }

      this.#registerInvalidAttempt(type);

    } catch (error) {
      console.error(error);
      this.#showMessage(
        "Não foi possível validar o acesso agora. Tente novamente.",
        "warning"
      );
    } finally {
      if (!this.#isLocked()) {
        this.elements.submit.disabled = false;
      }
    }
  }

  #registerInvalidAttempt(type) {
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
    } catch (_) {}

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
