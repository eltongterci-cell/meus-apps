/* =========================================================
   QUIZ DOS SERVOS · fluxo: início → perguntas → análise → revelação
   ========================================================= */
(() => {
  const { $, $$, esc, digits, nomeBonito, firstName, rpc, EMOJI, SETORES, vibrate, confetti, embers } = FNV;

  const PERGUNTAS = CONFIG.perguntas;

  const state = { nome: "", zap: "", i: 0, respostas: [], resultado: null, numero: null, travado: false };

  /* Lembra no aparelho quem já respondeu, para voltar direto ao resultado */
  const MEMO = "fnv_servo";
  const lembrar = () => { try { localStorage.setItem(MEMO, JSON.stringify({ nome: state.nome, zap: state.zap })); } catch (e) {} };
  const lembrado = () => { try { return JSON.parse(localStorage.getItem(MEMO) || "null"); } catch (e) { return null; } };
  const esquecer = () => { try { localStorage.removeItem(MEMO); } catch (e) {} };

  function mostrar(id) {
    $$(".screen").forEach(s => s.classList.toggle("is-on", s.id === id));
    scrollTo(0, 0);
  }

  /* ---------- INÍCIO ---------- */
  $("#zap").addEventListener("input", e => {
    const d = digits(e.target.value).slice(0, 11);
    e.target.value = d.length > 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });
  $("#nome").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#zap").focus(); } });

  $("#f-start").addEventListener("submit", async e => {
    e.preventDefault();
    const nome = nomeBonito($("#nome").value);
    const zap = digits($("#zap").value);
    if (nome.length < 3) return erro("Coloca seu nome, por favor 😉", "#nome");
    if (zap.length < 10) return erro("Confere seu WhatsApp com DDD", "#zap");
    $("#err").textContent = "";
    Object.assign(state, { nome, zap, i: 0, respostas: [] });
    document.activeElement.blur(); vibrate(20);

    // cada número responde uma vez só: se já respondeu, vai direto ao resultado
    const btn = $("#f-start button[type=submit]"), txt = btn.textContent;
    btn.disabled = true; btn.textContent = "Verificando...";
    let r = null;
    try { r = await rpc("fnv_consultar", { p_whatsapp: zap }); }
    catch (err) { btn.disabled = false; btn.textContent = txt; return erro("A internet falhou. Tenta de novo?", "#zap"); }
    btn.disabled = false; btn.textContent = txt;
    if (r && r.respondeu) { state.nome = r.nome || nome; lembrar(); return mostrarResultado(r, true); }
    montarSegmentos(); mostrar("s-quiz"); renderPergunta();
  });
  function erro(msg, campo) { $("#err").textContent = msg; $(campo).focus(); }

  /* ---------- PERGUNTAS ---------- */
  function montarSegmentos() { $("#segments").innerHTML = PERGUNTAS.map(() => "<i></i>").join(""); }
  function atualizarSegmentos() {
    $$("#segments i").forEach((s, k) => { s.className = k < state.i ? "is-done" : k === state.i ? "is-now" : ""; });
  }

  function renderPergunta() {
    const [titulo, opcoes] = PERGUNTAS[state.i];
    atualizarSegmentos();
    const box = $("#question");
    box.className = "question";
    box.innerHTML = `
      <span class="eyebrow">Pergunta ${state.i + 1} de ${PERGUNTAS.length}</span>
      <h2 class="q-title">${esc(titulo)}</h2>
      <div class="options">${opcoes.map((o, k) => `
        <button class="option${state.respostas[state.i] === o[1] ? " is-picked" : ""}" data-k="${k}">
          <span class="emoji" aria-hidden="true">${o[0]}</span><span>${esc(o[1])}</span>
        </button>`).join("")}
      </div>
      <p class="q-hint">Toque na que mais combina com você</p>`;
    $$(".option", box).forEach(b => b.addEventListener("click", () => escolher(b, opcoes[b.dataset.k][1])));
  }

  function escolher(botao, valor) {
    if (state.travado) return;
    state.travado = true; vibrate(15);
    $$(".option").forEach(o => o.classList.remove("is-picked"));
    botao.classList.add("is-picked");
    state.respostas[state.i] = valor;
    setTimeout(() => {
      $("#question").classList.add("is-out");
      setTimeout(() => {
        state.travado = false;
        if (state.i < PERGUNTAS.length - 1) { state.i++; renderPergunta(); } else finalizar();
      }, 240);
    }, 300);
  }

  $("#back").addEventListener("click", () => {
    if (state.travado) return;
    if (state.i === 0) return mostrar("s-start");
    state.i--; renderPergunta();
  });

  /* ---------- ANÁLISE ---------- */
  async function finalizar() {
    mostrar("s-think");
    const frases = ["Analisando suas respostas...", "Lendo seu perfil de servo...", "Consultando a liderança...", "Encontrando seu lugar..."];
    let f = 0, k = 0;
    const tFrase = setInterval(() => { f = (f + 1) % frases.length; $("#think-text").textContent = frases[f]; }, 1100);
    const tSlot = setInterval(() => { $("#slot").textContent = SETORES[k++ % SETORES.length]; }, 90);
    const inicio = Date.now();

    let res;
    try { res = await rpc("fnv_revelar", { p_nome: state.nome, p_whatsapp: state.zap, p_respostas: state.respostas }); }
    catch (e) { res = { falhou: true }; }

    setTimeout(() => {
      clearInterval(tFrase); clearInterval(tSlot);
      if (res.falhou) { FNV.toast("A internet falhou. Tenta de novo?"); return mostrar("s-quiz"); }
      lembrar();
      if (!res.encontrado) return aguardando(false);
      // roleta desacelerando até o setor
      let atraso = 90, giros = 0;
      (function girar() {
        $("#slot").textContent = SETORES[k++ % SETORES.length]; vibrate(8);
        atraso *= 1.22;
        if (++giros < 9) return setTimeout(girar, atraso);
        $("#slot").textContent = res.setor; $("#think-text").textContent = "Encontramos! 🔥";
        setTimeout(() => revelar(res), 700);
      })();
    }, Math.max(0, 4200 - (Date.now() - inicio)));
  }

  function aguardando(voltou) {
    $("#w-first").textContent = firstName(state.nome);
    if (voltou) $("#w-msg").textContent = "Você já respondeu o quiz. Seu setor ainda está sendo finalizado pela liderança e será revelado em breve.";
    $("#reveal").hidden = true; $("#waiting").hidden = false;
    mostrar("s-reveal");
  }

  /* Resultado de quem já tinha respondido */
  function mostrarResultado(r, voltou) {
    if (!r.encontrado) return aguardando(voltou);
    revelar(r, voltou);
    if (r.confirmado && r.numero) aplicarConfirmacao(r.numero, false);
  }

  $("#b-retry").addEventListener("click", () => { esquecer(); location.reload(); });
  $("#b-outro").addEventListener("click", () => { esquecer(); location.reload(); });

  /* ---------- REVELAÇÃO ---------- */
  function revelar(r, voltou = false) {
    state.resultado = r;
    $("#r-first").textContent = firstName(state.nome);
    $("#r-sector").textContent = r.setor;
    $("#r-emoji").textContent = EMOJI[r.setor] || "🔥";
    const missao = (r.missao || "Você faz parte do time que vai fazer o Fogo na Vila acontecer.").trim();
    const [lead, ...resto] = missao.split(/(?<=[.!?])\s+/);
    $("#r-lead").textContent = lead;
    $("#r-body").textContent = resto.join(" ");
    $("#r-emoji2").textContent = EMOJI[r.setor] || "🔥";
    $("#r-coord").textContent = r.coordenador || "A definir";
    if (r.link) { $("#b-group").href = r.link; $("#b-group").hidden = false; }
    $("#reveal").hidden = false; $("#waiting").hidden = true;
    mostrar("s-reveal");
    if (voltou) {
      $("#r-sticker").textContent = "Bem-vindo de volta";
      $("#r-sub").textContent = "Seu setor já foi revelado. Confira tudo abaixo.";
      return;
    }
    $("#flash").classList.add("is-on");
    vibrate([120, 60, 120, 60, 300]);
    confetti($("#fx"));
  }

  async function aplicarConfirmacao(n, comFesta) {
    state.numero = n;
    $("#b-confirm").hidden = true;
    $("#r-num").textContent = `Nº ${n}`;
    $("#r-pos-n").textContent = `${n}º`; $("#r-pos-n2").textContent = n;
    $("#r-pos").hidden = false; $("#story").hidden = false;
    if (comFesta) { vibrate([60, 40, 60]); confetti($("#fx"), .6); }
    await desenharCracha();
  }

  $("#b-confirm").addEventListener("click", async () => {
    const b = $("#b-confirm");
    b.disabled = true; b.textContent = "Confirmando...";
    try {
      const n = await rpc("fnv_confirmar", { p_rid: state.resultado.rid });
      await aplicarConfirmacao(n, true);
      $("#r-pos").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      b.disabled = false; b.textContent = "Confirmo meu chamado 🙌";
      FNV.toast("Não consegui confirmar. Tenta de novo?");
    }
  });

  /* ---------- CRACHÁ DO STORY ---------- */
  const logo = new Image(); logo.src = "assets/logo.svg";

  async function desenharCracha() {
    const cv = $("#badge"), c = cv.getContext("2d"), W = 1080, H = 1920;
    try { await Promise.all([document.fonts.load("800 100px Bricolage"), document.fonts.load("800 40px Jakarta"), document.fonts.load("700 40px Jakarta")]); } catch (e) {}
    if (!logo.complete) await new Promise(r => { logo.onload = r; logo.onerror = r; });

    // fundo
    c.fillStyle = "#0b0b0a"; c.fillRect(0, 0, W, H);
    let g = c.createRadialGradient(W / 2, H * 1.02, 40, W / 2, H * 1.02, H * .7);
    g.addColorStop(0, "rgba(203,252,6,.40)"); g.addColorStop(1, "rgba(203,252,6,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      c.globalAlpha = Math.random() * .6 + .15; c.fillStyle = "#cbfc06";
      c.beginPath(); c.arc(Math.random() * W, H * .55 + Math.random() * H * .45, Math.random() * 5 + 1.5, 0, 7); c.fill();
    }
    c.globalAlpha = 1;

    // logo
    const lw = 460, lh = lw * 890 / 1126;
    c.drawImage(logo, (W - lw) / 2, 150, lw, lh);

    // ingresso verde (desenhado à parte para recortar as laterais sem furar a imagem)
    const tx = 110, ty = 600, tw = W - 220, th = 930, cut = ty + 640;
    const t = document.createElement("canvas"); t.width = W; t.height = H;
    const tc = t.getContext("2d");
    tc.fillStyle = "#cbfc06"; arredondado(tc, tx, ty, tw, th, 56); tc.fill();
    tc.globalCompositeOperation = "destination-out";
    [tx, tx + tw].forEach(x => { tc.beginPath(); tc.arc(x, cut, 38, 0, 7); tc.fill(); });
    c.drawImage(t, 0, 0);
    c.setLineDash([22, 18]); c.lineWidth = 6; c.strokeStyle = "rgba(11,11,10,.35)";
    c.beginPath(); c.moveTo(tx + 70, cut); c.lineTo(tx + tw - 70, cut); c.stroke(); c.setLineDash([]);

    c.textAlign = "center"; c.fillStyle = "#0b0b0a";
    c.font = "800 34px Jakarta"; espacado(c, "CONVOCAÇÃO OFICIAL", W / 2, ty + 110, 8);
    c.font = "800 124px Bricolage"; c.fillText("Convocado", W / 2, ty + 280);
    c.font = "800 84px Bricolage"; c.fillText("pro Fogo na Vila", W / 2, ty + 400);
    c.font = "italic 700 40px Jakarta"; c.globalAlpha = .8;
    c.fillText("Eu não vou só assistir,", W / 2, ty + 500); c.fillText("eu vou fazer acontecer.", W / 2, ty + 555);
    c.globalAlpha = 1;

    // canhoto: nome e número
    const nome = nomeBonito(state.nome).split(" ").slice(0, 2).join(" ");
    let fs = 64; c.font = `800 ${fs}px Bricolage`;
    while (c.measureText(nome).width > tw - 140 && fs > 40) { fs -= 4; c.font = `800 ${fs}px Bricolage`; }
    c.textAlign = "left";
    c.font = "800 28px Jakarta"; c.globalAlpha = .65; espacado(c, "SERVO", tx + 70, cut + 105, 6, "left"); c.globalAlpha = 1;
    c.font = `800 ${fs}px Bricolage`; c.fillText(nome, tx + 70, cut + 180);
    c.textAlign = "right";
    c.font = "800 28px Jakarta"; c.globalAlpha = .65; espacado(c, "Nº", tx + tw - 70, cut + 105, 6, "right"); c.globalAlpha = 1;
    c.font = "800 96px Bricolage"; c.fillText(String(state.numero), tx + tw - 70, cut + 190);

    // rodapé
    c.textAlign = "center"; c.fillStyle = "#cbfc06"; c.font = "800 46px Jakarta"; c.fillText("@fogonavila_", W / 2, H - 170);
    c.fillStyle = "#a6a69c"; c.font = "700 32px Jakarta"; c.fillText("A maior vigília de Vila Velha", W / 2, H - 112);
  }
  function arredondado(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function espacado(c, txt, x, y, sp, align = "center") {
    const larg = [...txt].reduce((a, ch) => a + c.measureText(ch).width + sp, -sp);
    let px = align === "center" ? x - larg / 2 : align === "right" ? x - larg : x;
    const old = c.textAlign; c.textAlign = "left";
    for (const ch of txt) { c.fillText(ch, px, y); px += c.measureText(ch).width + sp; }
    c.textAlign = old;
  }

  $("#b-share").addEventListener("click", () => {
    $("#badge").toBlob(async blob => {
      const file = new File([blob], "servo-fogo-na-vila.png", { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Fogo na Vila" }); return; }
      } catch (e) { if (e.name === "AbortError") return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      FNV.toast("Crachá salvo! Agora é só postar 🔥");
    }, "image/png");
  });


  /* Ao abrir: se este aparelho já respondeu, volta direto ao resultado */
  (async () => {
    const memo = lembrado();
    if (!memo || !memo.zap) return;
    $("#think-text").textContent = "Carregando seu resultado...";
    mostrar("s-think");
    try {
      const r = await rpc("fnv_consultar", { p_whatsapp: memo.zap });
      if (r && r.respondeu) { Object.assign(state, { nome: r.nome || memo.nome, zap: memo.zap }); return mostrarResultado(r, true); }
      esquecer();
    } catch (e) {}
    mostrar("s-start");
  })();

  embers($("#embers"));
})();
