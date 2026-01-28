/**
 * Web App - Gera PDF a partir de um Google Docs template com {{placeholders}}.
 * Fluxo seguro: copia o template, substitui na cópia, exporta PDF, apaga cópia.
 *
 * Como chamar: POST (Content-Type: application/json)
 * Body: { "nome": "Maria", "cpf": "000.000.000-00", ... }
 *
 * Retorno: PDF (application/pdf)
 */

// 1) Coloque aqui o ID do SEU Google Docs template (o documento com {{chaves}})
const TEMPLATE_DOC_ID = "13TlyqoSFAjjN1qDN1tuPlCzcYu-f__DWG7kG5409ToM";

// 2) (Opcional) ID de uma pasta do Drive para guardar cópias temporárias.
// Se deixar vazio, cria no Meu Drive raiz.
const WORK_FOLDER_ID = "";

function testAuth() {
  const f = DriveApp.getFileById(TEMPLATE_DOC_ID);
  Logger.log(f.getName());
}

/**
 * POST /exec  -> retorna PDF
 */
function doPost(e) {
  try {
    // const payload = parseJsonBody_(e);
    const payload = parseFormBody_(e);
    const pdfBlob = buildPdfFromTemplate_(payload);

    // Resposta como PDF (download)
    const out = ContentService.createTextOutput(""); // corpo vazio; usaremos "setContent"
    // ContentService não permite retornar blob direto como binary de forma confiável em todos os casos.
    // Melhor: usar HtmlService? Não. A solução padrão é retornar via "ContentService" com base64,
    // MAS para download direto, o mais confiável é "return pdfBlob" via "ContentService" não dá.
    // Então usamos "return" com "ContentService" em base64 + client baixar.
    //
    // Como você pediu blob direto, a forma correta é usar "return" com "ContentService"
    // em base64 e no front converter para Blob.
    //
    // Vou retornar JSON com base64 e metadados do arquivo.

    const base64 = Utilities.base64Encode(pdfBlob.getBytes());
    const filename = suggestedFilename_(payload);

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        filename: filename,
        mimeType: "application/pdf",
        base64: base64
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: (err && err.message) ? err.message : String(err)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * (Opcional) GET pra testar no browser sem payload
 */
function doGet() {
  return ContentService
    .createTextOutput("Use POST com JSON para gerar o PDF.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/* =========================
   Core
========================= */

function buildPdfFromTemplate_(data) {
  if (!TEMPLATE_DOC_ID || TEMPLATE_DOC_ID === "COLE_AQUI_O_ID_DO_SEU_TEMPLATE_DOC") {
    throw new Error("Defina TEMPLATE_DOC_ID com o ID do Google Docs template.");
  }

  // Pasta de trabalho
  const folder = WORK_FOLDER_ID ? DriveApp.getFolderById(WORK_FOLDER_ID) : null;

  // 1) Copia o template
  const templateFile = DriveApp.getFileById(TEMPLATE_DOC_ID);
  const copyName = "TEMP_CONTRATO_" + new Date().toISOString();
  const copyFile = folder ? templateFile.makeCopy(copyName, folder) : templateFile.makeCopy(copyName);

  try {
    // 2) Abre a cópia e substitui placeholders
    const doc = DocumentApp.openById(copyFile.getId());

    // espera curta (1~2s)
    Utilities.sleep(1200);

    const body = doc.getBody();

    // Para cada chave do JSON, substitui {{chave}} pelo valor
    Object.keys(data || {}).forEach((k) => {
      const v = data[k];
      const safeValue = (v === null || v === undefined) ? "" : String(v);
      body.replaceText(escapeForRegex_("{{" + k + "}}"), safeValue);
    });

    // (Opcional) Limpar placeholders não preenchidos (mantém o doc limpo)
    // Ex.: qualquer {{qualquer_coisa}} vira vazio
    body.replaceText("\\{\\{[^}]+\\}\\}", "");

    doc.saveAndClose();

    // 3) Exporta PDF
    const pdfBlob = copyFile.getAs(MimeType.PDF).setName(suggestedFilename_(data));

    return pdfBlob;

  } finally {
    // 4) Apaga a cópia temporária (recomendado)
    // Se preferir auditar/debug, comente a linha abaixo.
    copyFile.setTrashed(true);
  }
}

function parseFormBody_(e) {
  return e.parameter || {};
}


function suggestedFilename_(data) {
  const nome = data && data.nome ? String(data.nome).trim() : "Sem_Nome";
  // Evita caracteres ruins no nome do arquivo
  const safe = nome.replace(/[\\\/:*?"<>|]+/g, "-");
  return "Contrato - " + safe + ".pdf";
}

function escapeForRegex_(s) {
  // DocumentApp.replaceText usa regex; precisamos escapar caracteres especiais
  return String(s).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}
