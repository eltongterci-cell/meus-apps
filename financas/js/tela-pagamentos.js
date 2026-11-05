// ============================================================
// TELA — bloco "💸 O que pagar este mês"
// ------------------------------------------------------------
// Mostra suas contas e dívidas na ORDEM em que devem ser pagas.
// Conforme você paga, o item sai da lista e vai para "Pagos".
// As contas são calculadas em regras.js (listaDePagamentos).
// ============================================================

import { dinheiro, dataCurta, nomeDoMes, mesDeHoje, escapar } from "./formato.js";
import { listaDePagamentos, situacaoDasContas, GRUPOS } from "./regras.js";

// ---------- Peças ----------

function cabecalho(titulo, explicacao) {
  return `
    <header class="cartao__cabecalho">
      <h3 class="cartao__titulo">${titulo}</h3>
      <p class="cartao__explica">${explicacao}</p>
    </header>`;
}

/** "2027-03" → "mar/2027" */
function mesCurto(mes) {
  const [ano, numero] = mes.split("-").map(Number);
  const nome = new Date(ano, numero - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${nome}/${ano}`;
}

/** Linha de detalhe embaixo do nome: dia, juros, parcelas */
function detalhesDoItem(item) {
  const partes = [];
  if (item.dia) partes.push(`📅 dia ${item.dia}`);
  if (item.juros_mes) partes.push(`juros ${String(item.juros_mes).replace(".", ",")}% ao mês`);
  if (item.parcelasRestantes) {
    partes.push(item.parcelasRestantes === 1
      ? "🏁 última parcela!"
      : `faltam ${item.parcelasRestantes} parcelas (até ${mesCurto(item.termina_em)})`);
  }
  if (!item.palavra) partes.push("marque à mão quando pagar");
  return partes.join(" · ");
}

// ---------- Item ainda não pago ----------

function itemPendente(item, ehOProximo) {
  let selo = "";
  if (item.cabeNoSaldo === true) selo = `<span class="selo selo--prioridade">cabe no saldo</span>`;
  if (item.cabeNoSaldo === false) selo = `<span class="selo selo--superfluo">sem saldo ainda</span>`;

  const parcial = item.jaPagou > 0
    ? `<div class="linha__detalhe">Já pagou ${dinheiro(item.jaPagou)} de ${dinheiro(item.valor)}</div>`
    : "";

  return `
    <div class="conta ${ehOProximo ? "conta--proxima" : ""}">
      <span class="conta__numero">${item.posicao}</span>
      <div class="linha__info">
        <div class="linha__nome">${escapar(item.nome)}</div>
        <div class="linha__detalhe">${detalhesDoItem(item)}</div>
        ${parcial}
        <div class="conta__acoes">
          <button class="botao botao--paguei" data-acao="pagar" data-id="${item.id}">✓ Paguei</button>
          <button class="botao botao--link" data-acao="editar-compromisso" data-id="${item.id}">Editar</button>
          ${selo}
        </div>
      </div>
      <div class="linha__valor">${dinheiro(item.falta)}</div>
    </div>`;
}

// ---------- Item já pago ----------

function itemPago(item) {
  const como = item.pagoPeloExtrato
    ? `visto no extrato${item.dataPagamento ? " em " + dataCurta(item.dataPagamento) : ""}`
    : "marcado por você";
  const desfazer = item.pagoManual && !item.pagoPeloExtrato
    ? `<button class="botao botao--link" data-acao="desfazer-pagamento" data-id="${item.id}">Desfazer</button>`
    : "";

  return `
    <div class="linha linha--paga">
      <span class="conta__numero conta__numero--pago">✓</span>
      <div class="linha__info">
        <div class="linha__nome">${escapar(item.nome)}</div>
        <div class="linha__detalhe">${como} ${desfazer}</div>
      </div>
      <div class="linha__valor">${dinheiro(item.valor)}</div>
    </div>`;
}

// ---------- Recado sobre o saldo ----------

function recadoDoSaldo(lista, saldo) {
  if (saldo === null || !lista.proximo) return "";

  if (!lista.proximoSemSaldo) {
    return `<div class="alerta etiqueta--prioridade">
      ✅ Seu saldo de agora (${dinheiro(saldo)}) paga tudo o que falta e ainda sobram <b>${dinheiro(lista.sobraDepoisDeTudo)}</b>.
    </div>`;
  }
  if (lista.quantosCabem === 0) {
    return `<div class="alerta etiqueta--superfluo">
      ⚠️ Seu saldo de agora (${dinheiro(saldo)}) ainda não paga o item ${lista.proximoSemSaldo.posicao}.
      Faltam <b>${dinheiro(lista.faltaParaProximo)}</b>. Espere o próximo dinheiro entrar antes de pagar qualquer coisa fora desta ordem.
    </div>`;
  }
  return `<div class="alerta etiqueta--pendente">
    💰 Com o saldo de agora (${dinheiro(saldo)}) dá para pagar <b>${lista.quantosCabem} ${lista.quantosCabem === 1 ? "item" : "itens"}</b>, seguindo a ordem.
    Para pagar também o item ${lista.proximoSemSaldo.posicao} (${escapar(lista.proximoSemSaldo.nome)}) faltam <b>${dinheiro(lista.faltaParaProximo)}</b>.
  </div>`;
}

// ---------- Formulário (adicionar / editar) ----------

function formulario(compromisso, confirmandoRemocao) {
  const c = compromisso || { grupo: "essencial" };
  const novo = !c.id;
  const opcao = (valor, texto) => `<option value="${valor}" ${c.grupo === valor ? "selected" : ""}>${texto}</option>`;
  const numero = (v) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

  return `
    <div class="formulario">
      <h4 class="formulario__titulo">${novo ? "Nova conta ou dívida" : "Editar " + escapar(c.nome)}</h4>

      <label class="rotulo" for="campoCompNome">Nome</label>
      <input class="campo" id="campoCompNome" type="text" value="${escapar(c.nome || "")}" placeholder="Ex.: Empréstimo, Internet...">

      <div class="formulario__linha">
        <div>
          <label class="rotulo" for="campoCompValor">Valor do mês (R$)</label>
          <input class="campo" id="campoCompValor" type="text" inputmode="decimal" value="${numero(c.valor)}" placeholder="Ex.: 150,00">
        </div>
        <div>
          <label class="rotulo" for="campoCompDia">Dia de pagar</label>
          <input class="campo" id="campoCompDia" type="number" inputmode="numeric" min="1" max="31" value="${c.dia ?? ""}" placeholder="Ex.: 10">
        </div>
      </div>

      <label class="rotulo" for="campoCompGrupo">Tipo</label>
      <select class="campo" id="campoCompGrupo">
        ${opcao("essencial", "1º Essencial (casa, contas, carro, mercado)")}
        ${opcao("dizimo", "2º Dízimo")}
        ${opcao("divida", "3º Dívida (cartão, empréstimo, parcelamento)")}
      </select>

      <div class="formulario__linha">
        <div>
          <label class="rotulo" for="campoCompJuros">Juros ao mês (%)</label>
          <input class="campo" id="campoCompJuros" type="text" inputmode="decimal" value="${numero(c.juros_mes)}" placeholder="Só para dívidas">
        </div>
        <div>
          <label class="rotulo" for="campoCompTermina">Última parcela</label>
          <input class="campo" id="campoCompTermina" type="month" value="${c.termina_em || ""}">
        </div>
      </div>

      <label class="rotulo" for="campoCompPalavra">Como aparece no extrato (opcional)</label>
      <input class="campo" id="campoCompPalavra" type="text" value="${escapar(c.palavra || "")}" placeholder="Ex.: EDP ESPIRITO SANTO">
      <p class="cartao__explica">Se preencher, o app marca como pago sozinho quando o pagamento aparecer no Nubank.</p>

      <div class="formulario__botoes">
        <button class="botao botao--acao" data-acao="salvar-compromisso">Salvar</button>
        <button class="botao botao--pequeno" data-acao="cancelar-edicao">Cancelar</button>
        ${novo ? "" : `<button class="botao botao--link botao--perigo" data-acao="remover-compromisso">
          ${confirmandoRemocao ? "Toque de novo para remover" : "Remover da lista"}</button>`}
      </div>
    </div>`;
}

// ---------- O bloco inteiro ----------

export function blocoPagamentos(estado) {
  const { compromissos, pagamentos, transacoes, contas, mes, editandoCompromisso, confirmandoRemocao, mostrarPagos } = estado;
  const explica = "Pague nesta ordem. Conforme você paga, o item sai da lista. Ele sai sozinho quando o pagamento aparece no Nubank, ou na hora quando você toca em ✓ Paguei.";

  // Tabelas ainda não criadas no Supabase
  if (compromissos === null) {
    return `
      <section class="cartao cartao--destaque">
        ${cabecalho("💸 O que pagar este mês", explica)}
        <div class="alerta etiqueta--pendente">
          Falta um passo para ligar esta lista: criar as tabelas no Supabase.
          No computador, peça ao Claude "pode criar as tabelas", ou rode o arquivo
          <b>07-lista-de-pagamentos.sql</b> no SQL Editor.
        </div>
      </section>`;
  }

  const ehMesAtual = mes === mesDeHoje();
  const saldo = ehMesAtual ? situacaoDasContas(contas).saldoConta : null;
  const lista = listaDePagamentos(compromissos, pagamentos, transacoes, contas, mes, saldo);

  // Formulário aberto?
  if (editandoCompromisso) {
    const atual = editandoCompromisso === "novo" ? null : compromissos.find((c) => c.id === editandoCompromisso);
    return `
      <section class="cartao cartao--destaque">
        ${cabecalho("💸 O que pagar este mês", explica)}
        ${formulario(atual, confirmandoRemocao)}
      </section>`;
  }

  // Progresso
  const pct = lista.total ? Math.round((lista.pago / lista.total) * 100) : 0;
  const progresso = `
    <div class="economia__numeros">
      <span><b>${dinheiro(lista.pago)}</b> pagos</span>
      <span>de ${dinheiro(lista.total)}</span>
    </div>
    <div class="barra"><i style="width:${pct}%; background:var(--cor-prioridade)"></i></div>
    <p class="cartao__explica">${lista.qtdPagos} de ${lista.itens.length} pagos · faltam <b>${dinheiro(lista.falta)}</b> em ${nomeDoMes(mes).split(" de ")[0]}</p>`;

  // Itens pendentes, separados por grupo
  const pendentes = lista.itens.filter((i) => !i.pago);
  let htmlPendentes = "";
  for (const [chave, grupo] of Object.entries(GRUPOS)) {
    const doGrupo = pendentes.filter((i) => i.grupo === chave);
    if (!doGrupo.length) continue;
    htmlPendentes += `
      <div class="grupo">
        <div class="grupo__titulo">${grupo.titulo}${grupo.explica ? ` <span>· ${grupo.explica}</span>` : ""}</div>
        ${doGrupo.map((i) => itemPendente(i, i === lista.proximo)).join("")}
      </div>`;
  }
  if (!pendentes.length && lista.itens.length) {
    htmlPendentes = `<div class="alerta etiqueta--prioridade">🎉 Tudo pago neste mês!</div>`;
  }
  if (!lista.itens.length) {
    htmlPendentes = `<p class="cartao__vazio">Nenhuma conta cadastrada. Toque em "+ Adicionar" para começar.</p>`;
  }

  // Próximo a pagar
  const proximo = lista.proximo
    ? `<div class="proximo">👉 Próximo a pagar: <b>${escapar(lista.proximo.nome)}</b>, ${dinheiro(lista.proximo.falta)}</div>`
    : "";

  // Pagos (vão saindo da lista e ficam aqui embaixo)
  const pagos = lista.itens.filter((i) => i.pago);
  const htmlPagos = pagos.length ? `
    <button class="botao botao--link" data-acao="ver-pagos">
      ${mostrarPagos ? "▾" : "▸"} ✅ Já pagos (${pagos.length})
    </button>
    ${mostrarPagos ? pagos.map(itemPago).join("") : ""}` : "";

  // Dívidas quitadas
  const htmlQuitadas = lista.quitadas.length
    ? `<p class="cartao__explica">🎉 Dívidas quitadas: ${lista.quitadas.map((q) => escapar(q.nome)).join(", ")}</p>`
    : "";

  return `
    <section class="cartao cartao--destaque">
      ${cabecalho("💸 O que pagar este mês", explica)}
      ${progresso}
      ${recadoDoSaldo(lista, saldo)}
      ${proximo}
      ${htmlPendentes}
      ${htmlPagos}
      ${htmlQuitadas}
      <button class="botao botao--link" data-acao="novo-compromisso">+ Adicionar conta ou dívida</button>
    </section>`;
}
