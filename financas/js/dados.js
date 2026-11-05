// ============================================================
// DADOS — conversa com o Supabase
// ------------------------------------------------------------
// Único arquivo que fala com o banco de dados:
// login, buscar transações, salvar classificação e
// pedir para a função buscar novidades no Nubank.
// ============================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, FUNCAO_SINCRONIZAR } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA);

// ---------- Login ----------

/** Usuário já logado neste aparelho (ou null) */
export async function usuarioLogado() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/** Faz login. Devolve o usuário ou lança erro. */
export async function entrar(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data.user;
}

export async function sair() {
  await supabase.auth.signOut();
}

// ---------- Buscar ----------

/**
 * Contas (conta corrente e cartão), num formato fácil de consultar:
 * { "id-da-conta": { nome, tipo, saldo, limite, atualizado_em } }
 */
export async function buscarContas() {
  const { data, error } = await supabase.from("fin_contas").select("id, nome, tipo, saldo, limite, atualizado_em");
  if (error) throw error;
  return Object.fromEntries(data.map((conta) => [conta.id, conta]));
}

/** Todas as transações, da mais nova para a mais antiga (busca de 1000 em 1000). */
export async function buscarTransacoes() {
  const POR_PAGINA = 1000;
  let todas = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await supabase
      .from("fin_transacoes")
      .select("id, data, descricao, valor, tipo, categoria, categoria_pluggy, classificacao, conta_id")
      .order("data", { ascending: false })
      .range(inicio, inicio + POR_PAGINA - 1);
    if (error) throw error;

    todas = todas.concat(data);
    if (data.length < POR_PAGINA) return todas;
    inicio += POR_PAGINA;
  }
}

// ---------- Salvar ----------

/** Muda a classificação de uma ou várias transações */
export async function salvarClassificacao(ids, classificacao) {
  const { error } = await supabase.from("fin_transacoes").update({ classificacao }).in("id", ids);
  if (error) throw error;
}

/** Cria uma regra: transações com essa descrição já entram classificadas */
export async function salvarRegra(usuarioId, descricao, classificacao) {
  const { error } = await supabase
    .from("fin_regras")
    .insert({ user_id: usuarioId, palavra: descricao, classificacao });
  if (error) throw error;
}

// ---------- Lista de pagamentos do mês ----------

/**
 * Suas contas e dívidas (aluguel, luz, fatura...).
 * Devolve null se a tabela ainda não foi criada no Supabase.
 */
export async function buscarCompromissos() {
  const { data, error } = await supabase.from("fin_compromissos").select("*").eq("ativo", true);
  if (error) return null;
  return data;
}

/** O que você marcou como "Paguei": [{ compromisso_id, mes }] */
export async function buscarPagamentosManuais() {
  const { data, error } = await supabase.from("fin_pagamentos").select("compromisso_id, mes");
  if (error) return [];
  return data;
}

/** Cria (sem id) ou atualiza (com id) uma conta/dívida */
export async function salvarCompromisso(usuarioId, compromisso) {
  const { id, ...campos } = compromisso;
  const consulta = id
    ? supabase.from("fin_compromissos").update(campos).eq("id", id)
    : supabase.from("fin_compromissos").insert({ ...campos, user_id: usuarioId });
  const { error } = await consulta;
  if (error) throw error;
}

/** Tira da lista (não apaga o histórico: só desativa) */
export async function removerCompromisso(id) {
  const { error } = await supabase.from("fin_compromissos").update({ ativo: false }).eq("id", id);
  if (error) throw error;
}

export async function marcarPago(usuarioId, compromissoId, mes) {
  const { error } = await supabase
    .from("fin_pagamentos")
    .upsert({ user_id: usuarioId, compromisso_id: compromissoId, mes });
  if (error) throw error;
}

export async function desmarcarPago(compromissoId, mes) {
  const { error } = await supabase
    .from("fin_pagamentos")
    .delete()
    .eq("compromisso_id", compromissoId)
    .eq("mes", mes);
  if (error) throw error;
}

// ---------- Metas (limite de supérfluo) ----------
// Ficam na tabela fin_metas (valem em qualquer aparelho).
// Se a tabela ainda não existir, guarda no próprio celular.

const CHAVE_LOCAL = "financas.metas";

function metasDoCelular() {
  try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "{}"); } catch { return {}; }
}

/** { teto_superfluo: 2500, ... } */
export async function buscarMetas() {
  const { data, error } = await supabase.from("fin_metas").select("nome, valor");
  if (error) return metasDoCelular();
  return Object.fromEntries(data.map((m) => [m.nome, Number(m.valor)]));
}

export async function salvarMeta(usuarioId, nome, valor) {
  const { error } = await supabase
    .from("fin_metas")
    .upsert({ user_id: usuarioId, nome, valor, atualizado_em: new Date().toISOString() });
  if (error) {
    const metas = metasDoCelular();
    metas[nome] = valor;
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(metas)); } catch { /* sem memória local */ }
  }
}

// ---------- Atualizar do Nubank ----------

/** Pede para a Edge Function buscar as transações novas na Pluggy */
export async function sincronizarNubank() {
  const { data, error } = await supabase.functions.invoke(FUNCAO_SINCRONIZAR, { body: {} });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.erro);
  return data; // { ok, contas, transacoes, classificadas }
}
