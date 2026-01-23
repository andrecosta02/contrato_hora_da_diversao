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


function showLoadingOverlay() {
  const ov = document.getElementById("loadingOverlay");
  if (!ov) return;
  ov.classList.remove("d-none");
  ov.setAttribute("aria-hidden", "false");
}

function hideLoadingOverlay() {
  const ov = document.getElementById("loadingOverlay");
  if (!ov) return;
  ov.classList.add("d-none");
  ov.setAttribute("aria-hidden", "true");
}


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
  // data_festa agora usa calendário nativo (<input type="date">)
  // horas agora usam seletor nativo (<input type="time">)

  // total_horas agora é automático (readonly) — sem máscara

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
  if (vp) IMask(vp, moneyOpts);

  // valor_total e valor_extenso agora são automáticos (readonly) — sem máscara
}

applyMasks();

// =========================
// GRID + CÁLCULOS AUTOMÁTICOS
// =========================
const MONEY_MASK_OPTS = {
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

function parseBRLToNumber(str) {
  const s = String(str || "").replace(/\s/g, "").replace("R$", "");
  if (!s) return 0;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseHHMM(s) {
  const m = String(s || "").match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function calcDurationMinutes(startHHMM, endHHMM) {
  const a = parseHHMM(startHHMM);
  const b = parseHHMM(endHHMM);
  if (a == null || b == null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function minutesToHHMMH(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}h`;
}

function formatDateToBR(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return v;
}

// ---- Extenso (pt-BR) ----
function numeroPorExtenso(n) {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dezADezenove = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function ate999(num) {
    num = num % 1000;
    if (num === 0) return "";
    if (num === 100) return "cem";
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;

    let parts = [];
    if (c) parts.push(centenas[c]);
    if (d === 1) {
      parts.push(dezADezenove[u]);
    } else {
      if (d) parts.push(dezenas[d]);
      if (u) parts.push(unidades[u]);
    }
    return parts.join(" e ");
  }

  function grupo(num, singular, plural) {
    if (num === 0) return "";
    if (num === 1) return `${ate999(num)} ${singular}`.trim();
    return `${ate999(num)} ${plural}`.trim();
  }

  n = Math.floor(n);
  if (n === 0) return "zero";

  const milhoes = Math.floor(n / 1000000);
  const milhares = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;

  let parts = [];
  if (milhoes) parts.push(grupo(milhoes, "milhão", "milhões"));
  if (milhares) {
    if (milhares === 1) parts.push("mil");
    else parts.push(`${ate999(milhares)} mil`.trim());
  }
  if (resto) parts.push(ate999(resto));

  return parts.filter(Boolean).join(" e ").replace(/\s+/g, " ").trim();
}

function valorBRLPorExtenso(valor) {
  const v = Number(valor || 0);
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);

  let out = "";
  if (reais === 0) out = "zero real";
  else if (reais === 1) out = "um real";
  else out = `${numeroPorExtenso(reais)} reais`;

  if (centavos) {
    if (centavos === 1) out += " e um centavo";
    else out += ` e ${numeroPorExtenso(centavos)} centavos`;
  }
  return out;
}

// ---- Grid: Adicionais ----
function createAdicionalRow(initial = {}) {
  const tbody = document.querySelector("#tblAdicionais tbody");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="form-control form-control-sm grid-input add-nome" placeholder="Ex: Pipoca" /></td>
    <td><input class="form-control form-control-sm grid-input add-valor" placeholder="R$ 0,00" /></td>
    <td><input class="form-control form-control-sm grid-input add-obs" placeholder="Opcional" /></td>
    <td><button type="button" class="btn btn-sm btn-outline-danger btn-icon btn-rem">&times;</button></td>
  `;
  tbody.appendChild(tr);

  const nome = tr.querySelector(".add-nome");
  const valor = tr.querySelector(".add-valor");
  const obs = tr.querySelector(".add-obs");

  nome.value = initial.nome || "";
  valor.value = initial.valor || "";
  obs.value = initial.obs || "";

  if (valor) IMask(valor, MONEY_MASK_OPTS);

  tr.querySelector(".btn-rem").addEventListener("click", () => {
    tr.remove();
    recalcTotals();
  });

  [nome, valor, obs].forEach(el => el.addEventListener("input", recalcTotals));

  recalcTotals();
}

function getAdicionaisRows() {
  return Array.from(document.querySelectorAll("#tblAdicionais tbody tr"))
    .map(tr => {
      const nome = tr.querySelector(".add-nome")?.value.trim() || "";
      const valorStr = tr.querySelector(".add-valor")?.value.trim() || "";
      const obs = tr.querySelector(".add-obs")?.value.trim() || "";
      const valorNum = parseBRLToNumber(valorStr);
      return { nome, valorStr, valorNum, obs };
    })
    .filter(r => r.nome || r.valorStr || r.obs);
}

function buildAdicionaisText() {
  const rows = getAdicionaisRows();
  if (!rows.length) return "—";
  return rows.map(r => {
    const val = r.valorStr || formatBRL(r.valorNum);
    const obs = r.obs ? ` - Obs: ${r.obs}` : "";
    return `- ${r.nome || "Adicional"} - ${val}${obs}`;
  }).join("\n");
}

// ---- Grid: Vencimentos ----
function createVencimentoRow(initial = {}) {
  const tbody = document.querySelector("#tblVencimentos tbody");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="form-control form-control-sm grid-input ven-data" type="date" /></td>
    <td><input class="form-control form-control-sm grid-input ven-valor" placeholder="R$ 0,00" /></td>
    <td><input class="form-control form-control-sm grid-input ven-obs" placeholder="Opcional" /></td>
    <td><button type="button" class="btn btn-sm btn-outline-danger btn-icon btn-rem">&times;</button></td>
  `;
  tbody.appendChild(tr);

  const data = tr.querySelector(".ven-data");
  const valor = tr.querySelector(".ven-valor");
  const obs = tr.querySelector(".ven-obs");

  data.value = initial.data || "";
  valor.value = initial.valor || "";
  obs.value = initial.obs || "";  if (valor) IMask(valor, MONEY_MASK_OPTS);

  tr.querySelector(".btn-rem").addEventListener("click", () => tr.remove());
}

function getVencimentosRows() {
  return Array.from(document.querySelectorAll("#tblVencimentos tbody tr"))
    .map(tr => {
      const dataRaw = tr.querySelector(".ven-data")?.value.trim() || "";
      const data = formatDateToBR(dataRaw);
      const valorStr = tr.querySelector(".ven-valor")?.value.trim() || "";
      const obs = tr.querySelector(".ven-obs")?.value.trim() || "";
      return { data, valorStr, obs };
    })
    .filter(r => r.data || r.valorStr || r.obs);
}

function buildVencimentosText() {
  const rows = getVencimentosRows();
  if (!rows.length) return "—";
  return rows.map(r => {
    const obs = r.obs ? ` - Obs: ${r.obs}` : "";
    const val = r.valorStr || "—";
    const dt = r.data || "—";
    return `- ${dt} - ${val}${obs}`;
  }).join("\n");
}

// ---- Cálculos automáticos ----
function recalcTotalHoras() {
  const hIni = document.getElementById("hora_inicio")?.value || "";
  const hFim = document.getElementById("hora_fim")?.value || "";
  const totalEl = document.getElementById("total_horas");
  if (!totalEl) return;

  const mins = calcDurationMinutes(hIni, hFim);
  totalEl.value = mins == null ? "" : minutesToHHMMH(mins);
}

function recalcTotals() {
  recalcTotalHoras();

  const vpStr = document.getElementById("valor_pacote")?.value || "";
  const vp = parseBRLToNumber(vpStr);

  const addsSum = getAdicionaisRows().reduce((s, r) => s + (r.valorNum || 0), 0);

  const total = vp + addsSum;

  const vtEl = document.getElementById("valor_total");
  const veEl = document.getElementById("valor_extenso");

  if (vtEl) vtEl.value = formatBRL(total);
  if (veEl) veEl.value = valorBRLPorExtenso(total);
}

function initGridsAndAutoCalc() {
  document.getElementById("addAdicional")?.addEventListener("click", () => createAdicionalRow());
  document.getElementById("addVencimento")?.addEventListener("click", () => createVencimentoRow());

  // 1 linha inicial em cada grid
  if (document.querySelector("#tblAdicionais tbody")) createAdicionalRow();
  if (document.querySelector("#tblVencimentos tbody")) createVencimentoRow();

  ["hora_inicio", "hora_fim", "valor_pacote"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", recalcTotals);
  });

  document.getElementById("total_horas")?.setAttribute("readonly", "readonly");
  document.getElementById("valor_total")?.setAttribute("readonly", "readonly");
  document.getElementById("valor_extenso")?.setAttribute("readonly", "readonly");

  recalcTotals();
}

document.addEventListener("DOMContentLoaded", initGridsAndAutoCalc);



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

    adicionais: buildAdicionaisText(),

    data_festa: formatDateToBR(getValue("data_festa")),

    hora_inicio: getValue("hora_inicio"),
    hora_fim: getValue("hora_fim"),
    total_horas: getValue("total_horas"), // já vem no formato 04:00h

    valor_total_contrato: getValue("valor_total"),
    valor_total_contrato_extenso: getValue("valor_extenso"),

    proximos_vencimentos: buildVencimentosText(),

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
    if (!v) return "—";

    // Mantém quebras de linha em campos que viram lista no contrato
    if (key === "adicionais" || key === "proximos_vencimentos") {
      return escapeHtml(String(v)).replace(/\n/g, "<br>");
    }

    return escapeHtml(String(v));
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

function validateRequiredFields(data) {
  const required = [
    ["nome", "Nome"],
    ["cpf", "CPF"],
    ["endereco_completo", "Endereço completo"],
    ["pacote", "Pacote"],
    ["data_festa", "Data da festa"],
    ["hora_inicio", "Hora início"],
    ["hora_fim", "Hora fim"],
    ["valor_total_contrato", "Valor total do contrato"],
  ];

  return required
    .filter(([key]) => !String(data[key] || "").trim())
    .map(([, label]) => label);
}

function toPtBrLongDate(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function isClauseTitle(line) {
  const t = (line || "").trim();
  return /^CLÁUSULA\b/i.test(t) || /^CLAUSULA\b/i.test(t);
}

/**
 * Draw a justified paragraph (Word-like). Justifies all lines except the last.
 */
function drawJustifiedParagraph(doc, text, x, y, maxW, lineH) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return y;

  const spaceW = doc.getTextWidth(" ");
  let line = [];
  let lineW = 0;

  const flush = (isLast) => {
    if (!line.length) return;
    if (isLast || line.length === 1) {
      doc.text(line.join(" "), x, y);
      y += lineH;
      return;
    }
    const wordsW = line.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
    const gaps = line.length - 1;
    const extra = Math.max(0, maxW - wordsW);
    const gapW = extra / gaps;

    let cx = x;
    for (let i = 0; i < line.length; i++) {
      const w = line[i];
      doc.text(w, cx, y);
      cx += doc.getTextWidth(w);
      if (i < line.length - 1) cx += gapW;
    }
    y += lineH;
  };

  for (const w of words) {
    const wW = doc.getTextWidth(w);
    const nextW = line.length === 0 ? wW : lineW + spaceW + wW;
    if (nextW <= maxW) {
      line.push(w);
      lineW = nextW;
    } else {
      flush(false);
      line = [w];
      lineW = wW;
    }
  }
  flush(true);
  return y;
}

function addHeader(doc, opts) {
  const { pageW, marginX, logoDataUrl } = opts;

  let y = 10;

  if (logoDataUrl) {
    const imgType = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    const imgW = 42;
    const imgH = 18;
    doc.addImage(logoDataUrl, imgType, (pageW - imgW) / 2, y, imgW, imgH);
    y += imgH + 2;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  // doc.text("CONTRATO DE ADESÃO DE LOCAÇÃO PARA USO", pageW / 2, y, { align: "center" });
  // y += 6;
  // doc.text("DE ESPAÇO & DECORAÇÃO DE FESTA INFANTIL", pageW / 2, y, { align: "center" });

  // subtle separator like a header rule
  y += 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, pageW - marginX, y);
}

function addFooter(doc, opts) {
  const { pageW, pageH } = opts;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("HORA DA DIVERSÃO", pageW / 2, pageH - 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    "Rua Dom Sebastião Leme, 576  |  Bairro Peixinhos |  Olinda  |  CEP:  53230-370  |  Fone: +55 81 99292-9205",
    pageW / 2,
    pageH - 7,
    { align: "center" }
  );
}



async function gerarContratoPDF() {
  const data = getFormData();

  const missing = validateRequiredFields(data);
  if (missing.length) {
    alert("Preencha os campos obrigatórios:\n• " + missing.join("\n• "));
    return;
  }

  const rawHtml = await fetchTemplateHtml();
  const templateBody = extractBodyHtml(rawHtml);
  const filledHtml = applyTemplate(templateBody, data);

  let text = htmlToPlainText(filledHtml);
  text = cleanGoogleDocsFooter(text);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Margens iguais ao DOC (0,5") ~ 12,7mm
  const marginX = 12.7;

  // Header/Footer
  let logoDataUrl = null;
  if (USE_LOGO) {
    try {
      logoDataUrl = await loadImageAsDataURL(LOGO_SRC);
    } catch {}
  }

  const headerReserve = 40; // espaço reservado pro cabeçalho
  const top = headerReserve + 6;
  const bottom = pageH - 22; // espaço reservado pro rodapé

  const maxW = pageW - marginX * 2;
  const lineH = 5; // ~10pt

  const applyPageChrome = () => {
    addHeader(doc, { pageW, marginX, logoDataUrl });
    addFooter(doc, { pageW, pageH });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  applyPageChrome();

  let y = top;

  const newPage = () => {
    doc.addPage();
    applyPageChrome();
    y = top;
  };

  // Texto: separar por parágrafos (linha em branco)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  for (const p of paragraphs) {
    const sublines = p.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of sublines) {
      if (y + lineH > bottom) newPage();

      if (isClauseTitle(line)) {
        doc.setFont("helvetica", "bold");
        y = drawJustifiedParagraph(doc, line, marginX, y, maxW, lineH);
        doc.setFont("helvetica", "normal");
        y += 1.5;
      } else {
        doc.setFont("helvetica", "normal");
        y = drawJustifiedParagraph(doc, line, marginX, y, maxW, lineH);
      }
    }

    // Espaço entre parágrafos
    y += 2;
  }

  // Numeração de páginas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Página ${p} de ${pages}`, pageW - marginX, pageH - 14, { align: "right" });
  }

  doc.save(`Contrato - ${data.nome || "cliente"}.pdf`);
}



document.getElementById("gerar").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (btn?.dataset?.loading === "1") return;

  btn.dataset.loading = "1";
  btn.disabled = true;
  showLoadingOverlay();

  try {
    await gerarContratoPDF();
  } catch (err) {
    console.error(err);
    alert(err?.message || "Erro ao gerar o PDF.");
  } finally {
    hideLoadingOverlay();
    btn.disabled = false;
    btn.dataset.loading = "0";
  }
});
