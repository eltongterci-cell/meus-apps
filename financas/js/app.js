// ============================================================
// APP — o "maestro"
// ------------------------------------------------------------
// Liga tudo: guarda o estado, responde aos cliques,
// chama o banco (dados.js) e redesenha a tela (tela.js).
//
// Fluxo:
//   1. Abriu o app → já está logado? → carrega os dados
//                  → não está?       → mostra o login
//   2. Clique em algum botão → faz a ação → redesenha
// ============================================================

import { ORDEM_DE_TROCA, CLASSIFICACOES } from "./config.js";
import { mesDeHoje, somarMeses } from "./formato.js";
import * as dados from "./dados.js";
import * as tela from "./tela.js";
import { baixarPlanilha } from "./exportar.js";

// ---------- Estado: tudo que o app "lembra" enquanto está aberto ----------
const estado = {
  usuario: null,         // quem está logado
  contas: {},            // conta corrente e cartão
  transacoes: [],        // todas as transações
  mes: mesDeHoje(),      // mês que está na tela ("2026-11")
  mostrarTodos: false,   // lista de gastos aberta ou resumida
  mostrarAjuda: primeiraVez(), // "Como usar" aparece sozinho só na primeira vez
  metas: {},             // { teto_superfluo: 2500 }
  editandoLimite: false, // formulário do limite aberto?
  simulacao: null,       // última simulação do "Posso comprar?" { valor, parcelas }

  // 💸 Lista de pagamentos
  compromissos: [],          // contas e dívidas (null = tabela ainda não criada)
  pagamentos: [],            // o que você marcou como "Paguei" [{ compromisso_id, mes }]
  editandoCompromisso: null, // id do item no formulário, "novo" ou null
  confirmandoRemocao: false, // 1º toque em "Remover" pede confirmação
  mostrarPagos: false,       // lista "Já pagos" aberta?
};

/** É a primeira vez que este celular abre o app? (lembra no próprio aparelho) */
function primeiraVez() {
  try {
    if (localStorage.getItem("financas.ajudaVista")) return false;
    localStorage.setItem("financas.ajudaVista", "sim");
    return true;
  } catch {
    return false; // navegador sem memória local: não mostra
  }
}

// ---------- Carregar e desenhar ----------

async function carregarDados() {
  tela.mostrarCarregando();
  try {
    estado.contas = await dados.buscarContas();
    estado.transacoes = await dados.buscarTransacoes();
    estado.metas = await dados.buscarMetas();
    estado.compromissos = await dados.buscarCompromissos();
    estado.pagamentos = await dados.buscarPagamentosManuais();
    tela.desenharTela(estado);
  } catch (erro) {
    tela.mostrarErro(erro);
  }
}

function redesenhar() {
  tela.desenharTela(estado);
}

// ---------- Ações ----------

/** Classifica uma transação. Se "lembrar", cria regra e aplica nas iguais. */
async function classificar(id, classificacao, lembrar) {
  const transacao = estado.transacoes.find((t) => t.id === id);
  if (!transacao) return;

  // Transações que vão mudar: esta + (se lembrar) as iguais ainda sem classificação
  const alvos = lembrar
    ? estado.transacoes.filter((t) => t.id === id || (!t.classificacao && t.descricao === transacao.descricao))
    : [transacao];

  try {
    await dados.salvarClassificacao(alvos.map((t) => t.id), classificacao);
    alvos.forEach((t) => (t.classificacao = classificacao));

    const { emoji, nome } = CLASSIFICACOES[classificacao];
    if (lembrar) {
      await dados.salvarRegra(estado.usuario.id, transacao.descricao, classificacao);
      tela.avisar(`${emoji} Regra salva: os próximos iguais já entram como ${nome}`);
    } else {
      tela.avisar(`${emoji} ${nome}`);
    }
  } catch (erro) {
    tela.avisar("Erro ao salvar: " + erro.message);
  }
  redesenhar();
}

/** Toque na etiqueta: Prioridade → Supérfluo → Neutro → Prioridade... */
function trocarClassificacao(id) {
  const transacao = estado.transacoes.find((t) => t.id === id);
  const posicao = ORDEM_DE_TROCA.indexOf(transacao.classificacao);
  const proxima = ORDEM_DE_TROCA[(posicao + 1) % ORDEM_DE_TROCA.length];
  classificar(id, proxima, false);
}

/** Botão ↻ Atualizar: busca novidades no Nubank e recarrega */
async function atualizarDoNubank(botao) {
  botao.disabled = true;
  botao.textContent = "Atualizando…";
  try {
    const resultado = await dados.sincronizarNubank();
    tela.avisar(`✅ Atualizado: ${resultado.transacoes} transações conferidas`);
    await carregarDados();
  } catch (erro) {
    tela.avisar("Não consegui atualizar agora: " + erro.message);
  } finally {
    botao.disabled = false;
    botao.textContent = "↻ Atualizar";
  }
}

/** Salva o limite mensal de supérfluo digitado */
async function salvarLimite() {
  const valor = Number(document.getElementById("campoLimite").value);
  if (!valor || valor <= 0) return tela.avisar("Digite um valor maior que zero.");
  await dados.salvarMeta(estado.usuario.id, "teto_superfluo", valor);
  estado.metas.teto_superfluo = valor;
  estado.editandoLimite = false;
  tela.avisar("🎯 Limite salvo");
  redesenhar();
}

/** "Posso comprar?": lê o valor e as parcelas e mostra o impacto */
function simular() {
  const valor = Number(document.getElementById("campoCompraValor").value);
  const parcelas = Number(document.getElementById("campoCompraParcelas").value) || 1;
  if (!valor || valor <= 0) return tela.avisar("Digite o valor da compra.");
  estado.simulacao = { valor, parcelas };
  redesenhar();
}

// ---------- 💸 Lista de pagamentos ----------

/**
 * Lê um número digitado com vírgula ou ponto. Vazio → null.
 * "11,99" → 11.99 · "1.447,32" → 1447.32 · "150.50" → 150.5
 */
function numeroDoCampo(id) {
  let texto = document.getElementById(id).value.trim();
  if (!texto) return null;
  // Com vírgula: os pontos são de milhar. Sem vírgula: o ponto é o decimal.
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : NaN;
}

/** Botão "✓ Paguei" */
async function pagar(id) {
  try {
    await dados.marcarPago(estado.usuario.id, id, estado.mes);
    estado.pagamentos.push({ compromisso_id: id, mes: estado.mes });
    const item = estado.compromissos.find((c) => c.id === id);
    tela.avisar(`✅ ${item?.nome || "Conta"} paga. Saiu da lista.`);
  } catch (erro) {
    tela.avisar("Não consegui salvar: " + erro.message);
  }
  redesenhar();
}

/** Botão "Desfazer" (só para o que você marcou à mão) */
async function desfazerPagamento(id) {
  try {
    await dados.desmarcarPago(id, estado.mes);
    estado.pagamentos = estado.pagamentos.filter((p) => !(p.compromisso_id === id && p.mes === estado.mes));
    tela.avisar("↩ Voltou para a lista");
  } catch (erro) {
    tela.avisar("Não consegui desfazer: " + erro.message);
  }
  redesenhar();
}

/** Botão "Salvar" do formulário */
async function salvarCompromisso() {
  const nome = document.getElementById("campoCompNome").value.trim();
  const valor = numeroDoCampo("campoCompValor");
  const juros = numeroDoCampo("campoCompJuros");
  const diaTexto = document.getElementById("campoCompDia").value;
  const dia = diaTexto ? Number(diaTexto) : null;

  if (!nome) return tela.avisar("Digite o nome da conta.");
  if (valor === null || Number.isNaN(valor) || valor < 0) return tela.avisar("Digite o valor do mês. Ex.: 150,00");
  if (Number.isNaN(juros)) return tela.avisar("Juros: use só números. Ex.: 11,99");
  if (dia !== null && (dia < 1 || dia > 31)) return tela.avisar("O dia precisa ser de 1 a 31.");

  const editando = estado.editandoCompromisso !== "novo" ? estado.editandoCompromisso : null;
  const atual = estado.compromissos.find((c) => c.id === editando);
  const compromisso = {
    ...(editando ? { id: editando } : {}),
    nome,
    valor,
    dia,
    grupo: document.getElementById("campoCompGrupo").value,
    juros_mes: juros,
    termina_em: document.getElementById("campoCompTermina").value || null,
    palavra: document.getElementById("campoCompPalavra").value.trim() || null,
    ordem: atual?.ordem ?? 99, // novos entram no fim do grupo
  };

  try {
    await dados.salvarCompromisso(estado.usuario.id, compromisso);
    estado.compromissos = await dados.buscarCompromissos();
    estado.editandoCompromisso = null;
    tela.avisar("💾 Salvo");
  } catch (erro) {
    tela.avisar("Não consegui salvar: " + erro.message);
  }
  redesenhar();
}

/** Botão "Remover da lista" (pede um segundo toque para confirmar) */
async function removerCompromisso() {
  if (!estado.confirmandoRemocao) {
    estado.confirmandoRemocao = true;
    return redesenhar();
  }
  try {
    await dados.removerCompromisso(estado.editandoCompromisso);
    estado.compromissos = estado.compromissos.filter((c) => c.id !== estado.editandoCompromisso);
    estado.editandoCompromisso = null;
    tela.avisar("🗑 Removido da lista");
  } catch (erro) {
    tela.avisar("Não consegui remover: " + erro.message);
  }
  estado.confirmandoRemocao = false;
  redesenhar();
}

function abrirFormulario(id) {
  estado.editandoCompromisso = id;
  estado.confirmandoRemocao = false;
  redesenhar();
}

// ---------- Cliques ----------
// Todo botão tem um data-acao="..." no HTML. Aqui cada ação vira uma função.

const acoes = {
  "mes-anterior": () => { estado.mes = somarMeses(estado.mes, -1); estado.mostrarTodos = false; redesenhar(); },
  "mes-seguinte": () => { estado.mes = somarMeses(estado.mes, 1); estado.mostrarTodos = false; redesenhar(); },
  "ver-todos":    () => { estado.mostrarTodos = !estado.mostrarTodos; redesenhar(); },
  // 💸 Lista de pagamentos
  "pagar":               (botao) => pagar(Number(botao.dataset.id)),
  "desfazer-pagamento":  (botao) => desfazerPagamento(Number(botao.dataset.id)),
  "editar-compromisso":  (botao) => abrirFormulario(Number(botao.dataset.id)),
  "novo-compromisso":    () => abrirFormulario("novo"),
  "salvar-compromisso":  () => salvarCompromisso(),
  "remover-compromisso": () => removerCompromisso(),
  "cancelar-edicao":     () => { estado.editandoCompromisso = null; estado.confirmandoRemocao = false; redesenhar(); },
  "ver-pagos":           () => { estado.mostrarPagos = !estado.mostrarPagos; redesenhar(); },

  "salvar-limite":    () => salvarLimite(),
  "editar-limite":    () => { estado.editandoLimite = true; redesenhar(); },
  "simular":          () => simular(),
  "limpar-simulacao": () => { estado.simulacao = null; redesenhar(); },
  "ajuda":        () => { estado.mostrarAjuda = !estado.mostrarAjuda; redesenhar(); window.scrollTo({ top: 0, behavior: "smooth" }); },
  "atualizar":    (botao) => atualizarDoNubank(botao),
  "baixar":       () => {
    if (!estado.transacoes.length) return tela.avisar("Ainda não há transações para baixar.");
    baixarPlanilha(estado.transacoes, estado.contas);
    tela.avisar(`⬇ Planilha com ${estado.transacoes.length} transações baixada`);
  },
  "sair":         async () => { await dados.sair(); location.reload(); },
  "trocar":       (botao) => trocarClassificacao(botao.dataset.id),
  "classificar":  (botao) => {
    const caixinha = document.querySelector(`[data-lembrar="${CSS.escape(botao.dataset.id)}"]`);
    classificar(botao.dataset.id, botao.dataset.classificacao, caixinha?.checked);
  },
};

document.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-acao]");
  if (botao) acoes[botao.dataset.acao]?.(botao);
});

// ---------- Login ----------

document.getElementById("formLogin").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = document.getElementById("botaoEntrar");
  const erro = document.getElementById("erroLogin");

  botao.disabled = true;
  erro.textContent = "";
  try {
    const email = document.getElementById("campoEmail").value.trim();
    const senha = document.getElementById("campoSenha").value;
    estado.usuario = await dados.entrar(email, senha);
    tela.mostrarTelaApp();
    carregarDados();
  } catch {
    erro.textContent = "E-mail ou senha incorretos.";
  } finally {
    botao.disabled = false;
  }
});

// ---------- Início ----------

async function iniciar() {
  estado.usuario = await dados.usuarioLogado();
  if (estado.usuario) {
    tela.mostrarTelaApp();
    carregarDados();
  } else {
    tela.mostrarTelaLogin();
  }
}

iniciar();
