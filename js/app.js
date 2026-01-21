// =========================
// CONFIG
// =========================
const GOOGLE_DOC_PUB_URL_BASE =
  "https://docs.google.com/document/d/e/2PACX-1vT99qWFGHbZKw7GFCxtdI5HR0dV4C7v8LmXNsGIfwFjvd2OqiG2gjC51yFalSwhrg/pub";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyPfAvgIGpQBDcO1Y75ZF2K43uR5lQ4ZtNK0Qmn4oi5kz70xf3X1RxDBXpEVV5pJg1e/exec";

const TEMPLATE_URL = `${APPS_SCRIPT_URL}?url=${encodeURIComponent(GOOGLE_DOC_PUB_URL_BASE)}`;

const USE_LOGO = true;
const LOGO_SRC = "./assets/logo.jpg";

// =========================
// AUTH / LOGOUT
// =========================
if (sessionStorage.getItem("auth") !== "ok") {
  window.location.href = "index.html";
}
document.getElementById("logout").addEventListener("click", () => {
  sessionStorage.removeItem("auth");
  window.location.href = "index.html";
});

// =========================
// MASKS
// =========================
function applyMasks() {
  const cpfEl = document.getElementById("cpf");
  if (cpfEl) IMask(cpfEl, { mask: "000.000.000-00" });

  const rgEl = document.getElementById("rg");
  if (rgEl) IMask(rgEl, { mask: "00.000.000-0" });

  const dataEl = document.getElementById("data_festa");
  if (dataEl) IMask(dataEl, { mask: "00/00/0000" });

  const hourMask = { mask: "00:00" };
  const hIni = document.getElementById("hora_inicio");
  const hFim = document.getElementById("hora_fim");
  if (hIni) IMask(hIni, hourMask);
  if (hFim) IMask(hFim, hourMask);

  const horasEl = document.getElementById("total_horas");
  if (horasEl) IMask(horasEl, { mask: Number, scale: 0, min: 0, max: 24 });

  const moneyOpts = {
    mask: "R$ num",
    blocks: {
      num: {
        mask: Number,
        thousandsSeparator: ".",
        radix: ",",
        scale: 2,
        padFractionalZeros: true,
        normalizeZeros: true,
        min: 0
      }
    }
  };
  const vp = document.getElementById("valor_pacote");
  const vt = document.getElementById("valor_total");
  if (vp) IMask(vp, moneyOpts);
  if (vt) IMask(vt, moneyOpts);
}
applyMasks();

// =========================
// UTILS
// =========================
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function getFormData() {
  const now = new Date();
  const dia = String(now.getDate()).padStart(2, "0");
  const mes = now.toLocaleString("pt-BR", { month: "long" });

  return {
    nome: getValue("nome"),
    rg: getValue("rg"),
    cpf: getValue("cpf"),
    endereco_completo: getValue("endereco"),
    pacote: getValue("pacote"),
    valor_pacote: getValue("valor_pacote"),
    tema: getValue("tema"),
    adicionais: getValue("adicionais"),
    data_festa: getValue("data_festa"),
    hora_inicio: getValue("hora_inicio"),
    hora_fim: getValue("hora_fim"),
    total_horas: getValue("total_horas"),
    valor_total_contrato: getValue("valor_total"),
    valor_total_contrato_extenso: getValue("valor_extenso"),
    proximos_vencimentos: getValue("vencimentos"),
    dia_assinatura: dia,
    mes_assinatura: mes,
  };
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyTemplate(html, data) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data[key];
    return v ? escapeHtml(String(v)) : "—";
  });
}

function extractBodyHtml(fullHtml) {
  const doc = new DOMParser().parseFromString(fullHtml, "text/html");
  doc.querySelectorAll("script, link").forEach(el => el.remove());
  return doc.body ? doc.body.innerHTML : fullHtml;
}

async function fetchTemplateHtml() {
  const res = await fetch(TEMPLATE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Não consegui baixar o modelo do contrato. HTTP ${res.status}`);
  const txt = await res.text();
  if (txt.includes("Não foi possível abrir o arquivo")) {
    throw new Error("Documento não acessível. Verifique se está PUBLICADO NA WEB.");
  }
  return txt;
}

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, link").forEach(el => el.remove());
  doc.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
  doc.querySelectorAll("p, div").forEach(el => el.append("\n"));
  let text = doc.body ? doc.body.textContent : "";
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function buildHeaderLogoHtml() {
  if (!USE_LOGO) return "";
  return `<div class="logo-wrap"><img src="${LOGO_SRC}" alt="Logo"></div>`;
}

function renderPrintableContract(text) {
  const safe = escapeHtml(text).replaceAll("\n", "<br/>");
  return `<div>${safe}</div>`;
}

function nextFrame() {
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function waitForImages(container) {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }));
}

// =========================
// PDF
// =========================
async function loadImageAsDataURL(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function cleanGoogleDocsFooter(text) {
  const lines = text.split("\n");
  const banned = [
    /Publicada usando o Google Docs/i,
    /Denunciar abuso/i,
    /Saiba mais/i,
    /Atualizado automaticamente/i,
    /CONTRATO_HD_2026_TEMPLATE/i
  ];

  const filtered = lines.filter(line => {
    const t = line.trim();
    if (!t) return true; // mantém linhas vazias (espaço)
    return !banned.some(rx => rx.test(t));
  });

  // remove excesso de linhas em branco no fim
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function gerarContratoPDF() {
  const data = getFormData();

  const rawHtml = await fetchTemplateHtml();
  const templateBody = extractBodyHtml(rawHtml);

  const filledHtml = applyTemplate(templateBody, data);
  let plainText = htmlToPlainText(filledHtml);
  plainText = cleanGoogleDocsFooter(plainText);

  // jsPDF (texto real)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Medidas A4 em mm
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Margens
  const marginX = 16;
  const marginTop = 18;
  const marginBottom = 18;

  // Logo
  let cursorY = marginTop;

  if (USE_LOGO) {
    try {
      const dataUrl = await loadImageAsDataURL(LOGO_SRC);

      // Dimensões da logo (mm)
      const maxW = 60;
      const maxH = 22;

      // addImage precisa do tipo: detecta pelo dataURL
      const imgType = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";

      // Tenta colocar com tamanho fixo (centralizado)
      const imgW = maxW;
      const imgH = maxH;
      const x = (pageW - imgW) / 2;

      doc.addImage(dataUrl, imgType, x, cursorY, imgW, imgH);
      cursorY += imgH + 8;
    } catch (e) {
      // Se falhar a logo, segue sem travar
      cursorY += 4;
    }
  }

  // Fonte e layout de texto
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  const lineHeight = 6; // mm
  const usableW = pageW - marginX * 2;
  const usableH = pageH - marginBottom;

  // Quebra o texto em linhas que cabem na largura
  const paragraphs = plainText.split("\n");
  for (const p of paragraphs) {
    const para = p.trimEnd();

    // linha em branco
    if (para.trim() === "") {
      cursorY += lineHeight;
      if (cursorY > usableH) {
        doc.addPage();
        cursorY = marginTop;
      }
      continue;
    }

    const lines = doc.splitTextToSize(para, usableW);

    for (const line of lines) {
      if (cursorY > usableH) {
        doc.addPage();
        cursorY = marginTop;
      }
      doc.text(line, marginX, cursorY);
      cursorY += lineHeight;
    }
  }

  doc.save(`Contrato - ${data.nome || "cliente"}.pdf`);
}


document.getElementById("gerar").addEventListener("click", async () => {
  try {
    await gerarContratoPDF();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Erro ao gerar o PDF.");
  }
});
