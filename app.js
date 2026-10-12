/* =====================================================================
   BALL BEARING SELECTION TOOL – application logic
   ===================================================================== */
(() => {
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fmt = (x, dp = 2) => (x === Infinity || !isFinite(x)) ? "∞" :
  Number(x).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const DATA = window.CATALOGUE || [];

const TYPES = {
  DG:  { name: "Deep Groove Ball", cat: "Deep Groove", K: 10 },
  AC1: { name: "Angular Contact – Single Row (40°)", cat: "Angular Contact (Single Row)", K: 7 },
  AC2: { name: "Angular Contact – Double Row (30°)", cat: "Angular Contact (Double Row)", K: 5 },
  SA:  { name: "Self-Aligning Ball", cat: "Self-Aligning", K: 7 },
};
const A1 = { 90: 1, 95: .64, 96: .55, 97: .47, 98: .37, 99: .25 };

/* ---------------------------------------------------------------
   1. BEARING SVG (themed metal rings, balls, cage)
   --------------------------------------------------------------- */
let uid = 0;
function bearingSVG({ balls = 9, spin = true, seal = false, type = "DG" } = {}) {
  const id = "b" + (++uid), R1 = 96, R2 = 78, R3 = 44, R4 = 28, rb = 13, rc = 61;
  let ballsSvg = "";
  for (let i = 0; i < balls; i++) {
    const a = (i / balls) * Math.PI * 2, x = 100 + rc * Math.cos(a), y = 100 + rc * Math.sin(a);
    ballsSvg += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rb}" fill="url(#ball${id})"/>`;
    if (type === "SA" || type === "AC2") {
      const x2 = 100 + (rc - 0) * Math.cos(a + Math.PI / balls), y2 = 100 + (rc) * Math.sin(a + Math.PI / balls);
      ballsSvg += `<circle cx="${x2.toFixed(2)}" cy="${y2.toFixed(2)}" r="${rb * .78}" fill="url(#ball${id})" opacity=".85"/>`;
    }
  }
  const cage = seal
    ? `<circle cx="100" cy="100" r="${rc}" fill="none" stroke="url(#cop${id})" stroke-width="30" opacity=".95"/>
       <circle cx="100" cy="100" r="${rc}" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1" stroke-dasharray="2 5"/>`
    : `<circle cx="100" cy="100" r="${rc}" fill="none" stroke="url(#cop${id})" stroke-width="5" stroke-dasharray="14 ${(2 * Math.PI * rc / balls - 14).toFixed(2)}"/>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="ring${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f5"/><stop offset=".45" stop-color="#9aa3b0"/><stop offset=".7" stop-color="#5b626d"/><stop offset="1" stop-color="#c9ced6"/></linearGradient>
    <radialGradient id="ball${id}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9ced6"/><stop offset="1" stop-color="#4b525c"/></radialGradient>
    <linearGradient id="cop${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2a93b"/><stop offset="1" stop-color="#a85a26"/></linearGradient>
  </defs>
  <circle cx="100" cy="100" r="${R1}" fill="url(#ring${id})"/>
  <circle cx="100" cy="100" r="${R2}" fill="#1b1d21"/>
  <g class="${spin ? "spin" : ""}">${cage}${seal ? "" : ballsSvg}</g>
  <circle cx="100" cy="100" r="${R3}" fill="url(#ring${id})"/>
  <circle cx="100" cy="100" r="${R4}" fill="var(--bg,#111)" stroke="#2d3239" stroke-width="2"/>
  <circle cx="100" cy="100" r="${R1 - 2}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
</svg>`;
}
$$("[data-bearing]").forEach(el => {
  el.innerHTML = bearingSVG({ type: el.dataset.bearing, balls: +el.dataset.balls || 9,
    seal: el.dataset.seal === "1", spin: el.dataset.spin !== "0" });
});

/* ---------------------------------------------------------------
   2. THEME, NAV, REVEAL
   --------------------------------------------------------------- */
const root = document.documentElement;
function setTheme(t) {
  root.dataset.theme = t; $("#themeToggle .knob").textContent = t === "dark" ? "🌙" : "☀️";
  try { localStorage.setItem("bbst-theme", t); } catch (e) {}
  if (lastRun) drawChart(lastRun.inp, lastRun.ref);
}
$("#themeToggle").addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));
let saved = "dark"; try { saved = localStorage.getItem("bbst-theme") || "dark"; } catch (e) {}

$("#burger").addEventListener("click", () => $(".links").classList.toggle("open"));
$$(".links a").forEach(a => a.addEventListener("click", () => $(".links").classList.remove("open")));

const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
$$(".reveal").forEach(el => io.observe(el));
const secs = $$("section[id]");
window.addEventListener("scroll", () => {
  let cur = secs[0].id;
  secs.forEach(s => { if (scrollY >= s.offsetTop - 120) cur = s.id; });
  $$(".links a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + cur));
}, { passive: true });

$("#statParts").textContent = DATA.length.toLocaleString();
$("#statSeries").textContent = new Set(DATA.map(r => r.s)).size;

/* ---------------------------------------------------------------
   3. ENGINEERING FUNCTIONS
   --------------------------------------------------------------- */
// Deep groove: Fa/C0 → e, Y (X = 0.56)
const DG_TABLE = [[.014,.19,2.30],[.028,.22,1.99],[.056,.26,1.71],[.084,.28,1.55],[.11,.30,1.45],[.17,.34,1.31],[.28,.38,1.15],[.42,.42,1.04],[.56,.44,1.00]];
function dgEY(r) {
  const t = DG_TABLE;
  if (r <= t[0][0]) return { e: t[0][1], Y: t[0][2] };
  if (r >= t[t.length - 1][0]) return { e: t[t.length - 1][1], Y: t[t.length - 1][2] };
  for (let i = 0; i < t.length - 1; i++) {
    const [a, e1, y1] = t[i], [b, e2, y2] = t[i + 1];
    if (r >= a && r <= b) { const k = (r - a) / (b - a); return { e: e1 + k * (e2 - e1), Y: y1 + k * (y2 - y1) }; }
  }
}
const SA_E = { 12: .27, 13: .30, 22: .42, 23: .45 };

/** Returns { e, X, Y, note } for a bearing row under Fr, Fa */
function factors(row, Fr, Fa) {
  const ratio = Fr > 0 ? Fa / Fr : Infinity;
  switch (row.t) {
    case "DG": { const { e, Y } = dgEY(Fa / row.C0); return ratio > e ? { e, X: .56, Y } : { e, X: 1, Y: 0 }; }
    case "AC1": return ratio > 1.14 ? { e: 1.14, X: .35, Y: .57 } : { e: 1.14, X: 1, Y: 0 };
    case "AC2": return ratio > .8 ? { e: .8, X: .63, Y: 1.24 } : { e: .8, X: 1, Y: .78 };
    case "SA": { const e = SA_E[+row.s] || .3; return ratio > e ? { e, X: .65, Y: .975 / e } : { e, X: 1, Y: .63 / e }; }
  }
  return { e: 0, X: 1, Y: 0 };
}
const racewayLife = (C, P, N, a1) => a1 * Math.pow(C / P, 3) * 1e6 / (60 * N);
function greaseLife(K, N, d, T) {
  let t = K * (14e6 / (N * Math.sqrt(d)) - 4 * d);
  if (T > 70) t /= Math.pow(2, (T - 70) / 15);
  return Math.max(t, 0);
}
const isSealed = r => /RS/i.test(r.sx), isShield = r => /Z/i.test(r.sx);
function speedLimit(r, lube) { return (lube === "oil" && !isSealed(r) && !isShield(r)) ? r.nO : r.nG; }

function evaluate(r, i) {
  const f = factors(r, i.Fr, i.Fa);
  const P = i.Ka * (f.X * i.Fr + f.Y * i.Fa);
  const Creq = P * Math.cbrt(i.L10 / i.a1);
  const s0 = r.C0 / Math.max(P / i.Ka, i.Fr);           // simple static check C0/P0
  const nLim = speedLimit(r, i.lube);
  const Lrace = racewayLife(r.C, P, i.N, i.a1);
  const Llube = (i.lube === "oil" && !isSealed(r) && !isShield(r)) ? Infinity : greaseLife(TYPES[r.t].K, i.N, r.d, i.T);
  const Lsys = Math.min(Lrace, Llube);
  const capOK = r.C >= Creq, spdOK = i.N <= nLim, statOK = s0 >= i.s0;
  return { ...r, ...f, P, Creq, s0, nLim, Lrace, Llube, Lsys, capOK, spdOK, statOK, ok: capOK && spdOK && statOK };
}

/* ---------------------------------------------------------------
   4. SELECTOR FORM
   --------------------------------------------------------------- */
const boreSel = $("#d");
[...new Set(DATA.map(r => r.d))].sort((a, b) => a - b).forEach(d => boreSel.add(new Option(d + " mm", d, d === 25, d === 25)));

function syncSealOptions() {
  const t = $("input[name=type]:checked").value, dg = t === "DG";
  $$("input[name=seal]").forEach(x => { if (x.value !== "open") { x.disabled = !dg; x.parentElement.style.opacity = dg ? 1 : .4; } });
  if (!dg) $("input[name=seal][value=open]").checked = true;
  $("#typeNote").textContent = {
    DG: "Radial + moderate axial loads, high speeds. Series 60, 62, 63, 160.",
    AC1: "Combined loads with high axial component (one direction). Series 72B, 73B. Usually mounted in pairs.",
    AC2: "Combined loads, axial in both directions. Series 32A, 33A.",
    SA: "Tolerates shaft misalignment / deflection. Series 12, 13, 22, 23 (K = tapered bore).",
  }[t];
}
$$("input[name=type]").forEach(x => x.addEventListener("change", syncSealOptions));
syncSealOptions();

let lastRun = null, chart = null;

$("#selForm").addEventListener("submit", e => {
  e.preventDefault();
  const v = id => +$("#" + id).value;
  const i = {
    t: $("input[name=type]:checked").value, Fr: v("Fr"), Fa: v("Fa"), Lh: v("Lh"), R: v("R"), Ka: v("Ka"), s0: v("s0"),
    d: v("d"), mfr: $("#mfr").value, lube: $("#lube").value, N: v("N"), T: v("T"),
    shaftFit: $("#shaftFit").value, housingFit: $("#housingFit").value, clear: $("#clear").value,
    prec: $("#prec").value, seal: $("input[name=seal]:checked").value,
  };
  if (i.Fr + i.Fa <= 0 || i.N <= 0 || i.Lh <= 0) { alert("Please enter positive load, speed and life values."); return; }
  i.a1 = A1[i.R]; i.L10 = 60 * i.N * i.Lh / 1e6;

  const pool = DATA.filter(r => r.t === i.t && r.d === i.d && (i.mfr === "ALL" || r.m === i.mfr) &&
    (i.t !== "DG" || (i.seal === "open" ? !r.sx : i.seal === "shield" ? isShield(r) : isSealed(r))));
  const noData = pool.filter(r => !r.C);
  const rows = pool.filter(r => r.C).map(r => evaluate(r, i)).sort((a, b) => a.D - b.D || a.C - b.C);
  const best = rows.filter(r => r.ok).sort((a, b) => a.C - b.C)[0];
  const ref = best || rows.slice().sort((a, b) => b.C - a.C)[0];
  renderResult(i, rows, best, ref, noData);
  lastRun = ref ? { inp: i, ref } : null;
});

function buildAlerts(i, b) {
  const A = [];
  if (!b) return A;
  const gRatio = i.N / b.nG;
  if (i.lube === "grease" && gRatio > .7) A.push(["warn", `Speed is ${fmt(gRatio * 100, 0)} % of the grease speed rating – grease deteriorates faster. Consider oil lubrication or relubrication intervals.`]);
  if (i.lube === "grease" && i.T > 110) A.push(["bad", `${i.T} °C exceeds the standard grease limit (~110 °C). Use high-temperature grease or oil.`]);
  if (i.lube === "oil" && (isSealed(b) || isShield(b))) A.push(["info", "Sealed/shielded bearings are greased for life; oil bath lubrication cannot reach the raceways. Choose an open bearing for oil."]);
  if (isSealed(b) && i.N > b.nG) A.push(["bad", "Speed exceeds the contacting seal-lip limit. Use shields (2Z / 2ZR) or an open bearing."]);
  if (i.N > b.nLim) A.push(["bad", "Speed exceeds the standard cage speed rating. Consider a machined brass / polyamide cage or a larger bearing."]);
  if (isSealed(b) && i.T > 100) A.push(["bad", "Temperature exceeds the NBR seal limit (~100 °C). Specify FKM seals."]);
  if (i.T > 120) A.push(["bad", "Above 120 °C, rings need heat stabilisation (S1) and the cage material must be checked."]);
  const tight = ["m5", "m6", "n6"].includes(i.shaftFit) || ["K7", "M7", "N7"].includes(i.housingFit);
  if ((tight || i.T > 90) && (i.clear === "CN" || i.clear === "C2")) A.push(["warn", "Interference fits and/or high temperature reduce internal clearance – C3 is recommended to avoid preload and overheating."]);
  if (i.t === "AC1") A.push(["info", "Single-row angular contact bearings carry axial load in one direction only – mount in pairs (back-to-back DB or face-to-face DF) or adjust against a second bearing."]);
  if (i.t === "SA" && /K/.test(b.sx)) A.push(["info", "Tapered bore (K): mount on an adapter or withdrawal sleeve; clearance reduction during mounting must be checked."]);
  if (i.t === "SA" && i.Fa > .3 * i.Fr) A.push(["warn", "Self-aligning ball bearings have limited axial capacity; consider angular contact bearings for high axial load."]);
  if (i.prec !== "P0" && ["j6", "k6", "m6"].includes(i.shaftFit)) A.push(["info", `${i.prec} precision is normally paired with grade-5 shaft seats (j5/k5/m5) to keep running accuracy.`]);
  if (!b.statOK) A.push(["bad", `Static safety s₀ = ${fmt(b.s0)} is below the required ${i.s0}.`]);
  if (!A.length) A.push(["info", "No conflicts detected between load, speed, lubrication, temperature, interfaces and sealing."]);
  return A;
}

const SEAL_N = { open: "Open (no seals)", shield: "Metal shields both sides", seal: "Rubber seals both sides" };
const CLEAR_N = { C2: "C2 – smaller than normal", CN: "Normal (CN)", C3: "C3 – larger than normal", C4: "C4 – larger than C3" };
const PREC_N = { P0: "Normal (P0 / ABEC 1)", P6: "P6 (ABEC 3)", P5: "P5 (ABEC 5)", P4: "P4 (ABEC 7)" };
const desig = (b, i) => b.p + (i.clear === "CN" ? "" : "/" + i.clear) + (i.prec === "P0" ? "" : "/" + i.prec);

function renderResult(i, rows, best, ref, noData) {
  const out = $("#selOut");
  if (!rows.length) {
    out.innerHTML = `<div class="fade empty">${bearingSVG({ spin: false })}<p><b>No catalogue entries with data</b> for ${TYPES[i.t].name}, d = ${i.d} mm${i.t === "DG" ? ", " + SEAL_N[i.seal].toLowerCase() : ""}.${noData.length ? `<br>${noData.length} part number(s) exist but have no rating data (e.g. ${noData.slice(0, 3).map(r => r.m + " " + r.p).join(", ")}).` : ""}</p></div>`;
    $("#chartCard").hidden = true; $("#candCard").hidden = true; return;
  }
  const lim = ref.Llube < ref.Lrace ? "Lubricant" : "Raceways / rolling elements";
  const st = (ok, warn) => ok ? '<span class="badge b-ok">OK</span>' : warn ? '<span class="badge b-warn">Check</span>' : '<span class="badge b-bad">Limit</span>';
  const alerts = buildAlerts(i, ref);
  let h = `<div class="fade">`;
  h += best
    ? `<div class="pick"><div>${bearingSVG({ type: i.t, seal: isSealed(best) || isShield(best) })}</div>
        <div><div class="tag">Recommended · ${best.m}</div><div class="pn">${desig(best, i)}</div>
        <div class="meta">${TYPES[i.t].name} · <b>${best.d} × ${best.D} × ${best.B} mm</b><br>
        C = <b>${fmt(best.C)} kN</b> ≥ C<sub>req</sub> ${fmt(best.Creq)} kN · C₀ = ${fmt(best.C0)} kN · n<sub>lim</sub> ≈ <b>${fmt(best.nLim, 0)} rpm</b><br>
        ${best.desc}</div></div></div>`
    : `<div class="pick fail"><div>${bearingSVG({ spin: false })}</div><div><div class="tag" style="color:var(--bad)">No suitable bearing</div>
        <div class="meta"><b>None of the ${rows.length} candidates with d = ${i.d} mm satisfies load rating, speed and static safety together.</b><br>
        Try a larger shaft diameter, another bearing type or series, lower life/reliability, or different lubrication/sealing. Values below refer to the strongest candidate (${ref.m} ${ref.p}).</div></div></div>`;
  h += `<div class="stats">
    <div class="stat"><div class="k">Required L₁₀</div><div class="v">${fmt(i.L10, 1)} <small>Mrev</small></div></div>
    <div class="stat"><div class="k">Equiv. load P</div><div class="v">${fmt(ref.P, 3)} <small>kN</small></div></div>
    <div class="stat hl"><div class="k">Required C</div><div class="v">${fmt(ref.Creq)} <small>kN</small></div></div>
    <div class="stat"><div class="k">System life</div><div class="v">${fmt(ref.Lsys, 0)} <small>h</small></div></div>
    <div class="stat"><div class="k">Static safety s₀</div><div class="v">${fmt(ref.s0)}</div></div></div>`;
  h += `<h4>Configuration summary</h4><div class="sumg">
    <div class="sum"><div class="k">Bearing type</div><div class="v">${TYPES[i.t].name}</div></div>
    <div class="sum"><div class="k">Precision / stability</div><div class="v">${PREC_N[i.prec]}${i.T > 120 ? " + S1" : ""}</div></div>
    <div class="sum"><div class="k">Clearance class</div><div class="v">${CLEAR_N[i.clear]}</div></div>
    <div class="sum"><div class="k">Sealing</div><div class="v">${ref.desc}</div></div>
    <div class="sum"><div class="k">Fits shaft / housing</div><div class="v">${i.shaftFit} / ${i.housingFit}</div></div>
    <div class="sum"><div class="k">Lubrication</div><div class="v">${i.lube === "oil" ? "Oil bath" : "Grease"} · ${i.T} °C</div></div></div>`;
  const cageOK = i.N <= ref.nLim && i.T <= 120, sealOK = !(isSealed(ref) && (i.N > ref.nG || i.T > 100));
  h += `<h4>System life breakdown — limited by <span style="color:var(--amber)">${lim}</span></h4><div class="comp">
    <div class="comp-row"><b>Raceways</b><span class="d">ISO 281: L = a₁(C/P)³ → ${fmt(ref.Lrace, 0)} h</span>${st(ref.Lrace >= i.Lh)}</div>
    <div class="comp-row"><b>Rolling elements</b><span class="d">Included in the same dynamic rating C</span>${st(ref.Lrace >= i.Lh)}</div>
    <div class="comp-row"><b>Cage</b><span class="d">Speed limit ≈ ${fmt(ref.nLim, 0)} rpm (${i.lube})</span>${st(cageOK)}</div>
    <div class="comp-row"><b>Lubricant</b><span class="d">${ref.Llube === Infinity ? "Oil bath – not life-limiting with regular oil changes" : "Estimated grease life ≈ " + fmt(ref.Llube, 0) + " h"}</span>${st(ref.Llube >= i.Lh, ref.Llube >= .5 * i.Lh)}</div>
    <div class="comp-row"><b>Seals</b><span class="d">${ref.desc}</span>${st(sealOK)}</div></div>`;
  h += `<h4>Engineering checks</h4><div class="alerts">${alerts.map(([t, m]) => `<div class="alert ${t}">${m}</div>`).join("")}</div>`;
  h += `<h4>Calculation steps</h4><div class="steps-box">
    1. L₁₀,req = 60·N·L₁₀ₕ / 10⁶ = 60 × ${i.N} × ${i.Lh} / 10⁶ = <b>${fmt(i.L10)} million rev</b><br>
    2. ${i.t === "DG" ? `Fₐ/C₀ = ${fmt(i.Fa, 3)} / ${fmt(ref.C0)} = ${fmt(i.Fa / ref.C0, 4)} → e = ${fmt(ref.e, 3)}` : `e = ${fmt(ref.e, 2)} (${TYPES[i.t].name})`}; Fₐ/Fᵣ = ${i.Fr ? fmt(i.Fa / i.Fr, 3) : "∞"} → X = ${fmt(ref.X)}, Y = ${fmt(ref.Y)}<br>
    3. P = Kₐ(X·Fᵣ + Y·Fₐ) = ${i.Ka} × (${fmt(ref.X)} × ${i.Fr} + ${fmt(ref.Y)} × ${i.Fa}) = <b>${fmt(ref.P, 3)} kN</b><br>
    4. C<sub>req</sub> = P·(L₁₀,req / a₁)<sup>1/3</sup> = ${fmt(ref.P, 3)} × (${fmt(i.L10)} / ${i.a1})<sup>1/3</sup> = <b>${fmt(ref.Creq)} kN</b><br>
    5. Select the lowest C ≥ C<sub>req</sub> with N ≤ n<sub>lim</sub> and s₀ ≥ ${i.s0} → <b>${best ? best.m + " " + best.p : "none"}</b><br>
    6. System life = min(L<sub>raceway</sub>, L<sub>lubricant</sub>) = <b>${fmt(ref.Lsys, 0)} h</b></div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-sec btn-sm" onclick="window.print()">Print result</button>
    <span class="badge b-est" style="align-self:center">D, B, C, C₀ and speeds are estimated – verify in the official catalogue</span></div></div>`;
  out.innerHTML = h;

  // candidates table
  $("#candCard").hidden = false; $("#candD").textContent = i.d;
  let t = `<div class="tbl-wrap fade"><table><thead><tr><th>Part number</th><th>Description</th><th>D × B</th><th>C kN</th><th>C₀ kN</th><th>P kN</th><th>C req</th><th>n lim</th><th>Life h</th><th>s₀</th><th>Status</th></tr></thead><tbody>`;
  rows.forEach(r => {
    const s = r.ok ? '<span class="badge b-ok">Suitable</span>' : !r.capOK ? '<span class="badge b-bad">Low C</span>' : !r.spdOK ? '<span class="badge b-bad">Speed</span>' : '<span class="badge b-bad">Static</span>';
    t += `<tr class="${r === best ? "best" : ""}"><td class="s"><span class="badge b-m">${r.m}</span> ${r.p}</td><td>${r.desc}</td><td>${r.D} × ${r.B}</td><td class="s">${fmt(r.C)}</td><td>${fmt(r.C0)}</td><td>${fmt(r.P, 3)}</td><td>${fmt(r.Creq)}</td><td>${fmt(r.nLim, 0)}</td><td>${fmt(r.Lsys, 0)}</td><td>${fmt(r.s0)}</td><td>${s}</td></tr>`;
  });
  $("#candOut").innerHTML = t + "</tbody></table></div>";
  drawChart(i, ref);
  if (innerWidth < 1050) out.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------------------
   5. CHART – Estimated bearing life vs operating speed
   --------------------------------------------------------------- */
function drawChart(i, b) {
  const card = $("#chartCard"); card.hidden = false;
  card.classList.remove("fade"); void card.offsetWidth; card.classList.add("fade");
  if (typeof Chart === "undefined") { $("#chartNote").textContent = "Graph unavailable – Chart.js could not load (offline). Calculations are unaffected."; return; }
  const css = getComputedStyle(root), c = v => css.getPropertyValue(v).trim();
  const nMax = Math.max(b.nO || b.nG, i.N * 1.3), sp = [], race = [], lube = [], sys = [];
  for (let k = 1; k <= 40; k++) {
    const n = Math.round(nMax * k / 40); sp.push(n);
    const P = i.Ka * (b.X * i.Fr + b.Y * i.Fa), Lr = racewayLife(b.C, P, n, i.a1);
    const Ll = (i.lube === "oil" && !isSealed(b) && !isShield(b)) ? Infinity : greaseLife(TYPES[b.t].K, n, b.d, i.T);
    race.push(Lr); lube.push(isFinite(Ll) ? Ll : null); sys.push(Math.min(Lr, Ll));
  }
  const ds = [
    { label: "System life", data: sys, borderColor: c("--amber"), borderWidth: 3, tension: .3, pointRadius: 0 },
    { label: "Raceway fatigue life", data: race, borderColor: c("--silver") || "#c9ced6", borderWidth: 2, borderDash: [6, 4], tension: .3, pointRadius: 0 },
    { label: `Target (${i.Lh} h)`, data: sp.map(() => i.Lh), borderColor: c("--ok"), borderWidth: 1.5, borderDash: [2, 4], pointRadius: 0 },
  ];
  if (lube.some(x => x !== null)) ds.splice(2, 0, { label: "Grease life", data: lube, borderColor: c("--copper"), borderWidth: 2, borderDash: [3, 3], tension: .3, pointRadius: 0 });
  if (chart) chart.destroy();
  chart = new Chart($("#lifeChart"), {
    type: "line", data: { labels: sp, datasets: ds },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 900, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: c("--muted"), font: { family: "Inter" } } },
        tooltip: { callbacks: { title: t => `${t[0].label} rpm`, label: t => `${t.dataset.label}: ${fmt(t.raw, 0)} h` } } },
      scales: { x: { title: { display: true, text: "Operating speed N (rpm)", color: c("--muted") }, ticks: { color: c("--faint"), maxTicksLimit: 10 }, grid: { color: c("--line") } },
        y: { type: "logarithmic", title: { display: true, text: "Estimated life (h, log scale)", color: c("--muted") }, ticks: { color: c("--faint") }, grid: { color: c("--line") } } } },
  });
  $("#chartNote").textContent = `${b.m} ${b.p} at Fr = ${i.Fr} kN, Fa = ${i.Fa} kN, ${i.T} °C, ${i.lube}. System life follows the weakest component.`;
}

/* ---------------------------------------------------------------
   6. CATALOGUE BROWSER
   --------------------------------------------------------------- */
const fBore = $("#fBore");
[...new Set(DATA.map(r => r.d))].sort((a, b) => a - b).forEach(d => fBore.add(new Option(d + " mm", d)));
let page = 1; const PER = 25;
function filtered() {
  const q = $("#fSearch").value.trim().toLowerCase(), m = $("#fMfr").value, t = $("#fType").value, d = $("#fBore").value, s = $("#fSeal").value;
  return DATA.filter(r => (!q || (r.p + " " + r.desc + " " + r.cat).toLowerCase().includes(q)) && (m === "ALL" || r.m === m) &&
    (t === "ALL" || r.t === t) && (d === "ALL" || r.d === +d) &&
    (s === "ALL" || (s === "open" ? !r.sx || !/Z|RS/.test(r.sx) : s === "shield" ? isShield(r) : isSealed(r))));
}
function renderCat() {
  const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
  page = Math.min(page, pages);
  $("#catCount").textContent = `${list.length.toLocaleString()} of ${DATA.length.toLocaleString()} part numbers`;
  let h = `<table><thead><tr><th>Mfr</th><th>Part number</th><th>Type</th><th>Series</th><th>d</th><th>D</th><th>B</th><th>C kN*</th><th>C₀ kN*</th><th>n grease*</th><th>Description</th><th></th></tr></thead><tbody>`;
  list.slice((page - 1) * PER, page * PER).forEach(r => {
    h += `<tr><td><span class="badge b-m">${r.m}</span></td><td class="s">${r.p}</td><td>${r.cat}</td><td>${r.s}</td><td>${r.d}</td><td>${r.D ?? "–"}</td><td>${r.B ?? "–"}</td>
      <td class="s">${r.C ? fmt(r.C) : "–"}</td><td>${r.C0 ? fmt(r.C0) : "–"}</td><td>${r.nG ? r.nG.toLocaleString() : "–"}</td><td>${r.desc}</td>
      <td>${r.C ? `<button class="btn btn-sec btn-sm" data-use="${r.m}|${r.t}|${r.d}">Use</button>` : ""}</td></tr>`;
  });
  $("#catTable").innerHTML = h + "</tbody></table>";
  $("#pageInfo").textContent = `Page ${page} / ${pages}`;
  $("#prev").disabled = page <= 1; $("#next").disabled = page >= pages;
}
["#fSearch", "#fMfr", "#fType", "#fBore", "#fSeal"].forEach(s => $(s).addEventListener("input", () => { page = 1; renderCat(); }));
$("#prev").addEventListener("click", () => { page--; renderCat(); });
$("#next").addEventListener("click", () => { page++; renderCat(); });
$("#catTable").addEventListener("click", e => {
  const b = e.target.closest("[data-use]"); if (!b) return;
  const [m, t, d] = b.dataset.use.split("|");
  $(`input[name=type][value=${t}]`).checked = true; syncSealOptions();
  $("#mfr").value = m; $("#d").value = d;
  location.hash = "#selector";
});
renderCat();

/* ---------------------------------------------------------------
   7. LAB CALCULATORS
   --------------------------------------------------------------- */
// Problem 2 – work cycle
$("#addEl").addEventListener("click", () => {
  const tb = $("#cycBody"), n = tb.rows.length + 1;
  tb.insertAdjacentHTML("beforeend", `<tr><td>${n}</td><td><input value="0"></td><td><input value="0"></td><td><input value="0"></td></tr>`);
});
$("#cycBtn").addEventListener("click", () => {
  let nAvg = 0, sNP3 = 0, sN = 0, tSum = 0;
  [...$("#cycBody").rows].forEach(r => {
    const [P, n, t] = [...r.querySelectorAll("input")].map(x => +x.value);
    const N = n * t / 100; nAvg += N; sNP3 += N * P ** 3; sN += N; tSum += t;
  });
  const Pe = Math.cbrt(sNP3 / sN), C = +$("#cycC").value, L10 = (C / Pe) ** 3, Lh = L10 * 1e6 / (60 * nAvg);
  $("#cycOut").innerHTML = `<div class="steps-box fade">${Math.abs(tSum - 100) > .01 ? `<span style="color:var(--warn)">⚠ Time fractions add to ${tSum} %, not 100 %.</span><br>` : ""}
    (i) Average speed n<sub>avg</sub> = Σ(nᵢ·tᵢ) = <b>${fmt(nAvg)} rpm</b><br>
    (ii) Pₑ = [ΣNᵢPᵢ³ / ΣNᵢ]<sup>1/3</sup> = <b>${fmt(Pe)} N</b><br>
    (iii) L₁₀ = (C/Pₑ)³ = <b>${fmt(L10)} million rev</b> = <b>${fmt(Lh)} h</b></div>`;
});
// Problem 3 – life with given X, Y
$("#lifeBtn").addEventListener("click", () => {
  const g = id => +$("#" + id).value;
  const P = g("lX") * g("lV") * g("lFr") + g("lY") * g("lFa"), L10 = (g("lC") / P) ** g("lp"), a1 = A1[g("lR")] ?? 1;
  const L = a1 * L10, Lh = L * 1e6 / (60 * g("ln"));
  $("#lifeOut").innerHTML = `<div class="steps-box fade">P = X·V·Fᵣ + Y·Fₐ = <b>${fmt(P)} N</b><br>
    L₁₀ = (C/P)<sup>${g("lp") === 3 ? "3" : "10/3"}</sup> = <b>${fmt(L10)} million rev</b><br>
    Reliability ${g("lR")} % → L = ${a1} × L₁₀ = <b>${fmt(L)} million rev</b><br>
    Lₕ = L × 10⁶ / (60n) = <b>${fmt(Lh)} h</b></div>`;
});
// Reliability – R = e^-(L/a)^b
$("#relBtn").addEventListener("click", () => {
  const R = +$("#rR").value / 100, L10 = +$("#rL10").value, N = +$("#rN").value;
  const ratio = Math.pow(Math.log(1 / R) / Math.log(1 / .9), 1 / 1.17);
  $("#relOut").innerHTML = `<div class="steps-box fade">L/L₁₀ = [ln(1/R) / ln(1/0.9)]<sup>1/1.17</sup> = <b>${fmt(ratio, 4)}</b><br>
    Life at ${fmt(R * 100, 1)} % reliability = <b>${fmt(ratio * L10)} million rev</b><br>
    System reliability R<sub>S</sub> = R<sup>N</sup> = ${fmt(R, 3)}<sup>${N}</sup> = <b>${fmt(Math.pow(R, N) * 100, 2)} %</b></div>`;
});

setTheme(saved);
})();
