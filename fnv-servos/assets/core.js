/* =========================================================
   FOGO NA VILA · Núcleo compartilhado (banco, setores, efeitos)
   ========================================================= */
const FNV = (() => {
  const SB  = "https://pplhwupjbrtzqdwzlcem.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbGh3dXBqYnJ0enFkd3psY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5ODczODYsImV4cCI6MjEwNjU2MzM4Nn0.wOm9lQH2gN4Y01BrpUeQ09elDOASsd0gELs-yDwmf20";

  /* Chamada a uma função do banco */
  async function rpc(fn, body) {
    const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const t = await r.text();
    if (!r.ok) throw new Error(t);
    return t ? JSON.parse(t) : null;
  }

  /* Setores e emojis vêm do arquivo de configuração */
  const EMOJI = CONFIG.setores;

  /* Utilidades de texto e telefone */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const digits = t => String(t || "").replace(/\D/g, "");
  const last8 = t => digits(t).slice(-8);
  /* "DAYANA ALVES MACHADO" -> "Dayana Alves Machado" */
  const PEQUENAS = ["da", "de", "do", "das", "dos", "e"];
  const nomeBonito = n => String(n || "").trim().replace(/\s+/g, " ").toLowerCase()
    .split(" ").map((w, i) => i > 0 && PEQUENAS.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const firstName = n => nomeBonito(n).split(" ")[0] || "";
  function phone(t) {
    let d = digits(t); if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  }
  const waNumber = t => { const d = digits(t); return d.startsWith("55") && d.length > 11 ? d : "55" + d; };

  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("is-on"), 2600);
  }
  const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  async function copy(text, ok = "Copiado!") {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const a = document.createElement("textarea"); a.value = text; document.body.append(a); a.select(); document.execCommand("copy"); a.remove(); }
    toast(ok);
  }

  /* Brasas subindo no fundo */
  function embers(canvas, count = 34) {
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = canvas.getContext("2d");
    const dots = Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 2.2 + .6,
      v: Math.random() * .0014 + .0005, o: Math.random() * .5 + .2, w: Math.random() * 6.3
    }));
    const size = () => { const d = devicePixelRatio || 1; canvas.width = innerWidth * d; canvas.height = innerHeight * d; c.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener("resize", size);
    (function loop() {
      const W = innerWidth, H = innerHeight; c.clearRect(0, 0, W, H);
      c.fillStyle = "#cbfc06"; c.shadowColor = "#cbfc06"; c.shadowBlur = 8;
      for (const e of dots) {
        e.y -= e.v; e.w += .03; if (e.y < -.02) { e.y = 1.02; e.x = Math.random(); }
        c.globalAlpha = e.o * (e.y < .3 ? e.y / .3 : 1);
        c.beginPath(); c.arc(e.x * W + Math.sin(e.w) * 10, e.y * H, e.r, 0, 7); c.fill();
      }
      requestAnimationFrame(loop);
    })();
  }

  /* Explosão de confete e fogo */
  function confetti(canvas, power = 1) {
    if (!canvas) return;
    const c = canvas.getContext("2d"), d = devicePixelRatio || 1;
    canvas.width = innerWidth * d; canvas.height = innerHeight * d; c.setTransform(d, 0, 0, d, 0, 0);
    const W = innerWidth, H = innerHeight, cols = ["#cbfc06", "#e8ff8a", "#ffffff", "#93b800", "#ffd23f", "#ff8a1f"];
    const parts = [];
    [.2, .5, .8].forEach((fx, i) => {
      const ox = W * fx, oy = H * (.32 + Math.random() * .12);
      for (let k = 0; k < Math.round(80 * power); k++) {
        const a = Math.random() * Math.PI * 2, s = (Math.random() * 9 + 3) * (i === 1 ? 1.25 : 1);
        parts.push({ x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, life: 1, dec: Math.random() * .011 + .008,
          w: Math.random() * 9 + 4, h: Math.random() * 5 + 3, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
          col: cols[Math.random() * cols.length | 0], fire: Math.random() < .3 });
      }
    });
    (function loop() {
      c.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0 || p.y > H + 40) continue; alive++;
        p.vx *= .985; p.vy += .22; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.dec;
        c.globalAlpha = Math.max(0, p.life);
        if (p.fire) { c.font = "18px serif"; c.fillText("🔥", p.x, p.y); }
        else { c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }
      }
      c.globalAlpha = 1;
      if (alive) requestAnimationFrame(loop); else c.clearRect(0, 0, W, H);
    })();
  }

  return { rpc, EMOJI, SETORES: Object.keys(EMOJI), $, $$, esc, digits, last8, nomeBonito, firstName, phone, waNumber, toast, vibrate, copy, embers, confetti };
})();
