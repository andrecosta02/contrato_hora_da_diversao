// =========================
// CONFIG
// =========================

const APPS_SCRIPT_PDF_URL = "https://script.google.com/macros/s/AKfycbw936MP3eQD2gOB4yuOjPQnTZTztKK85sYfbEpmRNiGTji9Md7AO9_77pPtfGgNFTPU/exec"; // ex: https://script.google.com/macros/s/XXXXX/exec

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

  const vs = document.getElementById("valor_sinal");
  if (vs) IMask(vs, moneyOpts);

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

function recalcValorSinalExtenso() {
  const vsEl = document.getElementById("valor_sinal");
  const vseEl = document.getElementById("valor_sinal_extenso");
  if (!vsEl || !vseEl) return;

  const n = parseBRLToNumber(vsEl.value || "");
  vseEl.value = n > 0 ? valorBRLPorExtenso(n) : "";
}

function getDiaMesFromDateInput(dateValue) {
  // dateValue vem como "yyyy-mm-dd"
  const v = String(dateValue || "").trim();
  if (!v) return null;

  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = d.toLocaleString("pt-BR", { month: "long" });
  return { dia, mes };
}


function recalcTotals() {
  recalcTotalHoras();
  
  const vpStr = document.getElementById("valor_pacote")?.value || "";
  const vp = parseBRLToNumber(vpStr);
  
  const addsSum = getAdicionaisRows().reduce((s, r) => s + (r.valorNum || 0), 0);
  
  const total = vp + addsSum;
  
  const vtEl = document.getElementById("valor_total");
  const veEl = document.getElementById("valor_pacote_extenso");
  
  if (vtEl) vtEl.value = formatBRL(total);
  if (veEl) veEl.value = valorBRLPorExtenso(total);

  recalcValorSinalExtenso();
}

function initGridsAndAutoCalc() {
  document.getElementById("addAdicional")?.addEventListener("click", () => createAdicionalRow());
  document.getElementById("addVencimento")?.addEventListener("click", () => createVencimentoRow());

  // 1 linha inicial em cada grid
  if (document.querySelector("#tblAdicionais tbody")) createAdicionalRow();
  if (document.querySelector("#tblVencimentos tbody")) createVencimentoRow();

  // ["hora_inicio", "hora_fim", "valor_pacote"].forEach(id => {
  //   document.getElementById(id)?.addEventListener("input", recalcTotals);
  // });
  ["hora_inicio", "hora_fim", "valor_pacote", "valor_sinal"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", recalcTotals);
  });


  document.getElementById("total_horas")?.setAttribute("readonly", "readonly");
  document.getElementById("valor_total")?.setAttribute("readonly", "readonly");
  document.getElementById("valor_pacote_extenso")?.setAttribute("readonly", "readonly");

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

  const dataAss = getValue("data_assinatura");
  const dm = getDiaMesFromDateInput(dataAss);
  const diaAss = dm?.dia || dia;
  const mesAss = dm?.mes || mes;


  return {
    nome: getValue("nome"),
    rg: getValue("rg"),
    cpf: getValue("cpf"),
    endereco_completo: getValue("endereco"),
    // pacote: getValue("pacote"),
    pacote: pacoteSelect.value === "outro"
    ? getValue("pacoteOutro")
    : getValue("pacote"),

    valor_pacote: getValue("valor_pacote"),
    tema: getValue("tema"),

    adicionais: buildAdicionaisText(),
    
    data_assinatura: getValue("data_assinatura"),
    data_festa: formatDateToBR(getValue("data_festa")),

    hora_inicio: getValue("hora_inicio"),
    hora_fim: getValue("hora_fim"),
    total_horas: getValue("total_horas"), // já vem no formato 04:00h

    valor_total_contrato: getValue("valor_total"),
    valor_total_contrato_extenso: getValue("valor_pacote_extenso"),
    valor_sinal: getValue("valor_sinal"),
    valor_sinal_extenso: getValue("valor_sinal_extenso"),

    proximos_vencimentos: buildVencimentosText(),

    // dia_assinatura: dia,
    // mes_assinatura: mes,
    dia_assinatura: diaAss,
    mes_assinatura: mesAss,

  };
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
    ["data_assinatura", "Data de assinatura"],
  ];

  return required
    .filter(([key]) => !String(data[key] || "").trim())
    .map(([, label]) => label);
}



// ==========================================
// FUNÇÃO PRINCIPAL (Baseada no seu código)
// ==========================================

async function gerarContratoPDF() {
  // Mantendo sua lógica de coleta de dados
  const data = getFormData();

  const missing = validateRequiredFields(data);
  if (missing.length) {
    alert("Preencha os campos obrigatórios:\n• " + missing.join("\n• "));
    return;
  }

  console.log(JSON.stringify(data))

  // === NOVO FLUXO: pede o PDF pronto ao Apps Script (retorna JSON com base64)
  // const resp = await fetch(APPS_SCRIPT_PDF_URL, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(data),
  // });

  const form = new FormData();
  Object.keys(data).forEach((k) => {
    form.append(k, data[k] ?? "");
  });

  const resp = await fetch(APPS_SCRIPT_PDF_URL, {
    method: "POST",
    body: form,
  });


  console.log("Resposta do Apps Script:", resp);

  const json = await resp.json().catch(() => null);
  if (!json || json.ok !== true) {
    const msg = json?.error || "Erro ao gerar PDF no Apps Script.";
    throw new Error(msg);
  }

  const base64 = json.base64;
  const filename = json.filename || `Contrato - ${data.nome || "cliente"}.pdf`;

  // base64 -> bytes -> Blob
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: json.mimeType || "application/pdf" });

  // Download (PC/Android). No iPhone, pode abrir em nova aba dependendo do Safari.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // libera memória depois
  setTimeout(() => URL.revokeObjectURL(url), 1500);
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

const pacoteSelect = document.getElementById("pacote");
const pacoteOutroWrapper = document.getElementById("pacoteOutroWrapper");

if (pacoteSelect && pacoteOutroWrapper) {
  pacoteSelect.addEventListener("change", () => {
    pacoteOutroWrapper.classList.toggle(
      "d-none",
      pacoteSelect.value !== "outro"
    );
  });
}
