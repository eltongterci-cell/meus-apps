// ============================================================
// TELA — desenha os blocos na página
// ------------------------------------------------------------
// A tela é montada de cima para baixo, nesta ordem:
//   0. Como usar (ajuda, abre no botão "?")
//   💸 O que pagar ....... contas e dívidas na ordem certa (tela-pagamentos.js)
//   1. Resumo do mês ..... quanto gastou, entrou e sobrou
//   🎯 Limite de supérfluo  quanto ainda pode gastar por dia
//   ✂️ Onde dá para cortar  supérfluos acima da sua média
//   🛒 Posso comprar? ..... simula uma compra antes de fazer
//   2. Suas contas ....... saldo da conta e uso do cartão
//   3. Para classificar .. Pix que só você sabe o que foi
//   4. Onde foi o dinheiro (categorias)
//   5. Parcelas futuras .. o que já está comprometido
//   6. Todos os gastos do mês
// Cada bloco tem um título e uma frase explicando para que serve.
// ============================================================

import { CLASSIFICACOES, ORDEM_DE_TROCA, LIMITE_SUPERFLUO, GASTOS_VISIVEIS } from "./config.js";
import { dinheiro, dataCurta, dataEHora, nomeDoMes, mesDeHoje, escapar, limparDescricao } from "./formato.js";
import {
  resumirMes, percentualSuperfluo, agruparPorCategoria, parcelasFuturas, situacaoDasContas,
  valorDoGasto, classificacaoDe, categoriaDe,
  mediaDeSuperfluo, sugestaoDeLimite, progressoDoLimite, ondeCortar, simularCompra,
} from "./regras.js";
import { blocoPagamentos } from "./tela-pagamentos.js";

const ORDEM_DA_LEGENDA = ["prioridade", "superfluo", "neutro", "pendente"];

// ---------- Peças pequenas ----------

function etiqueta(classificacao, atributos = "", comEmoji = false) {
  const c = CLASSIFICACOES[classificacao];
  const texto = comEmoji ? `${c.emoji} ${c.nome}` : c.nome;
  return `<button class="etiqueta etiqueta--${classificacao}" ${atributos}>${texto}</button>`;
}

function bolinha(classificacao) {
  return `<span class="bolinha" style="background:${CLASSIFICACOES[classificacao].cor}"></span>`;
}

/** Cabeçalho padrão de cada bloco: título + frase explicando */
function cabecalho(titulo, explicacao, extra = "") {
  return `
    <header class="cartao__cabecalho">
      <h3 class="cartao__titulo">${titulo} ${extra}</h3>
      <p class="cartao__explica">${explicacao}</p>
    </header>`;
}

// ---------- Bloco 0: Como usar ----------

function blocoAjuda() {
  return `
    <section class="cartao cartao--ajuda">
      ${cabecalho("❓ Como usar", "O que fazer para gastar menos:")}
      <ol class="ajuda__passos">
        <li><b>Pague na ordem do 💸 "O que pagar".</b> Primeiro o essencial, depois o dízimo, depois as dívidas.
            Toque em <i>✓ Paguei</i> e o item sai da lista. Ele também sai sozinho quando o pagamento aparece no Nubank.</li>
        <li><b>Defina seu limite de supérfluo</b> no bloco 🎯. O app mostra quanto ainda pode gastar por dia.</li>
        <li><b>Antes de comprar, use o 🛒 "Posso comprar?".</b> Ele mostra se cabe no limite e quanto prende dos próximos meses.</li>
        <li><b>Classifique os Pix.</b> No bloco "Para classificar", toque em 🟢, 🔴 ou ⚪.
            Marque <i>"Sempre classificar assim"</i> e os próximos Pix para a mesma pessoa já entram classificados.</li>
        <li><b>Corrija se precisar.</b> Na lista de gastos, toque na etiqueta colorida para trocar.</li>
        <li><b>Acompanhe o vermelho.</b> Se o supérfluo passar de ${LIMITE_SUPERFLUO}%, o app avisa.</li>
      </ol>
      <p class="cartao__explica">Os dados do Nubank chegam sozinhos todo dia de manhã.
        Para buscar na hora, toque em <b>↻ Atualizar</b>.</p>
      <button class="botao botao--link" data-acao="ajuda">Entendi, fechar</button>
    </section>`;
}

// ---------- Bloco 1: Resumo do mês ----------

function blocoResumo(resumo, mes) {
  const { totalGastos, totalEntradas, porClassificacao } = resumo;
  const sobra = totalEntradas - totalGastos;

  const pedacosDaBarra = ORDEM_DA_LEGENDA
    .filter((k) => totalGastos > 0 && porClassificacao[k] > 0)
    .map((k) => `<i style="width:${(porClassificacao[k] / totalGastos) * 100}%; background:${CLASSIFICACOES[k].cor}"></i>`)
    .join("");

  const legenda = ORDEM_DA_LEGENDA.map((k) => `
    <div class="legenda__item">
      ${bolinha(k)}
      <div class="legenda__texto">
        <span class="legenda__nome">${CLASSIFICACOES[k].nome}</span>
        <span class="legenda__explica">${CLASSIFICACOES[k].explica}</span>
      </div>
      <b class="legenda__valor">${dinheiro(porClassificacao[k])}</b>
    </div>`).join("");

  const pct = percentualSuperfluo(porClassificacao);
  let alerta = "";
  if (pct !== null) {
    const noControle = pct <= LIMITE_SUPERFLUO;
    alerta = `
      <div class="alerta etiqueta--${noControle ? "prioridade" : "superfluo"}">
        ${noControle ? "👍" : "⚠️"} De cada R$ 100 que você gastou (sem contar neutro e a classificar),
        <b>R$ ${pct}</b> foram supérfluos.
        ${noControle ? "Está no controle!" : `O ideal é ficar abaixo de R$ ${LIMITE_SUPERFLUO}. Veja as categorias em vermelho.`}
      </div>`;
  }

  return `
    <section class="cartao">
      ${cabecalho("📊 Resumo do mês", `Tudo o que saiu e entrou em <span style="text-transform:lowercase">${nomeDoMes(mes)}</span>.`)}

      <p class="resumo__frase">Você gastou</p>
      <div class="resumo__total">${dinheiro(totalGastos)}</div>

      <div class="resumo__caixas">
        <div class="resumo__caixa">
          <span>Entrou na conta</span>
          <b>${dinheiro(totalEntradas)}</b>
        </div>
        <div class="resumo__caixa">
          <span>${sobra >= 0 ? "Sobrou" : "Faltou"}</span>
          <b style="color:${sobra >= 0 ? "var(--cor-prioridade)" : "var(--cor-superfluo)"}">${dinheiro(Math.abs(sobra))}</b>
        </div>
      </div>

      <p class="resumo__frase">Como esse dinheiro se divide:</p>
      <div class="barra">${pedacosDaBarra}</div>
      <div class="legenda">${legenda}</div>
      ${alerta}
    </section>`;
}

// ============================================================
// BLOCOS PARA GASTAR MENOS
// ============================================================

// ---------- 🎯 Limite de supérfluo ----------

function blocoLimite(estado, resumo) {
  const { transacoes, contas, mes, metas, editandoLimite } = estado;
  const limite = metas.teto_superfluo;
  const media = mediaDeSuperfluo(transacoes, contas, mes);
  const sugestao = sugestaoDeLimite(media);

  // Ainda não definiu (ou quer mudar): mostra o formulário
  if (!limite || editandoLimite) {
    return `
      <section class="cartao cartao--destaque">
        ${cabecalho("🎯 Seu limite de supérfluo",
          "Quanto você aceita gastar por mês com o que dava para evitar (delivery, roupas, viagens, compras...).")}
        ${media ? `<p class="economia__frase">Nos últimos meses você gastou, em média, <b>${dinheiro(media)}</b> por mês com supérfluo.
          Sugestão: começar com <b>${dinheiro(sugestao)}</b> (20% a menos).</p>` : ""}
        <label class="rotulo" for="campoLimite">Limite por mês (R$)</label>
        <div class="campo-linha">
          <input class="campo" id="campoLimite" type="number" inputmode="decimal" min="0" step="50" value="${limite || sugestao}">
          <button class="botao botao--acao" data-acao="salvar-limite">Salvar</button>
        </div>
      </section>`;
  }

  const p = progressoDoLimite(resumo.porClassificacao.superfluo, limite, mes);
  const cor = p.porcentagem >= 100 ? "var(--cor-superfluo)" : p.porcentagem >= 70 ? "var(--cor-pendente)" : "var(--cor-prioridade)";

  let mensagem;
  if (p.restante < 0) {
    mensagem = `❌ Você passou <b>${dinheiro(-p.restante)}</b> do limite. Segure os gastos supérfluos até o mês que vem.`;
  } else if (p.diasRestantes) {
    mensagem = `✅ Ainda pode gastar <b>${dinheiro(p.restante)}</b> com supérfluo este mês.
      Isso dá <b>${dinheiro(p.porDia)} por dia</b> até o fim do mês (${p.diasRestantes} ${p.diasRestantes === 1 ? "dia" : "dias"}).`;
  } else {
    mensagem = `✅ Ficou <b>${dinheiro(p.restante)}</b> abaixo do limite neste mês.`;
  }

  return `
    <section class="cartao cartao--destaque">
      ${cabecalho("🎯 Limite de supérfluo do mês", "Inclui as parcelas de compras antigas que caem neste mês.")}
      <div class="economia__numeros">
        <span><b>${dinheiro(p.gasto)}</b> gastos</span>
        <span>de ${dinheiro(limite)}</span>
      </div>
      <div class="barra"><i style="width:${Math.min(100, p.porcentagem)}%; background:${cor}"></i></div>
      <p class="economia__frase">${mensagem}</p>
      <button class="botao botao--link" data-acao="editar-limite">Mudar limite</button>
    </section>`;
}

// ---------- ✂️ Onde dá para cortar ----------

function blocoOndeCortar(transacoes, contas, mes) {
  const lista = ondeCortar(transacoes, contas, mes);
  if (!lista.length) return "";

  const linhas = lista.map((c) => {
    let selo = "";
    if (c.media > 0 && c.total > c.media * 1.3) {
      const vezesMais = (c.total / c.media).toFixed(1).replace(".", ",");
      selo = `<span class="selo selo--superfluo">↑ ${vezesMais}x sua média</span>`;
    } else if (c.media > 0 && c.total < c.media * 0.8) {
      selo = `<span class="selo selo--prioridade">↓ abaixo da média</span>`;
    }
    const gotas = c.vezes >= 8 ? ` · ${c.vezes} compras pequenas que somam` : ` · ${c.vezes} ${c.vezes === 1 ? "vez" : "vezes"}`;

    return `
      <div class="linha">
        <div class="linha__info">
          <div class="linha__nome">${escapar(c.nome)} ${selo}</div>
          <div class="linha__detalhe">Média: ${dinheiro(c.media)}/mês${gotas}</div>
        </div>
        <div class="linha__valor">${dinheiro(c.total)}</div>
      </div>`;
  }).join("");

  return `
    <section class="cartao">
      ${cabecalho("✂️ Onde dá para cortar",
        "Os supérfluos que mais pesaram neste mês, comparados com a sua média dos 3 meses anteriores. Comece pelo primeiro da lista.")}
      ${linhas}
    </section>`;
}

// ---------- 🛒 Posso comprar? ----------

function blocoPossoComprar(estado) {
  const { transacoes, contas, mes, metas, simulacao } = estado;
  if (mes !== mesDeHoje()) return ""; // só faz sentido no mês atual

  const opcoesParcelas = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${simulacao?.parcelas === n ? "selected" : ""}>${n === 1 ? "À vista" : `${n}x`}</option>`)
    .join("");

  let resultado = "";
  if (simulacao) {
    const r = simularCompra(simulacao, transacoes, contas, metas.teto_superfluo, mes);
    const linhas = [];

    if (r.cabeNoLimite === null) {
      linhas.push(`Seu supérfluo do mês iria de ${dinheiro(r.superfluoAgora)} para <b>${dinheiro(r.superfluoDepois)}</b>. Defina um limite acima para saber se cabe.`);
    } else if (r.cabeNoLimite) {
      linhas.push(`✅ <b>Cabe no seu limite.</b> Seu supérfluo do mês iria para ${dinheiro(r.superfluoDepois)} de ${dinheiro(metas.teto_superfluo)}.`);
    } else {
      linhas.push(`❌ <b>Passa do seu limite em ${dinheiro(r.passaEm)}.</b> Se puder, espere o mês que vem ou corte outro supérfluo antes.`);
    }
    if (simulacao.parcelas > 1) {
      linhas.push(`📅 Você ficaria pagando <b>${dinheiro(r.porParcela)} por mês</b> até <span style="text-transform:lowercase">${nomeDoMes(r.ultimoMes)}</span>.`);
    }
    if (r.cartaoDepois !== null) {
      linhas.push(`💳 O cartão ficaria com <b>${r.cartaoDepois}% do limite</b> usado${r.cartaoDepois > 80 ? " (perigo: acima de 80%)" : ""}.`);
    }
    resultado = `
      <div class="simulacao ${r.cabeNoLimite === false ? "etiqueta--superfluo" : "etiqueta--prioridade"}">
        ${linhas.map((l) => `<p>${l}</p>`).join("")}
      </div>
      <button class="botao botao--link" data-acao="limpar-simulacao">Limpar</button>`;
  }

  return `
    <section class="cartao">
      ${cabecalho("🛒 Posso comprar?", "Antes de comprar algo que não é necessário, veja aqui o impacto no seu mês.")}
      <div class="simulador">
        <div class="simulador__campo">
          <label class="rotulo" for="campoCompraValor">Valor (R$)</label>
          <input class="campo" id="campoCompraValor" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Ex.: 250" value="${simulacao?.valor ?? ""}">
        </div>
        <div class="simulador__campo">
          <label class="rotulo" for="campoCompraParcelas">Pagamento</label>
          <select class="campo" id="campoCompraParcelas">${opcoesParcelas}</select>
        </div>
      </div>
      <button class="botao botao--principal" data-acao="simular">Ver impacto</button>
      ${resultado}
    </section>`;
}

// ---------- Bloco 2: Suas contas agora ----------

function blocoContas(contas) {
  const s = situacaoDasContas(contas);
  if (s.saldoConta === null && s.cartaoUsado === null) return "";

  let cartao = "";
  if (s.cartaoUsado !== null) {
    const pctUsado = s.cartaoLimite ? Math.min(100, Math.round((s.cartaoUsado / s.cartaoLimite) * 100)) : null;
    const cor = pctUsado !== null && pctUsado > 70 ? "var(--cor-superfluo)" : "var(--cor-destaque)";
    cartao = `
      <div class="linha">
        <div class="linha__info">
          <div class="linha__nome">💳 Cartão de crédito</div>
          <div class="linha__detalhe">${pctUsado !== null ? `${pctUsado}% do limite de ${dinheiro(s.cartaoLimite)} já usado` : "Valor já usado do limite"}</div>
          ${pctUsado !== null ? `<div class="barra barra--fina"><i style="width:${pctUsado}%; background:${cor}"></i></div>` : ""}
        </div>
        <div class="linha__valor">${dinheiro(s.cartaoUsado)}</div>
      </div>`;
  }

  return `
    <section class="cartao">
      ${cabecalho("🏦 Suas contas agora", s.atualizadoEm ? `Atualizado em ${dataEHora(s.atualizadoEm)}.` : "Saldo atual do Nubank.")}
      ${s.saldoConta !== null ? `
        <div class="linha">
          <div class="linha__info">
            <div class="linha__nome">💰 Saldo na conta</div>
            <div class="linha__detalhe">Dinheiro disponível agora</div>
          </div>
          <div class="linha__valor">${dinheiro(s.saldoConta)}</div>
        </div>` : ""}
      ${cartao}
    </section>`;
}

// ---------- Bloco 3: Para classificar ----------

function blocoAClassificar(gastos, contas) {
  const pendentes = gastos
    .filter((t) => !t.classificacao)
    .sort((a, b) => valorDoGasto(b, contas) - valorDoGasto(a, contas));

  const itens = pendentes.map((t) => {
    const { titulo, detalhe } = limparDescricao(t.descricao);
    const id = escapar(t.id);
    const botoes = ORDEM_DE_TROCA
      .map((c) => etiqueta(c, `data-acao="classificar" data-id="${id}" data-classificacao="${c}"`, true))
      .join("");

    return `
      <div class="pendente">
        <div class="pendente__topo">
          <div class="linha__info">
            <div class="linha__nome">${escapar(titulo)}</div>
            <div class="linha__detalhe">${dataCurta(t.data)}${detalhe ? " · " + escapar(detalhe) : ""}</div>
          </div>
          <div class="linha__valor">${dinheiro(valorDoGasto(t, contas))}</div>
        </div>
        <div class="pendente__acoes">${botoes}</div>
        <label class="pendente__lembrar">
          <input type="checkbox" data-lembrar="${id}">
          Sempre classificar assim os pagamentos para <b>${escapar(titulo)}</b>
        </label>
      </div>`;
  }).join("");

  return `
    <section class="cartao">
      ${cabecalho(
        "🟡 Para classificar",
        "Pix e transferências não dizem o que foram. Toque em uma cor para cada um:",
        `<small>${pendentes.length}</small>`
      )}
      ${itens || `<p class="cartao__vazio">Tudo classificado neste mês. 🎉</p>`}
    </section>`;
}

// ---------- Bloco 4: Onde foi o dinheiro ----------

function blocoCategorias(gastos, contas) {
  const categorias = agruparPorCategoria(gastos, contas);
  const maior = categorias[0]?.total || 1;

  const linhas = categorias.map((c) => {
    const cor = CLASSIFICACOES[c.classificacaoPrincipal].cor;
    return `
      <div class="linha">
        ${bolinha(c.classificacaoPrincipal)}
        <div class="linha__info">
          <div class="linha__nome">${escapar(c.nome)}</div>
          <div class="barra barra--fina"><i style="width:${(c.total / maior) * 100}%; background:${cor}"></i></div>
        </div>
        <div class="linha__valor">${dinheiro(c.total)}</div>
      </div>`;
  }).join("");

  return `
    <section class="cartao">
      ${cabecalho("🧾 Onde foi o dinheiro", "Seus gastos do mês agrupados, do maior para o menor. A cor mostra se é prioridade ou supérfluo.")}
      ${linhas || `<p class="cartao__vazio">Nenhum gasto neste mês.</p>`}
    </section>`;
}

// ---------- Bloco 5: Parcelas futuras ----------

function blocoParcelas(transacoes, contas) {
  const meses = parcelasFuturas(transacoes, contas);
  if (!meses.length) return "";

  const linhas = meses.map((m) => `
    <div class="linha">
      <div class="linha__info"><div class="linha__nome" style="text-transform:capitalize">${nomeDoMes(m.mes)}</div></div>
      <div class="linha__valor">${dinheiro(m.total)}</div>
    </div>`).join("");

  return `
    <section class="cartao">
      ${cabecalho("📅 Já comprometido", "Parcelas de compras antigas que ainda vão cair no cartão nos próximos meses.")}
      ${linhas}
    </section>`;
}

// ---------- Bloco 6: Todos os gastos do mês ----------

function blocoListaDeGastos(gastos, contas, mostrarTodos) {
  const ordenados = [...gastos].sort((a, b) => (a.data < b.data ? 1 : -1));
  const visiveis = mostrarTodos ? ordenados : ordenados.slice(0, GASTOS_VISIVEIS);

  const linhas = visiveis.map((t) => {
    const { titulo } = limparDescricao(t.descricao);
    return `
      <div class="linha">
        <div class="linha__info">
          <div class="linha__nome">${escapar(titulo)}</div>
          <div class="linha__detalhe">${dataCurta(t.data)} · ${escapar(categoriaDe(t))}</div>
        </div>
        <div class="linha__direita">
          <div class="linha__valor">${dinheiro(valorDoGasto(t, contas))}</div>
          ${etiqueta(classificacaoDe(t), `data-acao="trocar" data-id="${escapar(t.id)}"`)}
        </div>
      </div>`;
  }).join("");

  const botaoVerTodos = ordenados.length > GASTOS_VISIVEIS
    ? `<button class="botao botao--link" data-acao="ver-todos">${mostrarTodos ? "Mostrar menos" : `Ver todos os ${ordenados.length} gastos`}</button>`
    : "";

  return `
    <section class="cartao">
      ${cabecalho("📋 Todos os gastos do mês", "Do mais recente para o mais antigo. Classificou errado? Toque na etiqueta colorida para trocar.")}
      ${linhas || `<p class="cartao__vazio">Nenhum gasto neste mês.</p>`}
      ${botaoVerTodos}
    </section>`;
}

// ---------- Junta tudo ----------

/** Desenha a tela inteira a partir do estado atual do app */
export function desenharTela(estado) {
  const { transacoes, contas, mes, mostrarTodos, mostrarAjuda } = estado;
  const resumo = resumirMes(transacoes, contas, mes);

  document.getElementById("nomeDoMes").textContent = nomeDoMes(mes);
  document.getElementById("conteudo").innerHTML =
    (mostrarAjuda ? blocoAjuda() : "") +
    blocoPagamentos(estado) +                // 💸 o que pagar primeiro
    blocoResumo(resumo, mes) +
    blocoLimite(estado, resumo) +            // 🎯 para gastar menos
    blocoOndeCortar(transacoes, contas, mes) + // ✂️
    blocoPossoComprar(estado) +              // 🛒
    blocoContas(contas) +
    blocoAClassificar(resumo.gastos, contas) +
    blocoCategorias(resumo.gastos, contas) +
    blocoParcelas(transacoes, contas) +
    blocoListaDeGastos(resumo.gastos, contas, mostrarTodos);
}

// ---------- Mensagens e troca de telas ----------

export function mostrarCarregando() {
  document.getElementById("conteudo").innerHTML = `<p class="carregando">Carregando…</p>`;
}

export function mostrarErro(erro) {
  document.getElementById("conteudo").innerHTML = `
    <section class="cartao">
      <b>Não consegui carregar seus dados.</b>
      <p class="cartao__explica">${escapar(erro.message || erro)}</p>
      <p class="cartao__explica">Verifique a internet e tente de novo. Se continuar, toque em Sair e entre de novo.</p>
    </section>`;
}

/** Aviso rápido embaixo da tela (some sozinho) */
export function avisar(mensagem) {
  const aviso = document.getElementById("aviso");
  aviso.textContent = mensagem;
  aviso.classList.add("aviso--visivel");
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => aviso.classList.remove("aviso--visivel"), 3000);
}

export function mostrarTelaLogin() {
  document.getElementById("telaApp").classList.add("escondido");
  document.getElementById("telaLogin").classList.remove("escondido");
}

export function mostrarTelaApp() {
  document.getElementById("telaLogin").classList.add("escondido");
  document.getElementById("telaApp").classList.remove("escondido");
}
