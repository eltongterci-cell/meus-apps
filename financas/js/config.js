// ============================================================
// CONFIG — configurações do app
// ------------------------------------------------------------
// Tudo que pode mudar fica aqui, num lugar só.
// ============================================================

// ---------- Conexão com o Supabase ----------
// A chave PÚBLICA pode ficar no app: quem protege os dados é o login + as travas (RLS).
// NUNCA coloque aqui a chave "secret" / "service_role".
export const SUPABASE_URL = "https://ebbvkmaazyefsysbnvag.supabase.co";
export const SUPABASE_CHAVE_PUBLICA = "sb_publishable_iUUNVitPX8ei2dCT9fV5bA_oDKIx3bC";

// Nome da função que busca as transações na Pluggy (Edge Function)
export const FUNCAO_SINCRONIZAR = "super-responder";

// ---------- Preferências ----------
export const LIMITE_SUPERFLUO = 30;     // % de supérfluo acima do qual aparece o alerta ⚠️
export const GASTOS_VISIVEIS = 15;      // quantos gastos aparecem antes do "Ver todos"

// ---------- Classificações ----------
// "explica" aparece na tela, embaixo de cada nome, para ficar claro o que significa
export const CLASSIFICACOES = {
  prioridade: { nome: "Prioridade",    emoji: "🟢", cor: "var(--cor-prioridade)", explica: "O necessário: mercado, contas, saúde, transporte" },
  superfluo:  { nome: "Supérfluo",     emoji: "🔴", cor: "var(--cor-superfluo)",  explica: "Dava para evitar: delivery, lazer, compras" },
  neutro:     { nome: "Neutro",        emoji: "⚪", cor: "var(--cor-neutro)",     explica: "Nem bom nem ruim: móveis, dinheiro entre suas contas" },
  pendente:   { nome: "A classificar", emoji: "🟡", cor: "var(--cor-pendente)",   explica: "Você ainda não disse o que foi" },
};

// Ordem usada quando você toca na etiqueta para trocar
export const ORDEM_DE_TROCA = ["prioridade", "superfluo", "neutro"];
