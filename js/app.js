/**
 * app.js — Front 100% estático (GitHub Pages) + Google Apps Script (proxy) para buscar o template
 * - Busca o HTML do Google Docs publicado via Apps Script (evita CORS)
 * - Substitui chaves {{...}} pelos valores do formulário
 * - Injeta logo (opcional) e gera PDF no client com html2pdf
 *
 * Pré-requisitos no app.html:
 * 1) Ter um <div id="preview"></div>
 * 2) Ter o botão <button id="gerar">...</button>
 * 3) Ter um botão <button id="logout">...</button> (opcional)
 * 4) Incluir: html2pdf.bundle.min.js
 *    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
 *
 * Campos esperados (ids):
 * nome, rg, cpf, endereco, pacote, valor_pacote, tema, adicionais, data_festa,
 * hora_inicio, hora_fim, total_horas, valor_total, valor_extenso, vencimentos
 *
 * Ajuste as constantes APPS_SCRIPT_URL e GOOGLE_DOC_PUB_ID abaixo.
 */

// =========================
// 1) CONFIGURAÇÕES
// =========================

// URL do seu Web App do Apps Script (Implantar → Aplicativo da Web → URL)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyPfAvgIGpQBDcO1Y75ZF2K43uR5lQ4ZtNK0Qmn4oi5kz70xf3X1RxDBXpEVV5pJg1e/exec";

// ID do doc publicado (a parte 2PACX-...)
// Exemplo de link publicado:
// https://docs.google.com/document/d/e/2PACX-XXXXX/pub
// Então o ID é: 2PACX-XXXXX
const GOOGLE_DOC_PUB_ID = "2PACX-1vT99qWFGHbZKw7GFCxtdI5HR0dV4C7v8LmXNsGIfwFjvd2OqiG2gjC51yFalSwhrg";

// Monta a URL correta do Google Docs publicado (IMPORTANTE: precisa ter /pub)
const GOOGLE_DOC_PUB_URL = `https://docs.google.com/document/d/e/${GOOGLE_DOC_PUB_ID}/pub?output=html`;

// Template URL via proxy (evita CORS)
const TEMPLATE_URL = `${APPS_SCRIPT_URL}?url=${encodeURIComponent(GOOGLE_DOC_PUB_URL)}`;

// Se quiser injetar logo no topo do PDF (recomendado p/ não depender do Google Docs)
const USE_LOGO = true;
// Caminho da logo dentro do seu repo (ex: contrato/assets/logo.png)
// const LOGO_SRC = "assets/logo.png";
const LOGO_SRC = "assets/logo.jpg";
// Tamanho máximo da logo no PDF (via CSS inline)
const LOGO_MAX_HEIGHT_PX = 70;

// =========================
// 2) PROTEÇÃO / LOGOUT
// =========================
if (sessionStorage.getItem("auth") !== "ok") {
  // se você não estiver usando login, pode remover este bloco
  window.location.href = "index.html";
}

const logoutBtn = document.getElementById("logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("auth");
    window.location.href = "index.html";
  });
}

// =========================
// 3) UTILITÁRIOS
// =========================
function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Substitui {{chave}} pelo valor correspondente no objeto data.
 * Se não existir, coloca "—".
 */
function applyTemplate(html, data) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data[key];
    return v ? escapeHtml(String(v)) : "—";
  });
}

/**
 * Extrai apenas o conteúdo do <body> do HTML retornado pelo Google Docs.
 * (O Google entrega uma página completa.)
 */
function extractBodyHtml(fullHtml) {
  const doc = new DOMParser().parseFromString(fullHtml, "text/html");
  // Remove scripts por segurança (normalmente nem vem)
  doc.querySelectorAll("script").forEach((s) => s.remove());
  return doc.body ? doc.body.innerHTML : fullHtml;
}

/**
 * Busca o HTML do template via Apps Script proxy (evita CORS).
 */
async function fetchTemplateHtml() {
  const res = await fetch(TEMPLATE_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Não consegui baixar o modelo do contrato. HTTP ${res.status}`);
  }
  return await res.text();
}

// =========================
// 4) LEITURA DOS CAMPOS DO FORM
// =========================
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function getFormData() {
  // Ajuste aqui se quiser nomes diferentes nas chaves {{...}}
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

    // data de assinatura (se existir no seu template)
    dia_assinatura: dia,
    mes_assinatura: mes,
  };
}

// =========================
// 5) GERAÇÃO DO PDF
// =========================
function buildHeaderLogoHtml() {
  if (!USE_LOGO) return "";
  return `
    <div style="display:flex; align-items:center; justify-content:center; margin: 6px 0 14px 0;">
      <img src="${LOGO_SRC}" style="max-height:${LOGO_MAX_HEIGHT_PX}px; width:auto;" />
    </div>
  `;
}

async function gerarContratoPDF() {
  const data = getFormData();

  const rawHtml = await fetchTemplateHtml();
  const templateBody = extractBodyHtml(rawHtml);

  // aplica {{chaves}}
  const filledHtml = applyTemplate(templateBody, data);

  // 🔥 CONVERTE PARA TEXTO LIMPO (mata o bug do html2canvas)
  const plainText = htmlToPlainText(filledHtml);

  const preview = document.getElementById("preview");
  if (!preview) throw new Error("Elemento #preview não encontrado.");

  // Renderiza num HTML nosso, simples
  preview.innerHTML = renderPrintableContract(plainText);

  preview.style.fontFamily = "Arial, sans-serif";

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Contrato - ${data.nome || "cliente"}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      foreignObjectRendering: false,
      windowWidth: 1200
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  };

  await html2pdf().set(opt).from(preview).save();
}


// =========================
// 6) EVENTO DO BOTÃO
// =========================
const gerarBtn = document.getElementById("gerar");
if (!gerarBtn) {
  console.warn("Botão #gerar não encontrado. Crie um botão com id='gerar'.");
} else {
  gerarBtn.addEventListener("click", async () => {
    try {
      await gerarContratoPDF();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Erro ao gerar o contrato em PDF.");
    }
  });
}



// Remove tags e deixa só texto (mantém quebras)
function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // remove coisas que atrapalham
  doc.querySelectorAll("script, style, link").forEach(el => el.remove());

  // troca <br> por \n
  doc.querySelectorAll("br").forEach(br => br.replaceWith("\n"));

  // troca <p> e <div> por blocos com quebra
  doc.querySelectorAll("p, div").forEach(el => {
    // coloca quebra no final de cada bloco
    el.append("\n");
  });

  // pega texto bruto
  let text = doc.body ? doc.body.textContent : "";

  // limpa quebras excessivas
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

// Renderiza o texto do contrato em um layout simples e “imprimível”
function renderPrintableContract(text) {
  // escapa HTML e preserva quebras
  const safe = escapeHtml(text).replaceAll("\n", "<br/>");

  return `
    <div style="max-width: 800px; margin: 0 auto; color:#000;">
      ${buildHeaderLogoHtml()}
      <div style="font-size:12pt; line-height:1.4;">
        ${safe}
      </div>
    </div>
  `;
}
