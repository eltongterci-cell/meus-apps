// ============================================================
// FORMATO — funções pequenas de formatação
// ------------------------------------------------------------
// Dinheiro, datas, meses e textos. Não falam com o banco
// nem mexem na tela: só transformam um valor em outro.
// ============================================================

// ---------- Dinheiro ----------
const formatoReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 1234.5 → "R$ 1.234,50" */
export function dinheiro(valor) {
  return formatoReal.format(valor);
}

// ---------- Datas e meses ----------
// Os meses são guardados como texto "AAAA-MM", ex.: "2026-11"

/** Mês de hoje, ex.: "2026-11" */
export function mesDeHoje() {
  const hoje = new Date();
  return hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");
}

/** Anda N meses para frente (ou para trás, se N for negativo). ("2026-11", 1) → "2026-12" */
export function somarMeses(mes, quantidade) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(ano, numeroMes - 1 + quantidade, 1);
  return data.getFullYear() + "-" + String(data.getMonth() + 1).padStart(2, "0");
}

/** "2026-11" → "novembro de 2026" */
export function nomeDoMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return new Date(ano, numeroMes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** "2026-11-03" → "03/11" */
export function dataCurta(data) {
  const [, mes, dia] = data.split("-");
  return dia + "/" + mes;
}

/** "2026-11-03T10:13:00Z" → "03/11 às 07:13" (no horário do celular) */
export function dataEHora(dataIso) {
  if (!dataIso) return "";
  const d = new Date(dataIso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

// ---------- Textos ----------

/**
 * Protege o texto antes de colocar na tela
 * (evita que um nome com < > quebre a página).
 */
export function escapar(texto) {
  const trocas = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto ?? "").replace(/[&<>"']/g, (c) => trocas[c]);
}

/**
 * Deixa a descrição do Nubank mais legível.
 * "Transferência enviada pelo Pix|ANA JULIA" → { titulo: "ANA JULIA", detalhe: "Pix" }
 */
export function limparDescricao(descricao) {
  const partes = String(descricao || "").split("|");
  if (partes.length === 1) return { titulo: partes[0].trim(), detalhe: "" };

  const tipo = partes[0].toLowerCase().includes("pix") ? "Pix" : partes[0].trim();
  return { titulo: partes.slice(1).join(" ").trim(), detalhe: tipo };
}
