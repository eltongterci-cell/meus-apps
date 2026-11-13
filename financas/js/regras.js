// ============================================================
// REGRAS — as "contas" do app
// ------------------------------------------------------------
// Aqui fica a lógica financeira: o que é gasto, o que é
// entrada, como somar o mês, agrupar categorias e parcelas.
// Não fala com o banco e não mexe na tela.
//
// Como os dados chegam do Nubank (via Pluggy):
//   • Conta (BANK) .... negativo = saiu dinheiro | positivo = entrou
//   • Cartão (CREDIT) . positivo = compra        | negativo = pagamento/estorno
//   • "Pagamento de fatura" é ignorado, senão o gasto do cartão
//     seria contado duas vezes (na compra e no pagamento).
// ============================================================

import { mesDeHoje, somarMeses } from "./formato.js";

// ---------- Uma transação ----------

/** Tipo da conta da transação: "BANK" (conta) ou "CREDIT" (cartão) */
function tipoDaConta(transacao, contas) {
  return contas[transacao.conta_id]?.tipo;
}

function ehPagamentoDeFatura(transacao) {
  return (transacao.descricao || "").toLowerCase().startsWith("pagamento de fatura");
}

/** É um gasto? (compra no cartão ou saída da conta) */
export function ehGasto(transacao, contas) {
  if (ehPagamentoDeFatura(transacao)) return false;
  const tipo = tipoDaConta(transacao, contas);
  if (tipo === "CREDIT") return transacao.valor > 0;
  if (tipo === "BANK") return transacao.valor < 0;
  return false;
}

/**
 * É dinheiro SEU entrando na conta?
 * Entradas marcadas como neutro (ex.: dinheiro do ministério, dinheiro
 * entre suas próprias contas) não contam como renda.
 */
export function ehEntrada(transacao, contas) {
  return tipoDaConta(transacao, contas) === "BANK"
    && transacao.valor > 0
    && transacao.classificacao !== "neutro";
}

/** Valor do gasto sempre positivo (ex.: -50 na conta vira 50) */
export function valorDoGasto(transacao, contas) {
  const valor = Number(transacao.valor);
  return tipoDaConta(transacao, contas) === "CREDIT" ? valor : -valor;
}

/** "prioridade", "superfluo", "neutro" ou "pendente" (sem classificação) */
export function classificacaoDe(transacao) {
  return transacao.classificacao || "pendente";
}

/** Nome da categoria em português */
export function categoriaDe(transacao) {
  if (transacao.categoria) return transacao.categoria;
  if ((transacao.categoria_pluggy || "").toLowerCase() === "transfers") return "Pix e transferências";
  return transacao.categoria_pluggy || "Outros";
}

// ---------- As contas agora ----------

/**
 * Situação atual da conta e do cartão.
 * Devolve: { saldoConta, cartaoUsado, cartaoLimite, atualizadoEm }
 */
export function situacaoDasContas(contas) {
  const lista = Object.values(contas);
  const conta = lista.find((c) => c.tipo === "BANK");
  const cartao = lista.find((c) => c.tipo === "CREDIT");
  const datas = lista.map((c) => c.atualizado_em).filter(Boolean).sort();

  return {
    saldoConta: conta ? Number(conta.saldo) : null,
    cartaoUsado: cartao ? Number(cartao.saldo) : null,    // no cartão, o "saldo" é o valor já usado
    cartaoLimite: cartao?.limite ? Number(cartao.limite) : null,
    atualizadoEm: datas[datas.length - 1] || null,
  };
}

// ---------- O mês ----------

/**
 * Resumo de um mês.
 * Devolve: { gastos, totalGastos, totalEntradas, porClassificacao }
 */
export function resumirMes(transacoes, contas, mes) {
  const doMes = transacoes.filter((t) => t.data.slice(0, 7) === mes);
  const gastos = doMes.filter((t) => ehGasto(t, contas));

  const porClassificacao = { prioridade: 0, superfluo: 0, neutro: 0, pendente: 0 };
  let totalGastos = 0;
  for (const t of gastos) {
    const valor = valorDoGasto(t, contas);
    porClassificacao[classificacaoDe(t)] += valor;
    totalGastos += valor;
  }

  const totalEntradas = doMes
    .filter((t) => ehEntrada(t, contas))
    .reduce((soma, t) => soma + Number(t.valor), 0);

  return { gastos, totalGastos, totalEntradas, porClassificacao };
}

/** % de supérfluo, considerando só o que é prioridade ou supérfluo */
export function percentualSuperfluo(porClassificacao) {
  const base = porClassificacao.prioridade + porClassificacao.superfluo;
  return base ? Math.round((porClassificacao.superfluo / base) * 100) : null;
}

/**
 * Agrupa os gastos por categoria, do maior para o menor.
 * Devolve: [{ nome, total, classificacaoPrincipal }]
 */
export function agruparPorCategoria(gastos, contas) {
  const grupos = {};
  for (const t of gastos) {
    const nome = categoriaDe(t);
    const valor = valorDoGasto(t, contas);
    grupos[nome] ??= { nome, total: 0, porClassificacao: {} };
    grupos[nome].total += valor;
    const cls = classificacaoDe(t);
    grupos[nome].porClassificacao[cls] = (grupos[nome].porClassificacao[cls] || 0) + valor;
  }

  return Object.values(grupos)
    .map((g) => ({
      nome: g.nome,
      total: g.total,
      // a cor da categoria é a classificação que mais pesa nela
      classificacaoPrincipal: Object.entries(g.porClassificacao).sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Gastos já marcados para os PRÓXIMOS meses (parcelas futuras).
 * Devolve: [{ mes: "2026-12", total: 1234.5 }]
 */
export function parcelasFuturas(transacoes, contas) {
  const proximoMes = somarMeses(mesDeHoje(), 1);
  const porMes = {};
  for (const t of transacoes) {
    const mes = t.data.slice(0, 7);
    if (mes >= proximoMes && ehGasto(t, contas)) {
      porMes[mes] = (porMes[mes] || 0) + valorDoGasto(t, contas);
    }
  }
  return Object.keys(porMes).sort().map((mes) => ({ mes, total: porMes[mes] }));
}

// ============================================================
// ECONOMIA — contas que ajudam a gastar menos
// ============================================================

/** Supérfluo de um mês, por categoria: { "Roupas": { total, vezes } } */
function superfluoPorCategoria(transacoes, contas, mes) {
  const grupos = {};
  for (const t of transacoes) {
    if (t.data.slice(0, 7) !== mes || !ehGasto(t, contas) || t.classificacao !== "superfluo") continue;
    const nome = categoriaDe(t);
    grupos[nome] ??= { total: 0, vezes: 0 };
    grupos[nome].total += valorDoGasto(t, contas);
    grupos[nome].vezes += 1;
  }
  return grupos;
}

/** Média de supérfluo por mês nos 3 meses anteriores (ignora meses sem dados) */
export function mediaDeSuperfluo(transacoes, contas, mes, meses = 3) {
  const totais = [];
  for (let i = 1; i <= meses; i++) {
    const total = resumirMes(transacoes, contas, somarMeses(mes, -i)).porClassificacao.superfluo;
    if (total > 0) totais.push(total);
  }
  return totais.length ? totais.reduce((a, b) => a + b, 0) / totais.length : 0;
}

/** Sugestão de limite: 20% abaixo da sua média, arredondado de 50 em 50 */
export function sugestaoDeLimite(media) {
  return media ? Math.max(50, Math.round((media * 0.8) / 50) * 50) : 1000;
}

/**
 * Como está o limite de supérfluo no mês.
 * Devolve: { gasto, limite, restante, porcentagem, diasRestantes, porDia }
 */
export function progressoDoLimite(gasto, limite, mes) {
  const restante = limite - gasto;
  let diasRestantes = null;
  if (mes === mesDeHoje()) {
    const hoje = new Date();
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    diasRestantes = ultimoDia - hoje.getDate() + 1;   // conta o dia de hoje
  }
  return {
    gasto,
    limite,
    restante,
    porcentagem: limite ? Math.round((gasto / limite) * 100) : 0,
    diasRestantes,
    porDia: diasRestantes && restante > 0 ? restante / diasRestantes : 0,
  };
}

/**
 * Os supérfluos que mais pesaram no mês, comparados com a média dos 3 meses anteriores.
 * Devolve: [{ nome, total, vezes, media }] (no máximo 4)
 */
export function ondeCortar(transacoes, contas, mes) {
  const doMes = superfluoPorCategoria(transacoes, contas, mes);
  const anteriores = [1, 2, 3].map((i) => superfluoPorCategoria(transacoes, contas, somarMeses(mes, -i)));

  return Object.entries(doMes)
    .map(([nome, g]) => {
      const media = anteriores.reduce((soma, m) => soma + (m[nome]?.total || 0), 0) / anteriores.length;
      return { nome, total: g.total, vezes: g.vezes, media };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
}

/**
 * "Posso comprar?": simula uma compra supérfluo no cartão.
 * Devolve o impacto no limite do mês, nos próximos meses e no cartão.
 */
export function simularCompra({ valor, parcelas }, transacoes, contas, limite, mes) {
  const porParcela = valor / parcelas;
  const superfluoAgora = resumirMes(transacoes, contas, mes).porClassificacao.superfluo;
  const superfluoDepois = superfluoAgora + porParcela;
  const cartao = situacaoDasContas(contas);

  return {
    porParcela,
    superfluoAgora,
    superfluoDepois,
    cabeNoLimite: limite ? superfluoDepois <= limite : null,
    passaEm: limite ? superfluoDepois - limite : 0,
    ultimoMes: somarMeses(mes, parcelas - 1),
    cartaoDepois: cartao.cartaoLimite
      ? Math.round(((cartao.cartaoUsado + valor) / cartao.cartaoLimite) * 100)
      : null,
  };
}

// ============================================================
// LISTA DE PAGAMENTOS — o que pagar primeiro no mês
// ------------------------------------------------------------
// Ordem:
//   1º Essencial ... mantém a casa e a sua renda (aluguel, luz, carro...)
//   2º Dízimo
//   3º Dívidas ..... a de JUROS MAIS ALTO primeiro (é a que mais cresce)
// Um item sai da lista quando:
//   • aparece no extrato (pela "palavra"), ou
//   • você toca em "Paguei".
// Uma dívida some de vez depois da última parcela (termina_em).
// ============================================================

export const GRUPOS = {
  essencial: { ordem: 1, titulo: "1º Essencial",  explica: "Mantém a casa e a sua renda" },
  dizimo:    { ordem: 2, titulo: "2º Dízimo",     explica: "" },
  divida:    { ordem: 3, titulo: "3º Dívidas",    explica: "A de juros mais alto primeiro, porque é a que mais cresce" },
};

/** Quantos meses de "2026-11" até "2027-03" (= 4) */
function mesesEntre(de, ate) {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** Quanto já saiu da conta para este item no mês, procurando a "palavra" no extrato */
function pagoNoExtrato(compromisso, transacoes, contas, mes) {
  if (!compromisso.palavra) return { valor: 0, data: null };
  const palavra = compromisso.palavra.toUpperCase();
  let valor = 0;
  let data = null;
  for (const t of transacoes) {
    if (t.data.slice(0, 7) !== mes || t.valor >= 0) continue;   // só saídas do mês
    if (contas[t.conta_id]?.tipo !== "BANK") continue;           // só da conta
    if (!(t.descricao || "").toUpperCase().includes(palavra)) continue;
    valor += -Number(t.valor);
    if (!data || t.data > data) data = t.data;
  }
  return { valor, data };
}

/** Coloca os itens na ordem de pagamento */
function ordenar(compromissos) {
  return [...compromissos].sort((a, b) =>
    GRUPOS[a.grupo].ordem - GRUPOS[b.grupo].ordem
    || (a.grupo === "divida" ? Number(b.juros_mes || 0) - Number(a.juros_mes || 0) : 0)
    || a.ordem - b.ordem
    || (a.dia || 99) - (b.dia || 99)
    || a.id - b.id);
}

/**
 * Monta a lista do mês.
 * saldo: dinheiro na conta agora (só para o mês atual; senão null).
 * Devolve: { itens, total, pago, falta, qtdPagos, proximo, quantosCabem, faltaParaProximo, quitadas }
 */
export function listaDePagamentos(compromissos, pagamentosManuais, transacoes, contas, mes, saldo) {
  const valeNoMes = compromissos.filter((c) => !c.termina_em || c.termina_em >= mes);
  const quitadas = compromissos.filter((c) => c.grupo === "divida" && c.termina_em && c.termina_em < mes);
  const marcados = new Set(pagamentosManuais.filter((p) => p.mes === mes).map((p) => p.compromisso_id));

  let acumulado = 0;
  let quantosCabem = 0;
  let aindaCabe = saldo !== null;

  const itens = ordenar(valeNoMes).map((c, i) => {
    const valor = Number(c.valor);
    const extrato = pagoNoExtrato(c, transacoes, contas, mes);
    const pagoManual = marcados.has(c.id);
    const pagoPeloExtrato = valor > 0 && extrato.valor >= valor * 0.9; // 90%: a conta pode variar um pouco
    const pago = pagoManual || pagoPeloExtrato;
    const falta = pago ? 0 : Math.max(0, valor - extrato.valor);

    // Com o saldo de agora, dá para pagar este (seguindo a ordem)?
    let cabeNoSaldo = null;
    if (!pago && saldo !== null) {
      acumulado += falta;
      cabeNoSaldo = aindaCabe && acumulado <= saldo;
      if (cabeNoSaldo) quantosCabem++;
      else aindaCabe = false;
    }

    return {
      ...c,
      posicao: i + 1,
      valor,
      pago,
      pagoManual,
      pagoPeloExtrato,
      dataPagamento: extrato.data,
      jaPagou: pago ? valor : extrato.valor,
      falta,
      cabeNoSaldo,
      parcelasRestantes: c.termina_em ? mesesEntre(mes, c.termina_em) + 1 : null,
    };
  });

  const pendentes = itens.filter((i) => !i.pago);
  const proximoSemSaldo = pendentes.find((i) => i.cabeNoSaldo === false);
  const pagoAteAgora = itens.reduce((s, i) => s + Math.min(i.valor, i.jaPagou), 0);
  const total = itens.reduce((s, i) => s + i.valor, 0);

  return {
    itens,
    total,
    pago: pagoAteAgora,
    falta: pendentes.reduce((s, i) => s + i.falta, 0),
    qtdPagos: itens.length - pendentes.length,
    proximo: pendentes[0] || null,
    quantosCabem,
    // quanto falta no saldo para conseguir pagar o primeiro item que não cabe
    faltaParaProximo: proximoSemSaldo && saldo !== null
      ? pendentes.slice(0, pendentes.indexOf(proximoSemSaldo) + 1).reduce((s, i) => s + i.falta, 0) - saldo
      : 0,
    proximoSemSaldo: proximoSemSaldo || null,
    sobraDepoisDeTudo: saldo !== null ? saldo - pendentes.reduce((s, i) => s + i.falta, 0) : null,
    quitadas,
  };
}
