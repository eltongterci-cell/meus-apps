// ============================================================
// EXPORTAR — botão "Baixar tudo"
// ------------------------------------------------------------
// Gera uma planilha (.csv) com TODAS as transações e baixa
// no aparelho. Abre direto no Excel e no Google Planilhas.
//
// Formato brasileiro: colunas separadas por ";" e valores
// com vírgula (1234,56), para o Excel não bagunçar os números.
// ============================================================

import { ehGasto, ehEntrada, valorDoGasto, classificacaoDe, categoriaDe } from "./regras.js";
import { CLASSIFICACOES } from "./config.js";
import { mesDeHoje } from "./formato.js";

const COLUNAS = ["Data", "Conta", "Descrição", "Valor (R$)", "Tipo", "Categoria", "Classificação"];

/** Coloca o texto entre aspas e escapa aspas internas (padrão CSV) */
function celula(texto) {
  return '"' + String(texto ?? "").replace(/"/g, '""') + '"';
}

/** 1234.5 → "1234,50" */
function numeroBR(valor) {
  return Number(valor).toFixed(2).replace(".", ",");
}

/** "2026-11-03" → "03/11/2026" */
function dataBR(data) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** O que a transação é, em português */
function tipoDaTransacao(transacao, contas) {
  if (ehGasto(transacao, contas)) return "Gasto";
  if (ehEntrada(transacao, contas)) return "Entrada";
  return "Outro (fatura/estorno)";
}

/** Monta o texto da planilha */
export function gerarPlanilha(transacoes, contas) {
  const linhas = [...transacoes]
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .map((t) => {
      const conta = contas[t.conta_id]?.tipo === "CREDIT" ? "Cartão" : "Conta";
      const gasto = ehGasto(t, contas);
      // Gasto aparece negativo, entrada positiva: assim dá para somar a coluna
      const valor = gasto ? -valorDoGasto(t, contas) : Number(t.valor);
      const classificacao = gasto ? CLASSIFICACOES[classificacaoDe(t)].nome : "";

      return [
        celula(dataBR(t.data)),
        celula(conta),
        celula(t.descricao),
        numeroBR(valor),
        celula(tipoDaTransacao(t, contas)),
        celula(categoriaDe(t)),
        celula(classificacao),
      ].join(";");
    });

  return [COLUNAS.map(celula).join(";"), ...linhas].join("\r\n");
}

/** Faz o navegador baixar a planilha */
export function baixarPlanilha(transacoes, contas) {
  const conteudo = gerarPlanilha(transacoes, contas);
  // "﻿" no começo faz o Excel reconhecer os acentos (UTF-8)
  const arquivo = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(arquivo);
  link.download = `financas-${mesDeHoje()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
