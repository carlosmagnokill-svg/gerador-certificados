import { CertificateRenderer } from "./certificado.js";
import { AccessGate } from "./acesso.js";

const elements = {
  event: document.querySelector("#evento"),
  name: document.querySelector("#nome"),
  canvas: document.querySelector("#certificadoCanvas"),
  download: document.querySelector("#baixarPng"),
  print: document.querySelector("#salvarPdf"),
  message: document.querySelector("#mensagem"),
  loading: document.querySelector("#certificateLoading"),
};

const renderer = new CertificateRenderer(elements.canvas);
let events = [];
let currentEvent = null;

const accessGate = new AccessGate({
  form: document.querySelector("#accessForm"),
  input: document.querySelector("#accessValue"),
  submit: document.querySelector("#accessSubmit"),
  attempts: document.querySelector("#attemptCounter"),
  message: document.querySelector("#accessMessage")
});

accessGate.onAuthorized = participant => authorizeParticipant(participant);
accessGate.init().catch(error => {
  const message = document.querySelector("#accessMessage");
  message.textContent = error.message;
  message.className = "access-message is-visible is-warning";
});

async function authorizeParticipant(participant) {
  document.querySelector("#accessGate").hidden = true;
  document.querySelector("#appContent").hidden = false;
  document.querySelector("#participantLabel").textContent = `Participante: ${participant.nome}`;
  elements.name.value = participant.nome;

  try {
    await init();
    updatePreview();
  } catch (error) {
    showMessage(error.message, "warning");
  }
}

async function init() {
  if (document.fonts?.load) {
    await document.fonts.load('600 40px "Libre Baskerville"');
  }

  const response = await fetch("data/eventos.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível carregar a configuração dos eventos.");

  const data = await response.json();
  events = data.eventos || [];

  elements.event.innerHTML = events.map(event => {
    const suffix = event.disponivel ? "" : " — em breve";
    return `<option value="${event.id}" ${event.disponivel ? "" : "disabled"}>${event.titulo}${suffix}</option>`;
  }).join("");

  elements.event.addEventListener("change", loadSelectedEvent);
  elements.name.addEventListener("input", updatePreview);
  elements.download.addEventListener("click", downloadPng);
  elements.print.addEventListener("click", printPdf);

  await loadSelectedEvent();
}

async function loadSelectedEvent() {
  currentEvent = events.find(event => event.id === elements.event.value);
  setCertificateLoading(true);

  try {
    if (!currentEvent?.disponivel) {
      setButtonsDisabled(true);
      showMessage("A arte deste evento ainda não está disponível.", "warning");
      return;
    }

    await renderer.load(currentEvent);
    updatePreview();
    setButtonsDisabled(false);
    showMessage("Arte carregada. Revise ou ajuste o nome antes de salvar.", "success");
  } catch (error) {
    setButtonsDisabled(true);
    showMessage(error.message || "Não foi possível carregar o modelo do certificado.", "warning");
  } finally {
    setCertificateLoading(false);
  }
}

function updatePreview() {
  renderer.draw(elements.name.value);
}

async function downloadPng() {
  try {
    setButtonsDisabled(true);
    const blob = await renderer.exportPng(elements.name.value);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(currentEvent.titulo)}-${slugify(elements.name.value)}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showMessage("Certificado gerado em alta resolução.", "success");
  } catch (error) {
    showMessage(error.message, "warning");
  } finally {
    setButtonsDisabled(false);
  }
}

async function printPdf() {
  try {
    setButtonsDisabled(true);

    if (!window.jspdf?.jsPDF) {
      throw new Error("A biblioteca de PDF não foi carregada. Verifique a conexão com a internet.");
    }

    const blob = await renderer.exportPng(elements.name.value);
    const dataUrl = await blobToDataUrl(blob);
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [300.4, 200.3],
      compress: true
    });

    pdf.addImage(dataUrl, "PNG", 0, 0, 300.4, 200.3, undefined, "FAST");
    pdf.save(`${slugify(currentEvent.titulo)}-${slugify(elements.name.value)}.pdf`);

    showMessage("PDF gerado e baixado diretamente no dispositivo.", "success");
  } catch (error) {
    showMessage(error.message, "warning");
  } finally {
    setButtonsDisabled(false);
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível preparar o arquivo PDF."));
    reader.readAsDataURL(blob);
  });
}

function setCertificateLoading(loading) {
  if (!elements.loading) return;
  elements.loading.classList.toggle("is-hidden", !loading);
}

function setButtonsDisabled(disabled) {
  elements.download.disabled = disabled;
  elements.print.disabled = disabled;
}

function showMessage(text, type) {
  elements.message.textContent = text;
  elements.message.className = `message is-visible is-${type}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
