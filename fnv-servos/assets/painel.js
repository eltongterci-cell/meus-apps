/* =========================================================
   PAINEL DA LIDERANÇA
   1. Estado e entrada  2. Dados de cada servo  3. Resumo
   4. Setores  5. Servos  6. Importar lista  7. Cobrança  8. Abas
   ========================================================= */
(() => {
  const { $, $$, esc, digits, last8, nomeBonito, firstName, phone, waNumber, rpc, EMOJI, toast, copy } = FNV;
  const QUIZ = location.origin + location.pathname.replace(/painel\.html$/, "");
  const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';

  /* ---------- 1. ESTADO E ENTRADA ---------- */
  let PIN = "", D = { setores: [], servos: [], respostas: [] };
  const abertos = new Set();
  let editando = null, filtro = "pend";
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };

  async function entrar(pin) {
    try {
      D = await rpc("fnv_admin_dados", { p_pin: pin }); PIN = pin; store.set("fnv_pin", pin);
      $("#login").hidden = true; $("#app").hidden = false; render();
    } catch (e) {
      $("#l-err").textContent = e.message.includes("PIN") ? "Senha incorreta" : "Sem conexão. Tente de novo.";
      store.del("fnv_pin");
    }
  }
  $("#b-login").addEventListener("click", () => entrar($("#pin").value.trim()));
  $("#pin").addEventListener("keydown", e => { if (e.key === "Enter") entrar($("#pin").value.trim()); });
  if (store.get("fnv_pin")) entrar(store.get("fnv_pin"));

  async function recarregar() { try { D = await rpc("fnv_admin_dados", { p_pin: PIN }); render(); } catch (e) { toast("Erro ao atualizar"); } }
  $("#b-refresh").addEventListener("click", () => { recarregar(); toast("Atualizado"); });
  setInterval(() => {
    const digitando = document.activeElement && document.activeElement.matches("input,textarea,select");
    if (PIN && document.visibilityState === "visible" && !digitando) recarregar();
  }, 30000);

  /* ---------- 2. DADOS DE CADA SERVO ---------- */
  const respostaDe = sv => {
    const rs = D.respostas.filter(r => last8(r.whatsapp) === last8(sv.whatsapp));
    return rs.find(r => r.confirmado) || rs[0] || null;
  };
  /* Nome mostrado: o que a pessoa digitou no quiz; se ainda não respondeu, o do cadastro */
  const nomeDe = sv => { const r = respostaDe(sv); return nomeBonito(r && r.nome ? r.nome : sv.nome); };
  const situacao = sv => { const r = respostaDe(sv); return !r ? "no" : r.confirmado ? "ok" : "mid"; };
  const SELO = { ok: '<span class="status ok">Confirmou</span>', mid: '<span class="status mid">Respondeu</span>', no: '<span class="status no">Pendente</span>' };
  const setorDe = sv => D.setores.find(s => s.id === sv.setor_id);
  const pessoasDo = s => D.servos.filter(v => v.setor_id === s.id).sort((a, b) => nomeDe(a).localeCompare(nomeDe(b)));

  /* Linha de uma pessoa: nome, detalhes e situação à esquerda; botões à direita */
  function linhaPessoa(v, { detalhe = "", lado = "", selo = true } = {}) {
    const nome = nomeDe(v), cad = nomeBonito(v.nome);
    const antes = cad !== nome && !/^teste\b/i.test(cad) ? `<span class="was">Cadastrado como ${esc(cad)}</span>` : "";
    return `
      <div class="person">
        <div class="person-info">
          <b>${esc(nome)}</b>
          <small>${phone(v.whatsapp)}${detalhe ? " · " + detalhe : ""}</small>
          ${antes}
          ${selo ? `<span>${SELO[situacao(v)]}</span>` : ""}
        </div>
        <div class="person-side">${lado}</div>
      </div>`;
  }
  const botaoWa = (zap, texto) => `<a class="mini wa" target="_blank" rel="noopener" href="https://wa.me/${waNumber(zap)}${texto ? "?text=" + encodeURIComponent(texto) : ""}" aria-label="Chamar no WhatsApp">${WA_ICON}</a>`;

  /* ---------- 3. RESUMO ---------- */
  function render() {
    const nums = new Set(D.respostas.map(r => last8(r.whatsapp)));
    const conf = new Set(D.respostas.filter(r => r.confirmado).map(r => last8(r.whatsapp)));
    $("#k-cad").textContent = D.servos.length;
    $("#k-resp").textContent = nums.size;
    $("#k-conf").textContent = conf.size;
    $("#k-meta").textContent = D.setores.reduce((a, s) => a + (+s.meta || 0), 0) || "--";
    $("#s-setor").innerHTML = '<option value="">Escolha o setor</option>' +
      D.setores.map(s => `<option value="${s.id}">${EMOJI[s.nome] || "🔥"} ${esc(s.nome)}</option>`).join("");
    renderSetores(); renderServos(); renderCobranca();
  }

  /* ---------- 4. SETORES ---------- */
  function renderSetores() {
    $("#pane-setores").innerHTML = D.setores.map(s => {
      const pessoas = pessoasDo(s), n = pessoas.length, meta = +s.meta || 0;
      const conf = pessoas.filter(v => situacao(v) === "ok").length;
      const pct = meta ? Math.min(100, n / meta * 100) : (n ? 100 : 0);
      const aberto = abertos.has(s.id), falta = meta && n < meta;
      const tags = [
        s.coordenador ? `<span class="tag ok">👤 ${esc(s.coordenador)}</span>` : '<span class="tag warn">Sem coordenador</span>',
        s.link_whatsapp ? '<span class="tag ok">Grupo ✓</span>' : '<span class="tag warn">Sem grupo</span>',
        `<span class="tag">${conf} confirmado${conf === 1 ? "" : "s"}</span>`
      ].join("");
      return `
      <article class="sector${aberto ? " is-open" : ""}" data-id="${s.id}">
        <button class="sector-head" data-toggle="${s.id}" aria-expanded="${aberto}">
          <span class="sector-emoji">${EMOJI[s.nome] || "🔥"}</span>
          <span class="sector-name"><b>${esc(s.nome)}</b><span class="tags">${tags}</span></span>
          <span class="sector-count${falta ? " is-short" : ""}"><b>${n}${meta ? "/" + meta : ""}</b><small>${meta ? "meta" : "servos"}</small></span>
        </button>
        <div class="bar"><i style="width:${pct}%"></i></div>
        ${aberto ? corpoSetor(s, pessoas, meta, falta, n) : ""}
      </article>`;
    }).join("");
  }

  function corpoSetor(s, pessoas, meta, falta, n) {
    return `
      <div class="sector-body">
        <div class="field">
          <label>Coordenador(a)</label>
          <input class="input" data-f="coord" value="${esc(s.coordenador)}" placeholder="Nome do coordenador">
        </div>
        <div class="field">
          <label>Link do grupo de WhatsApp</label>
          <div class="input-row">
            <input class="input" data-f="link" value="${esc(s.link_whatsapp)}" placeholder="https://chat.whatsapp.com/..." inputmode="url">
            <button class="btn btn-sm" data-paste="1">Colar</button>
          </div>
        </div>
        <div class="field">
          <label>Meta de pessoas</label>
          <div class="stepper">
            <button data-step="-1" aria-label="Diminuir">−</button>
            <output data-f="meta">${meta}</output>
            <button data-step="1" aria-label="Aumentar">+</button>
          </div>
        </div>
        <div class="sector-actions">
          <button class="btn btn-lime" data-save="${s.id}">Salvar setor</button>
          ${n ? `<button class="btn btn-sm" data-copy="${s.id}">Copiar lista</button>` : ""}
          ${s.link_whatsapp ? `<button class="btn btn-sm" data-sendlink="${s.id}">Copiar convite</button>` : ""}
        </div>
        ${falta ? `<p class="hint">Faltam ${meta - n} pessoa${meta - n === 1 ? "" : "s"} para a meta.</p>` : ""}
        <div class="people">
          ${n ? pessoas.map(v => linhaPessoa(v, { lado: botaoWa(v.whatsapp) })).join("") : '<p class="empty">Ninguém neste setor ainda</p>'}
        </div>
      </div>`;
  }

  $("#pane-setores").addEventListener("click", async e => {
    const t = e.target.closest("[data-toggle],[data-save],[data-copy],[data-sendlink],[data-step],[data-paste]");
    if (!t) return;
    const box = t.closest(".sector");

    if (t.dataset.toggle) {
      const id = +t.dataset.toggle;
      abertos.has(id) ? abertos.delete(id) : abertos.add(id);
      return renderSetores();
    }
    if (t.dataset.step) {
      const out = $('[data-f="meta"]', box);
      out.textContent = Math.max(0, (+out.textContent || 0) + (+t.dataset.step));
      return;
    }
    if (t.dataset.paste) {
      try { $('[data-f="link"]', box).value = (await navigator.clipboard.readText()).trim(); toast("Link colado"); }
      catch (err) { toast("Toque no campo e cole o link"); $('[data-f="link"]', box).focus(); }
      return;
    }

    const s = D.setores.find(x => x.id == (t.dataset.save || t.dataset.copy || t.dataset.sendlink));
    if (t.dataset.save) {
      const coord = $('[data-f="coord"]', box).value.trim();
      const link = $('[data-f="link"]', box).value.trim();
      const meta = +$('[data-f="meta"]', box).textContent || 0;
      if (link && !/^https:\/\/chat\.whatsapp\.com\//.test(link)) return toast("O link precisa começar com https://chat.whatsapp.com/");
      t.disabled = true; t.textContent = "Salvando...";
      try {
        await rpc("fnv_admin_salvar_setor", { p_pin: PIN, p_id: s.id, p_coordenador: coord, p_link: link, p_meta: meta });
        toast("Setor salvo ✓"); await recarregar();
      } catch (err) { toast("Erro ao salvar"); t.disabled = false; t.textContent = "Salvar setor"; }
    }
    if (t.dataset.copy) {
      const lista = pessoasDo(s).map((v, i) => `${i + 1}. ${nomeDe(v)} - ${phone(v.whatsapp)}`).join("\n");
      copy(`${s.nome.toUpperCase()}${s.coordenador ? "\nCoordenação: " + s.coordenador : ""}\n\n${lista}`, "Lista copiada");
    }
    if (t.dataset.sendlink) copy(`A paz do Senhor! Este é o grupo do setor ${s.nome} do Fogo na Vila: ${s.link_whatsapp}`, "Convite copiado");
  });

  /* ---------- 5. SERVOS ---------- */
  function renderServos() {
    const q = $("#search").value.trim().toLowerCase(), qd = digits(q);
    const todos = [...D.servos].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b)));
    const lista = todos.filter(v => !q || nomeDe(v).toLowerCase().includes(q) || v.nome.toLowerCase().includes(q) || (qd && v.whatsapp.includes(qd)));
    $("#servos-count").textContent = `${D.servos.length} servo${D.servos.length === 1 ? "" : "s"} cadastrado${D.servos.length === 1 ? "" : "s"}`;
    $("#list-servos").innerHTML = lista.length ? lista.map(v => {
      const s = setorDe(v);
      return linhaPessoa(v, {
        detalhe: s ? `${EMOJI[s.nome] || ""} ${esc(s.nome)}` : "Sem setor",
        lado: `<button class="mini" data-edit="${v.id}" aria-label="Editar">✎</button><button class="mini" data-del="${v.id}" aria-label="Excluir">🗑</button>`
      });
    }).join("") : `<p class="empty">${D.servos.length ? "Ninguém encontrado" : "Nenhum servo ainda. Cadastre acima ou cole uma lista."}</p>`;
  }
  $("#search").addEventListener("input", renderServos);
  $("#s-zap").addEventListener("input", e => { e.target.value = phone(digits(e.target.value).slice(0, 11)); });

  function limparForm() {
    editando = null; $("#s-nome").value = ""; $("#s-zap").value = ""; $("#s-setor").value = "";
    $("#form-title").textContent = "Cadastrar servo"; $("#s-cancel").hidden = true;
  }
  $("#s-cancel").addEventListener("click", limparForm);

  $("#s-save").addEventListener("click", async () => {
    const nome = nomeBonito($("#s-nome").value), zap = digits($("#s-zap").value), setor = +$("#s-setor").value || null;
    if (nome.length < 3) return toast("Coloque o nome");
    if (zap.length < 10) return toast("WhatsApp com DDD");
    if (!setor) return toast("Escolha o setor");
    const b = $("#s-save"); b.disabled = true;
    try {
      await rpc("fnv_admin_salvar_servo", { p_pin: PIN, p_id: editando, p_nome: nome, p_whatsapp: zap, p_setor_id: setor });
      toast(editando ? "Servo atualizado ✓" : "Servo cadastrado ✓"); limparForm(); await recarregar(); $("#s-nome").focus();
    } catch (e) { toast(e.message.includes("duplicate") ? "Esse número já está cadastrado" : "Erro ao salvar"); }
    b.disabled = false;
  });

  $("#list-servos").addEventListener("click", async e => {
    const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (ed) {
      const v = D.servos.find(x => x.id == ed.dataset.edit); editando = v.id;
      $("#s-nome").value = nomeDe(v); $("#s-zap").value = phone(v.whatsapp); $("#s-setor").value = v.setor_id || "";
      $("#form-title").textContent = "Editar servo"; $("#s-cancel").hidden = false;
      $("#form-box").scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (del) {
      const v = D.servos.find(x => x.id == del.dataset.del);
      if (!confirm(`Excluir ${nomeDe(v)}?`)) return;
      try { await rpc("fnv_admin_excluir_servo", { p_pin: PIN, p_id: v.id }); toast("Excluído"); await recarregar(); }
      catch (err) { toast("Erro ao excluir"); }
    }
  });

  /* ---------- 6. IMPORTAR LISTA ---------- */
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function acharSetor(txt) {
    const n = norm(txt); if (!n) return null;
    return D.setores.find(s => norm(s.nome) === n)
      || D.setores.find(s => norm(s.nome).startsWith(n) || n.startsWith(norm(s.nome)))
      || D.setores.find(s => norm(s.nome).includes(n)) || null;
  }
  $("#b-bulk").addEventListener("click", async () => {
    const linhas = $("#bulk").value.split("\n").map(l => l.trim()).filter(Boolean);
    if (!linhas.length) return toast("Cole a lista primeiro");
    const ok = [], ruins = [];
    for (const l of linhas) {
      const p = l.split(/[;\t|]/).map(x => x.trim());
      let nome, zap, set;
      if (p.length >= 3) [nome, zap, set] = p;
      else { const m = l.match(/^(.*?)[,\s]+([\d()\-\s+]{10,})[,\s]+(.*)$/); if (m) [, nome, zap, set] = m; }
      const s = acharSetor(set), z = digits(zap);
      if (nome && z.length >= 10 && s) ok.push({ nome: nomeBonito(nome), zap: z, id: s.id }); else ruins.push(l);
    }
    if (!ok.length) return toast("Não entendi nenhuma linha. Use Nome; WhatsApp; Setor");
    const b = $("#b-bulk"); b.disabled = true; let n = 0, falhas = 0;
    for (const o of ok) {
      b.textContent = `Importando ${++n}/${ok.length}...`;
      try { await rpc("fnv_admin_salvar_servo", { p_pin: PIN, p_id: null, p_nome: o.nome, p_whatsapp: o.zap, p_setor_id: o.id }); }
      catch (e) { falhas++; ruins.push(`${o.nome}; ${o.zap}; ?`); }
    }
    b.disabled = false; b.textContent = "Importar lista"; $("#bulk").value = ruins.join("\n");
    toast(`${ok.length - falhas} importados${ruins.length ? ` · ${ruins.length} para conferir` : ""}`);
    await recarregar();
  });

  /* ---------- 7. COBRANÇA ---------- */
  $("#msg").value = store.get("fnv_msg") || CONFIG.mensagemCobranca;
  $("#msg").addEventListener("input", () => { store.set("fnv_msg", $("#msg").value); renderCobranca(); });
  $("#cob-chips").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    filtro = c.dataset.f; $$("#cob-chips .chip").forEach(x => x.classList.toggle("is-on", x === c)); renderCobranca();
  });

  function listasCobranca() {
    const nomeSetor = v => (setorDe(v) || {}).nome || "";
    const cad = new Set(D.servos.map(v => last8(v.whatsapp))), vistos = new Set();
    return {
      pend: D.servos.filter(v => situacao(v) === "no"),
      nconf: D.servos.filter(v => situacao(v) === "mid"),
      semcad: D.respostas.filter(r => { const k = last8(r.whatsapp); if (cad.has(k) || vistos.has(k)) return false; vistos.add(k); return true; }),
      nomeSetor
    };
  }

  function renderCobranca() {
    const L = listasCobranca();
    $("#c-pend").textContent = L.pend.length; $("#c-nconf").textContent = L.nconf.length; $("#c-semcad").textContent = L.semcad.length;
    const texto = n => $("#msg").value.replace(/\{nome\}/g, firstName(n)).replace(/\{link\}/g, QUIZ);
    let html = "";
    if (filtro === "semcad") {
      html = L.semcad.map(r => `
        <div class="person">
          <div class="person-info"><b>${esc(nomeBonito(r.nome))}</b><small>${phone(r.whatsapp)} · Sem setor definido</small></div>
          <div class="person-side"><button class="btn btn-sm" data-cad="${esc(nomeBonito(r.nome))}|${esc(r.whatsapp)}">Cadastrar</button></div>
        </div>`).join("");
    } else {
      html = L[filtro].map(v => {
        return linhaPessoa(v, {
          detalhe: esc(L.nomeSetor(v)), selo: false,
          lado: `<a class="btn btn-lime btn-sm" target="_blank" rel="noopener" href="https://wa.me/${waNumber(v.whatsapp)}?text=${encodeURIComponent(texto(nomeDe(v)))}">Chamar</a>`
        });
      }).join("");
    }
    $("#list-cob").innerHTML = html || `<p class="empty">${filtro === "pend" && !D.servos.length ? "Cadastre os servos na aba Servos primeiro." : "Ninguém aqui 🙌"}</p>`;
  }

  $("#list-cob").addEventListener("click", e => {
    const c = e.target.closest("[data-cad]"); if (!c) return;
    const [n, z] = c.dataset.cad.split("|");
    abrirAba("servos"); limparForm(); $("#s-nome").value = n; $("#s-zap").value = phone(z); $("#s-setor").focus();
    toast("Escolha o setor e salve");
  });

  /* ---------- 8. ABAS ---------- */
  function abrirAba(nome) {
    $$(".tab").forEach(t => t.classList.toggle("is-on", t.dataset.tab === nome));
    $$(".pane").forEach(p => p.classList.toggle("is-on", p.id === "pane-" + nome));
    $(".tabs").scrollIntoView({ block: "start" });
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => abrirAba(t.dataset.tab)));
  $("#b-copy-quiz").addEventListener("click", () => copy(QUIZ, "Link do quiz copiado"));
})();
