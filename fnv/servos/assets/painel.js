/* =========================================================
   PAINEL DA LIDERANÇA · setores, servos e cobrança
   ========================================================= */
(() => {
  const { $, $$, esc, digits, last8, firstName, phone, waNumber, rpc, EMOJI, toast, copy } = FNV;
  const QUIZ = location.origin + location.pathname.replace(/painel\.html$/, "");
  const MSG_PADRAO = "A paz do Senhor, {nome}! Você foi convocado para servir no Fogo na Vila, a maior vigília de Vila Velha. Responda o quiz e descubra o seu setor: {link}";
  const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';

  let PIN = "", D = { setores: [], servos: [], respostas: [] };
  const abertos = new Set(); let editando = null, filtro = "pend";
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
                  del: k => { try { localStorage.removeItem(k); } catch (e) {} } };

  /* ---------- ENTRADA ---------- */
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
  setInterval(() => { if (PIN && document.visibilityState === "visible" && !document.activeElement.matches("input,textarea,select")) recarregar(); }, 30000);

  /* ---------- SITUAÇÃO DE CADA SERVO ---------- */
  function situacao(sv) {
    const rs = D.respostas.filter(r => last8(r.whatsapp) === last8(sv.whatsapp));
    if (rs.some(r => r.confirmado)) return "ok";
    return rs.length ? "mid" : "no";
  }
  const SELO = { ok: '<span class="status ok">Confirmou</span>', mid: '<span class="status mid">Respondeu</span>', no: '<span class="status no">Pendente</span>' };
  const setorDe = sv => D.setores.find(s => s.id === sv.setor_id);

  function render() {
    const nums = new Set(D.respostas.map(r => last8(r.whatsapp)));
    const conf = new Set(D.respostas.filter(r => r.confirmado).map(r => last8(r.whatsapp)));
    $("#k-cad").textContent = D.servos.length;
    $("#k-resp").textContent = nums.size;
    $("#k-conf").textContent = conf.size;
    $("#k-meta").textContent = D.setores.reduce((a, s) => a + (+s.meta || 0), 0) || "--";
    $("#s-setor").innerHTML = '<option value="">Escolha o setor</option>' + D.setores.map(s => `<option value="${s.id}">${EMOJI[s.nome] || "🔥"} ${esc(s.nome)}</option>`).join("");
    renderSetores(); renderServos(); renderCobranca();
  }

  /* ---------- SETORES ---------- */
  function renderSetores() {
    $("#pane-setores").innerHTML = D.setores.map(s => {
      const pessoas = D.servos.filter(v => v.setor_id === s.id), n = pessoas.length, meta = +s.meta || 0;
      const conf = pessoas.filter(v => situacao(v) === "ok").length;
      const pct = meta ? Math.min(100, n / meta * 100) : (n ? 100 : 0);
      const aberto = abertos.has(s.id), falta = meta && n < meta;
      const info = [s.coordenador ? "Coord.: " + esc(s.coordenador) : "Sem coordenador", `${conf} confirmados`, s.link_whatsapp ? "grupo ✓" : "sem grupo"].join(" · ");
      return `
      <article class="sector${aberto ? " is-open" : ""}">
        <button class="sector-head" data-toggle="${s.id}" aria-expanded="${aberto}">
          <span class="sector-emoji">${EMOJI[s.nome] || "🔥"}</span>
          <span class="sector-name"><b>${esc(s.nome)}</b><small>${info}</small></span>
          <span class="sector-count${falta ? " is-short" : ""}">${n}${meta ? "/" + meta : ""}</span>
        </button>
        <div class="bar"><i style="width:${pct}%"></i></div>
        ${aberto ? `
        <div class="sector-body">
          <div class="field"><label>Coordenador(a)</label><input class="input" data-f="coord" value="${esc(s.coordenador)}" placeholder="Nome do coordenador"></div>
          <div class="grid-2">
            <div class="field"><label>Link do grupo</label><input class="input" data-f="link" value="${esc(s.link_whatsapp)}" placeholder="https://chat.whatsapp.com/..."></div>
            <div class="field"><label>Meta</label><input class="input" data-f="meta" inputmode="numeric" value="${meta || ""}" placeholder="0"></div>
          </div>
          <div class="actions">
            <button class="btn btn-lime btn-sm" data-save="${s.id}">Salvar setor</button>
            ${n ? `<button class="btn btn-sm" data-copy="${s.id}">Copiar lista</button>` : ""}
            ${s.link_whatsapp ? `<button class="btn btn-sm" data-sendlink="${s.id}">Copiar convite do grupo</button>` : ""}
          </div>
          ${falta ? `<p class="hint">Faltam ${meta - n} pessoas para a meta.</p>` : ""}
          <div class="people">${n ? pessoas.map(v => `
            <div class="person">
              <div class="person-info"><b>${esc(v.nome)}</b><small>${phone(v.whatsapp)}</small></div>
              ${SELO[situacao(v)]}
              <a class="mini wa" target="_blank" rel="noopener" href="https://wa.me/${waNumber(v.whatsapp)}" aria-label="Chamar no WhatsApp">${WA_ICON}</a>
            </div>`).join("") : '<p class="empty">Ninguém neste setor ainda</p>'}
          </div>
        </div>` : ""}
      </article>`;
    }).join("");
  }

  $("#pane-setores").addEventListener("click", async e => {
    const t = e.target.closest("[data-toggle],[data-save],[data-copy],[data-sendlink]"); if (!t) return;
    if (t.dataset.toggle) { const id = +t.dataset.toggle; abertos.has(id) ? abertos.delete(id) : abertos.add(id); return renderSetores(); }
    const s = D.setores.find(x => x.id == (t.dataset.save || t.dataset.copy || t.dataset.sendlink));
    if (t.dataset.save) {
      const box = t.closest(".sector");
      const coord = $('[data-f="coord"]', box).value.trim(), link = $('[data-f="link"]', box).value.trim(), meta = parseInt($('[data-f="meta"]', box).value) || 0;
      if (link && !/^https:\/\/chat\.whatsapp\.com\//.test(link)) return toast("O link precisa começar com https://chat.whatsapp.com/");
      t.disabled = true;
      try { await rpc("fnv_admin_salvar_setor", { p_pin: PIN, p_id: s.id, p_coordenador: coord, p_link: link, p_meta: meta }); toast("Setor salvo ✓"); await recarregar(); }
      catch (err) { toast("Erro ao salvar"); t.disabled = false; }
    }
    if (t.dataset.copy) {
      const lista = D.servos.filter(v => v.setor_id === s.id).map((v, i) => `${i + 1}. ${v.nome} - ${phone(v.whatsapp)}`).join("\n");
      copy(`${s.nome.toUpperCase()}${s.coordenador ? "\nCoordenação: " + s.coordenador : ""}\n\n${lista}`, "Lista copiada");
    }
    if (t.dataset.sendlink) copy(`A paz do Senhor! Este é o grupo do setor ${s.nome} do Fogo na Vila: ${s.link_whatsapp}`, "Convite copiado");
  });

  /* ---------- SERVOS ---------- */
  function renderServos() {
    const q = $("#search").value.trim().toLowerCase(), qd = digits(q);
    const lista = D.servos.filter(v => !q || v.nome.toLowerCase().includes(q) || (qd && v.whatsapp.includes(qd)));
    $("#list-servos").innerHTML = lista.length ? lista.map(v => {
      const s = setorDe(v);
      return `
      <div class="person has-2">
        <div class="person-info"><b>${esc(v.nome)}</b><small>${phone(v.whatsapp)} · ${s ? (EMOJI[s.nome] || "") + " " + esc(s.nome) : "Sem setor"}</small></div>
        ${SELO[situacao(v)]}
        <button class="mini" data-edit="${v.id}" aria-label="Editar">✎</button>
        <button class="mini" data-del="${v.id}" aria-label="Excluir">🗑</button>
      </div>`;
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
    const nome = $("#s-nome").value.trim().replace(/\s+/g, " "), zap = digits($("#s-zap").value), setor = +$("#s-setor").value || null;
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
      $("#s-nome").value = v.nome; $("#s-zap").value = phone(v.whatsapp); $("#s-setor").value = v.setor_id || "";
      $("#form-title").textContent = "Editar servo"; $("#s-cancel").hidden = false;
      $("#form-box").scrollIntoView({ behavior: "smooth" });
    }
    if (del) {
      const v = D.servos.find(x => x.id == del.dataset.del);
      if (!confirm(`Excluir ${v.nome}?`)) return;
      try { await rpc("fnv_admin_excluir_servo", { p_pin: PIN, p_id: v.id }); toast("Excluído"); await recarregar(); }
      catch (err) { toast("Erro ao excluir"); }
    }
  });

  /* Importar lista colada */
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
      if (nome && z.length >= 10 && s) ok.push({ nome: nome.replace(/\s+/g, " "), zap: z, id: s.id }); else ruins.push(l);
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

  /* ---------- COBRANÇA ---------- */
  $("#msg").value = store.get("fnv_msg") || MSG_PADRAO;
  $("#msg").addEventListener("input", () => store.set("fnv_msg", $("#msg").value));
  $("#cob-chips").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    filtro = c.dataset.f; $$("#cob-chips .chip").forEach(x => x.classList.toggle("is-on", x === c)); renderCobranca();
  });

  function renderCobranca() {
    let lista = [];
    const nomeSetor = v => (setorDe(v) || {}).nome || "";
    if (filtro === "pend") lista = D.servos.filter(v => situacao(v) === "no").map(v => ({ nome: v.nome, zap: v.whatsapp, sub: nomeSetor(v) }));
    if (filtro === "nconf") lista = D.servos.filter(v => situacao(v) === "mid").map(v => ({ nome: v.nome, zap: v.whatsapp, sub: nomeSetor(v) }));
    if (filtro === "semcad") {
      const cad = new Set(D.servos.map(v => last8(v.whatsapp))), vistos = new Set();
      lista = D.respostas.filter(r => { const k = last8(r.whatsapp); if (cad.has(k) || vistos.has(k)) return false; vistos.add(k); return true; })
        .map(r => ({ nome: r.nome, zap: r.whatsapp, sub: "Sem setor definido", cadastrar: true }));
    }
    const texto = n => $("#msg").value.replace(/\{nome\}/g, firstName(n)).replace(/\{link\}/g, QUIZ);
    $("#list-cob").innerHTML = lista.length ? lista.map(p => `
      <div class="person">
        <div class="person-info"><b>${esc(p.nome)}</b><small>${phone(p.zap)}${p.sub ? " · " + esc(p.sub) : ""}</small></div>
        <span></span>
        ${p.cadastrar
          ? `<button class="btn btn-sm" data-cad="${esc(p.nome)}|${esc(p.zap)}">Cadastrar</button>`
          : `<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/${waNumber(p.zap)}?text=${encodeURIComponent(texto(p.nome))}">Chamar</a>`}
      </div>`).join("")
      : `<p class="empty">${filtro === "pend" && !D.servos.length ? "Cadastre os servos na aba Servos primeiro." : "Ninguém aqui 🙌"}</p>`;
  }
  $("#list-cob").addEventListener("click", e => {
    const c = e.target.closest("[data-cad]"); if (!c) return;
    const [n, z] = c.dataset.cad.split("|");
    abrirAba("servos"); limparForm(); $("#s-nome").value = n; $("#s-zap").value = phone(z); $("#s-setor").focus();
    toast("Escolha o setor e salve");
  });

  /* ---------- ABAS ---------- */
  function abrirAba(nome) {
    $$(".tab").forEach(t => t.classList.toggle("is-on", t.dataset.tab === nome));
    $$(".pane").forEach(p => p.classList.toggle("is-on", p.id === "pane-" + nome));
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => abrirAba(t.dataset.tab)));
  $("#b-copy-quiz").addEventListener("click", () => copy(QUIZ, "Link do quiz copiado"));
})();
