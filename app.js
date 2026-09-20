let PALS = [], BY_CODE = {}, BY_NAME = {}, LOOKUP = {}, SPECIAL_SET = new Set(), GENDER_MAP = {};
let COMBOS = [], FILTERED = [], page = 0;
const PAGE_SIZE = 100;

const $ = (id) => document.getElementById(id);

const EGG_SVG = '<span class="egg-fallback" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">' +
  '<path d="M12 2.5c3.2 0 6.5 5.4 6.5 10.2 0 3.9-2.9 6.8-6.5 6.8s-6.5-2.9-6.5-6.8C5.5 7.9 8.8 2.5 12 2.5Z" fill="#fff" stroke="#b9b2a6" stroke-width="1.5"/>' +
  '<path d="M9 12.5c.8-.9 1.7-1 2.4-.3l1.2 1.2c.6.6 1.5.5 2.1-.1" stroke="#b9b2a6" stroke-width="1.3" stroke-linecap="round"/></svg></span>';
const EGG_SVG_SM = EGG_SVG.replace('egg-fallback"', 'egg-fallback sm"');

// Inline SVG fallback when a Pal icon fails to load (offline-safe, no emoji).
window.palImgFail = function (img) {
  const t = document.createElement("span");
  t.innerHTML = img.classList.contains("sm") ? EGG_SVG_SM : EGG_SVG;
  img.replaceWith(t.firstChild);
};

function palImg(p, sm) {
  return `<img class="thumb${sm ? " sm" : ""}" src="${p.icon}" alt="" loading="lazy" onerror="palImgFail(this)" />`;
}

function palLabel(p) { return `${p.name} #${p.paldex}`; }

function resolvePal(input) {
  if (!input) return null;
  const q = input.trim().toLowerCase();
  if (BY_NAME[q]) return BY_NAME[q];
  // allow "Name #123" format
  const m = q.match(/^(.+?)\s*#\d+/);
  if (m && BY_NAME[m[1].trim()]) return BY_NAME[m[1].trim()];
  // prefix match
  const hit = PALS.find((p) => p.name.toLowerCase().startsWith(q));
  return hit || null;
}

function pairKey(a, b) { return [a, b].sort().join("+"); }
function isSpecial(a, b, child) { return SPECIAL_SET.has(`${pairKey(a, b)}=${child}`); }
function targetPower(a, b) { return Math.floor((a.power + b.power + 1) / 2); }

function elBadges(p) { return p.elements.map((e) => `<span class="el">${e}</span>`).join(""); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function rarityLabel(p) { return p && p.rarity === 20 ? "Legendary" : `Rarity ${p ? p.rarity : "?"}`; }

const STRONGEST_TITLE = "Strongest = highest base-stat total (datamined base HP+ATK+DEF), not a live-damage guarantee";

let STAT_MAX = null;
function statMaxes() {
  if (STAT_MAX) return STAT_MAX;
  let hp = 1, atk = 1, def = 1;
  for (const p of PALS) {
    if (p.hp > hp) hp = p.hp;
    if (p.atk > atk) atk = p.atk;
    if (p.def > def) def = p.def;
  }
  STAT_MAX = { hp, atk, def };
  return STAT_MAX;
}

function isStrongestOn() {
  const el = $("all-strongest");
  return !!(el && el.checked);
}

function minRarityValue() {
  const el = $("all-minrarity");
  if (!el || el.value == null || el.value === "") return 0;
  const v = Number(el.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// ---- Pal detail modal (teammate owns #pal-modal markup/CSS; all nodes guarded) ----
window.closePalDetail = function () {
  const m = $("pal-modal");
  if (!m) return;
  m.hidden = true;
  if (m.classList) m.classList.remove("open");
  m.setAttribute("aria-hidden", "true");
};

window.openPalDetail = function (code) {
  const p = BY_CODE[code];
  if (!p) return;
  const body = $("pm-body");
  const modal = $("pal-modal");
  if (!body || !modal) return;
  const max = statMaxes();
  const pct = (v, m) => `${Math.max(0, Math.min(100, (v / m) * 100)).toFixed(1)}%`;
  const statRow = (label, v, m) =>
    `<div class="stat"><span>${label}</span><span class="bar"><i style="width:${pct(v, m)}"></i></span><b>${esc(v)}</b></div>`;
  let kvRows = `<div class="kv"><dt>Rarity</dt><dd>${esc(rarityLabel(p))}</dd></div>` +
    `<div class="kv"><dt>Size</dt><dd>${esc(p.size)}</dd></div>` +
    `<div class="kv"><dt>Egg</dt><dd>${esc(p.egg)}</dd></div>` +
    `<div class="kv"><dt>Power</dt><dd>${esc(p.power)}</dd></div>` +
    `<div class="kv"><dt>Male rate</dt><dd>♂ ${esc(p.male)}%</dd></div>`;
  if (p.ride) {
    kvRows += `<div class="kv"><dt>Rides</dt><dd>${p.mount && p.mount.type ? esc(p.mount.type) : "Yes"}${p.mount && p.mount.speed != null ? ` ${esc(p.mount.speed)}` : ""}</dd></div>`;
  }
  if (p.partner && (p.partner.name || p.partner.desc)) {
    kvRows += `<div class="kv"><dt>Partner</dt><dd><strong>${esc(p.partner.name || "Partner skill")}</strong>${p.partner.desc ? `<div class="dim">${esc(p.partner.desc)}</div>` : ""}</dd></div>`;
  }
  const workEntries = (p.work && typeof p.work === "object") ? Object.entries(p.work) : [];
  if (workEntries.length) {
    kvRows += `<div class="kv"><dt>Work</dt><dd>${workEntries.map(([skill, lv]) => `<span class="badge">${esc(skill)} Lv${esc(lv)}</span>`).join(" ")}</dd></div>`;
  }
  body.innerHTML =
    `<div class="pm-head">${palImg(p)}<div><h2 id="pm-name">${esc(p.name)}</h2>` +
    `<p class="pm-sub">#${esc(p.paldex)}${p.variant ? ` · variant` : ""}</p>` +
    `<div class="chip-row">${elBadges(p)}${p.variant ? ` <span class="badge variant">variant</span>` : ""}` +
    ` <span class="el${p.rarity === 20 ? " legendary" : ""}">${esc(rarityLabel(p))}</span></div></div></div>` +
    `<div class="pm-sec"><h3>Base stats</h3><div class="stats">` +
    statRow("HP", p.hp, max.hp) + statRow("ATK", p.atk, max.atk) + statRow("DEF", p.def, max.def) +
    `<div class="stat"><span>Total</span><span class="bar"><i style="width:${pct(p.total, max.hp + max.atk + max.def)}"></i></span><b>${esc(p.total)}</b></div>` +
    `</div></div>` +
    `<div class="pm-sec"><h3>Details</h3><dl>` + kvRows + `</dl></div>` +
    `<div style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">` +
    `<button class="link" id="pm-find">Find parents →</button>` +
    `<button class="link" id="pm-useA">Use as Parent A</button></div>`;
  modal.hidden = false;
  if (modal.classList) modal.classList.add("open");
  modal.removeAttribute("aria-hidden");
  const findBtn = document.getElementById("pm-find");
  if (findBtn) findBtn.onclick = () => {
    window.closePalDetail();
    switchTab("find");
    const t = $("target");
    if (t) t.value = p.name;
    doFind();
  };
  const useBtn = document.getElementById("pm-useA");
  if (useBtn) useBtn.onclick = () => {
    window.closePalDetail();
    switchTab("breed");
    const a = $("parentA");
    if (a) a.value = p.name;
    doBreed();
  };
};

const TIP_TEXT = "Target power = floor((A power + B power + 1) / 2). The game picks the Pal whose power is closest to this number (special pairs override it). It is NOT a success chance — the species result is guaranteed.";
function tipHtml() {
  return ` <span class="tip" tabindex="0" data-tip="${TIP_TEXT}">?</span>`;
}

// ---- searchable combobox (one component, reused for Parent A / Parent B / Target) ----
const combos = [];
function createCombo(inputId, onPick) {
  const input = $(inputId);
  const panel = document.getElementById(`${inputId}-list`);
  const state = { input, panel, items: [], active: -1, onPick };
  combos.push(state);

  function close() {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    state.active = -1;
  }
  state.close = close;

  function open() { render(); }

  function render() {
    const q = input.value.trim().toLowerCase();
    const items = q
      ? PALS.filter((p) => p.name.toLowerCase().includes(q))
      : PALS.slice();
    state.items = items;
    state.active = items.length ? 0 : -1;
    const shown = items;
    let html = shown.map((p, i) =>
      `<button type="button" class="combo-opt${i === state.active ? " active" : ""}" role="option" ` +
      `id="${inputId}-opt-${i}" aria-selected="${i === state.active}" data-code="${p.code}">` +
      `${palImg(p, true)}<span class="nm">${p.name}</span><span class="dex">#${p.paldex}</span>` +
      `<span class="pw">power ${p.power}</span></button>`
    ).join("");
    if (!items.length) html = `<div class="combo-none">No Pals match “${input.value.trim()}”.</div>`;
    panel.innerHTML = html;
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (state.active >= 0) input.setAttribute("aria-activedescendant", `${inputId}-opt-${state.active}`);
    else input.removeAttribute("aria-activedescendant");
    panel.querySelectorAll(".combo-opt").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus for keyboard flow
      btn.onclick = () => select(btn.dataset.code);
    });
  }

  function highlight() {
    panel.querySelectorAll(".combo-opt").forEach((btn, i) => {
      btn.classList.toggle("active", i === state.active);
      btn.setAttribute("aria-selected", String(i === state.active));
    });
    if (state.active >= 0) {
      input.setAttribute("aria-activedescendant", `${inputId}-opt-${state.active}`);
      const el = panel.querySelector(`#${CSS.escape(inputId)}-opt-${state.active}`);
      if (el) el.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }

  function select(code) {
    const p = BY_CODE[code];
    if (!p) return;
    input.value = p.name;
    close();
    state.onPick();
  }

  input.addEventListener("focus", () => { if (PALS.length) open(); });
  input.addEventListener("input", () => { if (PALS.length) render(); state.onPick(); });
  input.addEventListener("keydown", (e) => {
    if (panel.hidden) {
      if ((e.key === "ArrowDown" || e.key === "Enter") && PALS.length) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); if (state.items.length) { state.active = (state.active + 1) % state.items.length; highlight(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (state.items.length) { state.active = (state.active - 1 + state.items.length) % state.items.length; highlight(); } }
    else if (e.key === "Enter") { e.preventDefault(); if (state.active >= 0 && state.items[state.active]) select(state.items[state.active].code); else state.onPick(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); input.blur(); }
  });
  input.addEventListener("blur", () => setTimeout(() => {
    // only close if focus left the whole combo (lets the panel scrollbar drag without closing)
    if (!panel.contains(document.activeElement) && document.activeElement !== input) close();
  }, 120));
  // mousedown on panel chrome (e.g. scrollbar) must not blur the input, or the panel closes mid-scroll
  panel.addEventListener("mousedown", (e) => { if (!e.target.closest(".combo-opt")) e.preventDefault(); });
  return state;
}

async function load() {
  const [pals, lookup, specials] = await Promise.all([
    fetch("data/pals.json").then((r) => r.json()),
    fetch("data/lookup.json").then((r) => r.json()),
    fetch("data/specials.json").then((r) => r.json()),
  ]);
  PALS = pals;
  STAT_MAX = null;
  BY_CODE = Object.fromEntries(pals.map((p) => [p.code, p]));
  BY_NAME = Object.fromEntries(pals.map((p) => [p.name.toLowerCase(), p]));
  LOOKUP = lookup;
  for (const s of specials) {
    const k = `${pairKey(s.parent_a_code, s.parent_b_code)}=${s.child_code}`;
    SPECIAL_SET.add(k);
  }
  window.GENDER_MAP = window.GENDER_MAP || {};
  for (const s of specials) {
    if (!s.gender_locked) continue;
    const k = `${pairKey(s.parent_a_code, s.parent_b_code)}=${s.child_code}`;
    window.GENDER_MAP[k] = { aCode: s.parent_a_code, bCode: s.parent_b_code, p1: s.p1_gender, p2: s.p2_gender, aName: s.parent_a, bName: s.parent_b };
  }
  $("stat-pals").textContent = PALS.length;
  $("stat-combos").textContent = Object.keys(LOOKUP).length.toLocaleString();

  // element filter, populated from data (canonical display order)
  const order = ["Neutral", "Fire", "Water", "Grass", "Electric", "Ice", "Ground", "Dark", "Dragon"];
  const present = new Set();
  for (const p of PALS) for (const e of p.elements) present.add(e);
  const sel = $("all-element");
  for (const e of order.filter((x) => present.has(x))) {
    const o = document.createElement("option");
    o.value = e; o.textContent = e;
    sel.appendChild(o);
  }
  const csel = $("combat-element");
  if (csel) {
    for (const e of order.filter((x) => present.has(x))) {
      const o = document.createElement("option");
      o.value = e; o.textContent = e;
      csel.appendChild(o);
    }
  }

  // precompute flat combos for All tab
  COMBOS = Object.entries(LOOKUP).map(([k, child]) => {
    const [a, b] = k.split("+");
    const pa = BY_CODE[a], pb = BY_CODE[b], pc = BY_CODE[child];
    const avg = pa && pb ? targetPower(pa, pb) : 0;
    return { a, b, child, avg, special: isSpecial(a, b, child), pa, pb, pc };
  });
  FILTERED = COMBOS;
  seedRosterIfNew();
  renderAll();
  renderBase();
  renderMounts();
  renderCombat();
  if (typeof renderRoster === "function") renderRoster();
  try { parseShare(); } catch (err) {}
}

// ---- Breed tab ----
function doBreed() {
  const a = resolvePal($("parentA").value), b = resolvePal($("parentB").value);
  const box = $("breed-result");
  if (!a || !b) { box.className = "result empty"; box.textContent = "Pick two valid parents to see the child."; return; }
  const childCode = LOOKUP[pairKey(a.code, b.code)];
  const c = BY_CODE[childCode];
  if (!c) { box.className = "result empty"; box.textContent = "No result for that pair (data gap)."; return; }
  const avg = targetPower(a, b);
  const special = isSpecial(a.code, b.code, c.code);
  const g = (window.GENDER_MAP || {})[`${pairKey(a.code, b.code)}=${c.code}`];
  const locked = !!g;
  const gl = (v) => (v === "FEMALE" ? "F" : "M");
  const ga = g ? gl(a.code === g.aCode ? g.p1 : g.p2) : "";
  const gb = g ? gl(b.code === g.bCode ? g.p2 : g.p1) : "";
  const lockNote = locked ? `Needs ${esc(a.code === g.aCode ? g.aName : g.bName)}(${ga}) + ${esc(b.code === g.bCode ? g.bName : g.aName)}(${gb})` : "";
  const parentsAvg = Math.round((a.total + b.total) / 2);
  const delta = c.total - parentsAvg;
  const deltaTxt = (delta >= 0 ? "+" : "") + delta;
  let maleWarn = "";
  if (c.male <= 20) maleWarn = ` <span class="dim">low male rate - may need many eggs for a male</span>`;
  else if (c.male >= 80) maleWarn = ` <span class="dim">high male rate - may need many eggs for a female</span>`;
  box.className = "result";
  box.innerHTML = `
    <div class="parents-line dim"><span class="clickable" data-pal="${a.code}">${palImg(a, true)} ${esc(a.name)}</span> <span class="dim">(power ${a.power})</span> + <span class="clickable" data-pal="${b.code}">${palImg(b, true)} ${esc(b.name)}</span> <span class="dim">(power ${b.power})</span> → Target power ${avg}${tipHtml()}</div>
    <div class="child"><span class="clickable" data-pal="${c.code}">${palImg(c)} ${esc(c.name)}</span> <span class="dim">#${c.paldex}</span>
      ${c.variant ? `<span class="badge variant">variant</span>` : ""}
      ${special ? `<span class="badge special">special</span>` : `<span class="badge formula">formula</span>`}
      ${locked ? `<span class="badge special">gender-locked</span>` : ""}
    </div>
    ${locked ? `<div class="dim">${lockNote}</div>` : ""}
    <div class="dim">HP ${c.hp} / ATK ${c.atk} / DEF ${c.def} - Total ${c.total} (${deltaTxt} vs parents avg)</div>
    <div>${elBadges(c)} <span class="dim">power ${c.power} · ♂ male rate ${c.male}%</span>${maleWarn}</div>
    <div style="margin-top:8px"><button class="link" id="see-parents">See all ${COMBOS.filter((x) => x.child === c.code).length} ways to make ${c.name} →</button></div>`;
  $("see-parents").onclick = () => {
    switchTab("find");
    $("target").value = c.name;
    doFind();
  };
  try { updateShare(); } catch (err) {}
}

// ---- Find tab ----
function genderNote(x) {
  if (!x.special) return "";
  const g = (window.GENDER_MAP || {})[`${pairKey(x.a, x.b)}=${x.child}`];
  if (!g) return "";
  const abbr = (v) => v === "FEMALE" ? "F" : v === "MALE" ? "M" : "?";
  const ga = abbr(x.a === g.aCode ? g.p1 : g.p2);
  const gb = abbr(x.b === g.bCode ? g.p2 : g.p1);
  if (ga === "?" && gb === "?") return "";
  const na = (x.a === g.aCode ? g.aName : g.bName) || x.pa.name;
  const nb = (x.b === g.bCode ? g.bName : g.aName) || x.pb.name;
  return ` <span class="dim">needs ${ga} ${esc(na)} + ${gb} ${esc(nb)}</span>`;
}

function doFind() {
  const t = resolvePal($("target").value);
  const box = $("find-result");
  const onlySpecial = $("only-special").checked;
  if (!t) { box.className = "result empty"; box.textContent = "Pick a target to list every parent pair."; return; }
  let pairs = COMBOS.filter((x) => x.child === t.code);
  if (onlySpecial) pairs = pairs.filter((x) => x.special);
  if (!pairs.length) { box.className = "result empty"; box.textContent = `No ${onlySpecial ? "special " : ""}pairs make ${t.name}.`; return; }
  const sortEl = $("find-sort");
  if (sortEl && sortEl.value === "easy") {
    pairs.sort((x, y) => ((x.pa.rarity + x.pb.rarity) - (y.pa.rarity + y.pb.rarity)) || ((x.pa.power + x.pb.power) - (y.pa.power + y.pb.power)) || (x.pa.name + x.pb.name).localeCompare(y.pa.name + y.pb.name));
  } else {
    pairs.sort((x, y) => x.avg - y.avg || (x.pa.name + x.pb.name).localeCompare(y.pa.name + y.pb.name));
  }
  var roster = null; try { roster = (typeof getRoster === 'function') ? getRoster() : null; } catch (e) { roster = null; }
  box.className = "result";
  box.innerHTML = `<div class="dim"><strong>${pairs.length}</strong> pair${pairs.length > 1 ? "s" : ""} → <strong>${esc(t.name)}</strong> ${onlySpecial ? "(special only)" : ""} <span class="dim">· total ${esc(t.total)} · male ${esc(t.male)}%</span> <span class="badge">${esc(rarityLabel(t))}</span></div>` +
    pairs.slice(0, 500).map((x, i) =>
      `<div class="pair"><span class="clickable" data-pal="${x.pa.code}">${palImg(x.pa, true)}${esc(x.pa.name)}</span> + <span class="clickable" data-pal="${x.pb.code}">${palImg(x.pb, true)}${esc(x.pb.name)}</span> <span class="dim">target power ${x.avg}</span> <span class="dim">R${x.pa.rarity}+R${x.pb.rarity}</span>
       ${x.special ? `<span class="badge special">special</span>` : ""}${genderNote(x)}${roster && roster.has(x.pa.code) && roster.has(x.pb.code) ? `<span class="badge formula">owned</span>` : ""}
       <button class="link" data-i="${i}">use →</button></div>`
    ).join("") + (pairs.length > 500 ? `<div class="dim">Showing first 500 of ${pairs.length}.</div>` : "");
  box.querySelectorAll("button.link").forEach((btn) => {
    btn.onclick = () => {
      const x = pairs[Number(btn.dataset.i)];
      switchTab("breed");
      $("parentA").value = x.pa.name;
      $("parentB").value = x.pb.name;
      doBreed();
    };
  });
  try { updateShare(); } catch (err) {}
}

// ---- All tab ----
let sortKey = null, sortDir = 1;
const SORT_LABEL = { a: "Parent A", b: "Parent B", child: "Child", avg: "Target power", hp: "HP", atk: "ATK", def: "DEF", total: "Total" };

function sortedRows(rows) {
  const strongest = isStrongestOn();
  if (!sortKey && !strongest) return rows;
  const get = {
    a: (x) => x.pa.name, b: (x) => x.pb.name, child: (x) => x.pc.name, avg: (x) => x.avg,
    hp: (x) => (x.pc ? x.pc.hp : -1), atk: (x) => (x.pc ? x.pc.atk : -1), def: (x) => (x.pc ? x.pc.def : -1), total: (x) => (x.pc ? x.pc.total : -1),
  }[sortKey];
  return rows.slice().sort((x, y) => {
    if (strongest) {
      const tx = x.pc ? x.pc.total : -Infinity, ty = y.pc ? y.pc.total : -Infinity;
      if (ty !== tx) return ty - tx; // child total desc
      const px = x.pc ? x.pc.power : Infinity, py = y.pc ? y.pc.power : Infinity;
      if (px !== py) return px - py; // tiebreak power asc
    }
    if (!get) return x.child.localeCompare(y.child);
    const gx = get(x), gy = get(y);
    const c = typeof gx === "number" ? gx - gy : String(gx).localeCompare(String(gy));
    return c * sortDir || x.child.localeCompare(y.child);
  });
}

function applyAllFilter() {
  const q = $("all-search").value.trim().toLowerCase();
  const m = $("all-method").value;
  const el = $("all-element").value;
  const pel = $("all-pelement") ? $("all-pelement").value : "";
  const varOnly = $("all-variant").checked;
  const minRar = minRarityValue();
  const work = $("all-work") ? $("all-work").value : "";
  const worklv = $("all-worklv") ? Number($("all-worklv").value) || 0 : 0;
  const egg = $("all-egg") ? $("all-egg").value : "";
  const size = $("all-size") ? $("all-size").value : "";
  const ride = $("all-ride") ? $("all-ride").value : "";
  FILTERED = COMBOS.filter((x) => {
    if (m === "special" && !x.special) return false;
    if (m === "formula" && x.special) return false;
    if (el && !x.pc.elements.includes(el)) return false;
    if (pel && !(x.pa.elements.includes(pel) || x.pb.elements.includes(pel))) return false; // either parent matches
    if (varOnly && !x.pc.variant) return false;
    if (minRar > 0 && (!x.pc || x.pc.rarity < minRar)) return false;
    // child trait filters, all guarded (some pals lack work or mount)
    if (work && (!x.pc || !x.pc.work || !(x.pc.work[work] >= Math.max(1, worklv)))) return false;
    if (egg && (!x.pc || x.pc.egg !== egg)) return false;
    if (size && (!x.pc || x.pc.size !== size)) return false;
    if (ride === "rides" && (!x.pc || x.pc.ride !== true)) return false;
    if ((ride === "Ground" || ride === "Flying" || ride === "Water") && (!x.pc || !x.pc.mount || x.pc.mount.type !== ride)) return false;
    if (!q) return true;
    return x.pa.name.toLowerCase().includes(q) || x.pb.name.toLowerCase().includes(q) || x.pc.name.toLowerCase().includes(q) || (x.pc.partner && (((x.pc.partner.name || "").toLowerCase().includes(q)) || ((x.pc.partner.desc || "").toLowerCase().includes(q)))); // also match partner skill
  });
  page = 0;
  renderAll();
}

function renderSortHeaders() {
  document.querySelectorAll(".th-sort").forEach((btn) => {
    const k = btn.dataset.sort;
    const base = SORT_LABEL[k];
    const arrow = k === sortKey ? `<span class="arrow">${sortDir === 1 ? "▲" : "▼"}</span>` : "";
    if (k === "avg") btn.innerHTML = `${base} <span class="tip" tabindex="0" data-tip="${TIP_TEXT}">?</span> ${arrow}`;
    else btn.textContent = base;
    if (arrow && k !== "avg") btn.insertAdjacentHTML("beforeend", ` ${arrow}`);
    btn.setAttribute("aria-sort", k === sortKey ? (sortDir === 1 ? "ascending" : "descending") : "none");
  });
}

function renderAll() {
  renderSortHeaders();
  const rows = sortedRows(FILTERED);
  const total = rows.length, pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(0, page), pages - 1);
  const slice = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  var roster = null; try { roster = (typeof getRoster === 'function') ? getRoster() : null; } catch (e) { roster = null; }
  $("all-body").innerHTML = slice.map((x) =>
    `<tr><td><span class="cell-pal clickable" data-pal="${x.a}">${palImg(x.pa, true)}${esc(x.pa.name)}</span></td>` +
    `<td><span class="cell-pal clickable" data-pal="${x.b}">${palImg(x.pb, true)}${esc(x.pb.name)}</span></td>` +
    `<td><span class="cell-pal clickable" data-pal="${x.child}">${palImg(x.pc, true)}<strong>${esc(x.pc.name)}</strong></span><div>${elBadges(x.pc)}</div><div class="dim">${esc(rarityLabel(x.pc))}${x.pc.variant ? " + variant" : ""} | male ${esc(x.pc.male)}%</div></td><td>${x.avg}</td><td>${esc(x.pc.hp)}</td><td>${esc(x.pc.total)}</td>
     <td>${x.special ? `<span class="badge special">special</span>` : `<span class="badge formula">formula</span>`}${roster && roster.has(x.a) && roster.has(x.b) ? `<span class="badge formula">owned</span>` : ""}</td></tr>`
  ).join("");
  $("all-meta").textContent = `${total.toLocaleString()} combos · page ${page + 1} of ${pages}`;
  $("page-info").textContent = `${page + 1} / ${pages}`;
}

// ---- Base tab: top 3 per work skill by level then total ----
const WORK_ORDER = ["Kindling", "Watering", "Planting", "Generating Electricity", "Handiwork", "Gathering", "Lumbering", "Mining", "Medicine Production", "Cooling", "Farming", "Transporting"];

function topForSkill(skill, n) {
  return PALS.filter((p) => p.work && p.work[skill] != null)
    .sort((a, b) => (b.work[skill] - a.work[skill]) || (b.total - a.total))
    .slice(0, n || 3);
}

function renderBase() {
  const box = $("base-result");
  if (!box) return;
  const inp = $("base-search");
  const q = inp && inp.value ? inp.value.trim().toLowerCase() : "";
  const skills = q ? WORK_ORDER.filter((s) => s.toLowerCase().includes(q)) : WORK_ORDER;
  if (!skills.length) { box.className = "result empty"; box.textContent = `No work skills match "${inp.value.trim()}".`; return; }
  box.className = "result";
  box.innerHTML = skills.map((s) => {
    const top = topForSkill(s, 3);
    let roster = null;
    try { roster = (typeof getRoster === "function") ? getRoster() : null; } catch (e) { roster = null; }
    const rows = top.map((p) =>
      `<div class="pair"><span class="cell-pal clickable" data-pal="${p.code}">${palImg(p, true)}${esc(p.name)}</span>` +
      `<span class="badge">Lv${esc(p.work[s])}</span><span class="dim">total ${esc(p.total)}</span>` +
      (roster && roster.has(p.code) ? `<span class="badge formula">owned</span>` : "")
    ).join("") || `<div class="dim">None.</div>`;
    return `<div style="margin-bottom:12px"><strong>${esc(s)}</strong>${rows}</div>`;
  }).join("");
}

// ---- Combat tab: base-stat ranking (no move/DPS data) ----
function renderCombat() {
  const box = $("combat-result");
  if (!box) return;
  const mode = $("combat-mode") ? $("combat-mode").value : "overall";
  const el = $("combat-element") ? $("combat-element").value : "";
  const ownedOnly = $("combat-owned") && $("combat-owned").checked;
  let roster = null;
  try { roster = (typeof getRoster === "function") ? getRoster() : null; } catch (e) { roster = null; }
  const key = mode === "attack" ? ((p) => p.atk) : mode === "tank" ? ((p) => p.hp + p.def) : ((p) => p.total);
  const list = PALS.filter((p) =>
    (!el || p.elements.includes(el)) && (!ownedOnly || (roster && roster.has(p.code)))
  ).sort((a, b) => key(b) - key(a)).slice(0, 15);
  if (!list.length) { box.className = "result empty"; box.textContent = "No pals match. Add more to your roster or clear filters."; return; }
  box.className = "result";
  const lbl = mode === "attack" ? "ATK" : mode === "tank" ? "HP+DEF" : "Total";
  box.innerHTML = `<div class="dim">Top ${list.length} by ${lbl}${el ? ` - ${esc(el)}` : ""}${ownedOnly ? " - owned" : ""}</div>` +
    list.map((p, i) =>
      `<div class="pair"><span class="dim">${i + 1}.</span><span class="cell-pal clickable" data-pal="${p.code}">${palImg(p, true)}${esc(p.name)}</span>` +
      `${elBadges(p)}<span class="dim">HP ${p.hp} / ATK ${p.atk} / DEF ${p.def} - Total ${p.total}</span>` +
      (roster && roster.has(p.code) ? `<span class="badge formula">owned</span>` : "") + `</div>`
    ).join("");
}

// ---- Mounts tab: rideable grouped by type, speed desc ----
function renderMounts() {
  const box = $("mounts-result");
  if (!box) return;
  const groups = {};
  for (const p of PALS) {
    if (!p.ride || !p.mount) continue;
    const t = (p.mount.type || "Other");
    (groups[t] = groups[t] || []).push(p);
  }
  const order = Object.keys(groups).sort();
  if (!order.length) { box.className = "result empty"; box.textContent = "No rideable Pals."; return; }
  box.className = "result";
  box.innerHTML = order.map((t) => {
    const list = groups[t].sort((a, b) => ((b.mount && b.mount.speed) || 0) - ((a.mount && a.mount.speed) || 0));
    const rows = list.map((p) =>
      `<div class="pair"><span class="cell-pal clickable" data-pal="${p.code}">${palImg(p, true)}${esc(p.name)}</span>` +
      `<span class="dim">speed ${esc(p.mount.speed != null ? p.mount.speed : "?")}</span></div>`
    ).join("");
    return `<div style="margin-bottom:12px"><strong>${esc(t)}</strong> <span class="dim">${list.length}</span>${rows}</div>`;
  }).join("");
}

// ---- Base planner: greedy set-cover over selected skills ----
function planBaseTeam() {
  const box = $("plan-result");
  if (!box) return;
  const sel = Array.from(document.querySelectorAll("#plan-skills input:checked")).map((c) => c.value);
  if (!sel.length) { box.className = "result empty"; box.textContent = "Select at least one skill."; return; }
  const need = new Set(sel);
  const ownedOnly = $("plan-owned") && $("plan-owned").checked;
  let pool = PALS.filter((p) => p.work);
  if (ownedOnly) {
    let roster = null;
    try { roster = (typeof getRoster === "function") ? getRoster() : null; } catch (e) { roster = null; }
    if (!roster || !roster.size) { box.className = "result empty"; box.textContent = "Owned only is on but your roster is empty. Add pals in the Chain tab."; return; }
    pool = pool.filter((p) => roster.has(p.code));
  }
  const ranked = pool.slice().sort((a, b) => b.total - a.total);
  const team = [];
  while (need.size) {
    let best = null, bestCover = [];
    for (const p of ranked) {
      if (team.includes(p)) continue;
      const cover = sel.filter((s) => need.has(s) && p.work[s] != null);
      if (!cover.length) continue;
      if (!best || cover.length > bestCover.length ||
        (cover.length === bestCover.length && (
          Math.max(...cover.map((s) => p.work[s])) > Math.max(...bestCover.map((s) => best.work[s])) ||
          (Math.max(...cover.map((s) => p.work[s])) === Math.max(...bestCover.map((s) => best.work[s])) && p.total > best.total)))) {
        best = p; bestCover = cover;
      }
    }
    if (!best) break;
    team.push(best);
    bestCover.forEach((s) => need.delete(s));
  }
  if (need.size) { box.className = "result empty"; box.textContent = `Cannot cover: ${esc(Array.from(need).join(", "))}.`; return; }
  box.className = "result";
  box.innerHTML = `<div class="dim"><strong>${team.length}</strong> pals cover <strong>${esc(sel.join(", "))}</strong></div>` +
    team.map((p) => {
      const cov = sel.filter((s) => p.work[s] != null).map((s) => `<span class="badge">${esc(s)} Lv${esc(p.work[s])}</span>`).join(" ");
      return `<div class="pair"><span class="cell-pal clickable" data-pal="${p.code}">${palImg(p, true)}${esc(p.name)}</span>${cov}</div>`;
    }).join("");
}

// ---- Chain tab: owned roster + BFS chains ----
const ROSTER_KEY = "pal-lab-roster";
function getRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((c) => typeof c === "string"));
  } catch (err) { return new Set(); }
}
function saveRoster(set) {
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(Array.from(set))); } catch (err) {}
}
// Starter pals: rarity 1 non-variants (commons everyone catches early).
// Seeds once on first run only; never touches an existing or cleared roster.
function seedRosterIfNew() {
  try {
    if (localStorage.getItem(ROSTER_KEY) !== null) return;
    if (!PALS || !PALS.length) return;
    saveRoster(new Set(PALS.filter((p) => p.rarity === 1 && !p.variant).map((p) => p.code)));
  } catch (err) {}
}
function resetRoster() {
  if (!PALS || !PALS.length) return;
  saveRoster(new Set(PALS.filter((p) => p.rarity === 1 && !p.variant).map((p) => p.code)));
  renderRoster();
}
function clearRoster() {
  saveRoster(new Set());
  renderRoster();
}
function renderRoster() {
  const box = $("roster-list");
  if (!box) return;
  let set = getRoster();
  const hasData = PALS && PALS.length > 0;
  const codes = Array.from(set).filter((c) => !hasData || BY_CODE[c]);
  if (codes.length !== set.size) { set = new Set(codes); saveRoster(set); }
  if (!codes.length) { box.innerHTML = '<span class="dim">No owned Pals yet.</span>'; }
  else {
  box.innerHTML = codes.map((c) => {
    const p = BY_CODE[c];
    const nm = p ? p.name : c;
    const img = p ? palImg(p, true) : "";
    return '<span class="roster-pill"><span class="clickable" data-pal="' + esc(c) + '">' + img + esc(nm) + '</span><button class="link" data-rm="' + esc(c) + '" aria-label="Remove ' + esc(nm) + '">x</button></span>';
  }).join("");
  box.querySelectorAll("[data-rm]").forEach((b) => {
    b.onclick = (e) => { if (e.stopPropagation) e.stopPropagation(); removeRoster(b.getAttribute("data-rm")); };
  });
  }
  const cnt = $("roster-count");
  if (cnt) cnt.textContent = codes.length ? `${codes.length} owned` : "";
}
function addRosterFromInput() {
  const inp = $("roster-add");
  if (!inp) return;
  const p = resolvePal(inp.value);
  if (!p) return;
  const set = getRoster();
  set.add(p.code);
  saveRoster(set);
  inp.value = "";
  renderRoster();
}
function removeRoster(code) {
  if (!code) return;
  const set = getRoster();
  set.delete(code);
  saveRoster(set);
  renderRoster();
}
function chainStepHtml(s, owned) {
  const pa = BY_CODE[s.a], pb = BY_CODE[s.b], pc = BY_CODE[s.child];
  const an = pa ? pa.name : s.a;
  const bn = pb ? pb.name : s.b;
  const cn = pc ? pc.name : s.child;
  const ao = owned && owned.has(s.a) ? "Owned " : "";
  const bo = owned && owned.has(s.b) ? "Owned " : "";
  const ai = pa ? palImg(pa, true) : "";
  const bi = pb ? palImg(pb, true) : "";
  const ci = pc ? palImg(pc, true) : "";
  return '<span class="clickable" data-pal="' + esc(s.a) + '">' + ai + esc(ao + an) + '</span> + ' +
    '<span class="clickable" data-pal="' + esc(s.b) + '">' + bi + esc(bo + bn) + '</span> -&gt; ' +
    '<span class="clickable" data-pal="' + esc(s.child) + '">' + ci + esc(cn) + '</span>';
}
function chainCost(steps) {
  let s = 0;
  for (const st of steps) {
    const pa = BY_CODE[st.a], pb = BY_CODE[st.b];
    s += (pa ? pa.rarity : 0) + (pa ? pa.power : 0) + (pb ? pb.rarity : 0) + (pb ? pb.power : 0);
  }
  return s;
}
function doChain() {
  const box = $("chain-result");
  if (!box) return;
  const tInp = $("chain-target");
  const t = tInp ? resolvePal(tInp.value) : null;
  if (!t) { box.className = "result empty"; box.textContent = "Pick a valid target Pal."; return; }
  const owned = getRoster();
  if (!owned.size) { box.className = "result empty"; box.textContent = "Add at least one owned Pal first."; return; }
  if (!COMBOS.length) { box.className = "result empty"; box.textContent = "Data still loading, try again."; return; }
  if (owned.has(t.code)) { box.className = "result"; box.innerHTML = '<div><strong>' + esc(t.name) + '</strong> is already owned.</div>'; return; }
  const direct = COMBOS.filter((x) => x.child === t.code && owned.has(x.a) && owned.has(x.b)).slice(0, 20);
  if (direct.length) {
    box.className = "result";
    box.innerHTML = '<div class="dim"><strong>' + direct.length + '</strong> direct pair' + (direct.length > 1 ? "s" : "") + ' from roster to <strong>' + esc(t.name) + '</strong></div>' +
      direct.map((x) => '<div class="chain-path">' + chainStepHtml({ a: x.a, b: x.b, child: x.child }, owned) + '</div>').join("");
    return;
  }
  const reach = new Set(owned);
  const pathOf = new Map();
  for (const c of owned) pathOf.set(c, []);
  for (let d = 0; d < 4; d++) {
    if (reach.has(t.code)) break;
    const adds = [];
    for (const x of COMBOS) {
      if (reach.has(x.child)) continue;
      if (!reach.has(x.a) || !reach.has(x.b)) continue;
      let dup = false;
      for (const y of adds) { if (y.child === x.child) { dup = true; break; } }
      if (!dup) adds.push(x);
    }
    if (!adds.length) break;
    for (const x of adds) {
      const sa = pathOf.get(x.a) || [];
      const sb = pathOf.get(x.b) || [];
      const seen = new Set();
      const steps = [];
      const all = sa.concat(sb);
      for (const s of all) { if (!seen.has(s.child)) { seen.add(s.child); steps.push(s); } }
      steps.push({ a: x.a, b: x.b, child: x.child });
      pathOf.set(x.child, steps);
      reach.add(x.child);
    }
  }
  const cands = [];
  for (const x of COMBOS) {
    if (x.child !== t.code) continue;
    if (!reach.has(x.a) || !reach.has(x.b)) continue;
    const sa = pathOf.get(x.a) || [];
    const sb = pathOf.get(x.b) || [];
    const seen = new Set();
    const steps = [];
    const all = sa.concat(sb);
    for (const s of all) { if (!seen.has(s.child)) { seen.add(s.child); steps.push(s); } }
    steps.push({ a: x.a, b: x.b, child: x.child });
    cands.push(steps);
  }
  cands.sort((p, q) => p.length - q.length || chainCost(p) - chainCost(q));
  const top = cands.slice(0, 20);
  if (!top.length) { box.className = "result empty"; box.textContent = "No chain found within 4 steps from your roster."; return; }
  box.className = "result";
  box.innerHTML = '<div class="dim"><strong>' + top.length + '</strong> chain' + (top.length > 1 ? "s" : "") + ' to <strong>' + esc(t.name) + '</strong></div>' +
    top.map((steps, i) => '<div class="chain-path"><div class="dim">Path ' + (i + 1) + ' (' + steps.length + ' breed' + (steps.length > 1 ? "s" : "") + ')</div>' + steps.map((s) => chainStepHtml(s, owned)).join('<div class="dim">then</div>') + '</div>').join("");
}

// ---- tabs ----
function switchTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
}
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

// share URLs: ?tab=breed&a=X&b=Y or ?tab=find&target=Z
function updateShare() {
  try {
    var tabEl = document.querySelector(".panel.active");
    var tab = tabEl ? tabEl.id.replace("tab-", "") : "";
    var aEl = $("parentA"), bEl = $("parentB"), tEl = $("target");
    var a = aEl ? aEl.value.trim() : "";
    var b = bEl ? bEl.value.trim() : "";
    var t = tEl ? tEl.value.trim() : "";
    var q = location.pathname;
    if (tab === "find" && t) q += "?tab=find&target=" + encodeURIComponent(t);
    else if (tab === "breed" && (a || b)) q += "?tab=breed&a=" + encodeURIComponent(a) + "&b=" + encodeURIComponent(b);
    else if (tab) q += "?tab=" + encodeURIComponent(tab);
    history.replaceState(null, "", q);
  } catch (err) {}
}
function parseShare() {
  try {
    var sp = new URLSearchParams(location.search);
    var a = sp.get("a"), b = sp.get("b"), t = sp.get("target"), tab = sp.get("tab");
    if (a || b) {
      if (a && $("parentA")) { var pa = resolvePal(a); $("parentA").value = pa ? pa.name : a; }
      if (b && $("parentB")) { var pb = resolvePal(b); $("parentB").value = pb ? pb.name : b; }
      switchTab("breed");
      doBreed();
    } else if (t) {
      var pt = resolvePal(t);
      if ($("target")) $("target").value = pt ? pt.name : t;
      switchTab("find");
      doFind();
    } else if (tab) {
      if (["breed", "find", "all", "base", "mounts", "chain"].indexOf(tab) >= 0) switchTab(tab);
    }
  } catch (err) {}
}

// close any open combo panel on outside click
document.addEventListener("click", (e) => {
  for (const c of combos) {
    if (!c.panel.hidden && !c.input.parentElement.contains(e.target)) c.close();
  }
});

createCombo("parentA", doBreed);
createCombo("parentB", doBreed);
createCombo("target", doFind);
$("swap").onclick = () => { const v = $("parentA").value; $("parentA").value = $("parentB").value; $("parentB").value = v; doBreed(); };
$("only-special").onchange = doFind;
const findSort = $("find-sort");
if (findSort) findSort.onchange = doFind;
$("all-search").addEventListener("input", applyAllFilter);
$("all-method").onchange = applyAllFilter;
$("all-element").onchange = applyAllFilter;
$("all-pelement").onchange = applyAllFilter; // parent element filter
$("all-work").onchange = applyAllFilter;
$("all-worklv").onchange = applyAllFilter;
$("all-egg").onchange = applyAllFilter;
$("all-size").onchange = applyAllFilter;
$("all-ride").onchange = applyAllFilter;
$("all-variant").onchange = applyAllFilter;
// Teammate-owned filter controls (may not exist yet — guard all).
(function () {
  const st = $("all-strongest");
  if (st) {
    if (!st.getAttribute("title")) st.setAttribute("title", STRONGEST_TITLE);
    const lbl = st.closest ? st.closest("label") : null;
    if (lbl && !lbl.getAttribute("title")) lbl.setAttribute("title", STRONGEST_TITLE);
    st.addEventListener("change", () => { page = 0; renderAll(); });
  }
  const mr = $("all-minrarity");
  if (mr) mr.addEventListener("change", applyAllFilter);
})();
// Teammate-owned modal nodes (may not exist yet — guard all).
(function () {
  const c = $("pm-close");
  if (c) c.onclick = () => window.closePalDetail();
  const m = $("pal-modal");
  if (m) m.addEventListener("click", (e) => { if (e.target === m) window.closePalDetail(); });
})();
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const m = $("pal-modal");
  if (!m || m.hidden) return;
  window.closePalDetail();
});
// Global delegation: any [data-pal="CODE"] opens the detail (validated).
document.addEventListener("click", (e) => {
  const t = e.target && e.target.closest ? e.target.closest("[data-pal]") : null;
  if (!t) return;
  const code = t.getAttribute("data-pal");
  if (!code || !BY_CODE[code]) return;
  window.openPalDetail(code);
});
$("prev").onclick = () => { page--; renderAll(); };
$("next").onclick = () => { page++; renderAll(); };
document.querySelectorAll(".th-sort").forEach((btn) => {
  btn.onclick = (e) => {
    if (e.target.classList && e.target.classList.contains("tip")) return; // let tooltip hover/focus work
    const k = btn.dataset.sort;
    if (sortKey === k) sortDir *= -1;
    else { sortKey = k; sortDir = 1; }
    renderAll();
  };
});
(function () {
  const bs = $("base-search");
  if (bs) bs.addEventListener("input", renderBase);
  const pb = $("plan-base");
  if (pb) pb.addEventListener("click", planBaseTeam);
  const po = $("plan-owned");
  if (po) po.addEventListener("change", planBaseTeam);
  const cm = $("combat-mode");
  if (cm) cm.addEventListener("change", renderCombat);
  const ce = $("combat-element");
  if (ce) ce.addEventListener("change", renderCombat);
  const co = $("combat-owned");
  if (co) co.addEventListener("change", renderCombat);
})();
(function () {
  const addBtn = $("roster-add-btn");
  if (addBtn) addBtn.addEventListener("click", addRosterFromInput);
  const addInp = $("roster-add");
  if (addInp) addInp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addRosterFromInput(); } });
  const go = $("chain-go");
  if (go) go.addEventListener("click", doChain);
  const rr = $("roster-reset");
  if (rr) rr.addEventListener("click", resetRoster);
  const rc = $("roster-clear");
  if (rc) rc.addEventListener("click", clearRoster);
  const tInp = $("chain-target");
  if (tInp) tInp.addEventListener("keydown", (e) => { if (e.key === "Enter") doChain(); });
  try {
    if (typeof createCombo === "function") {
      if ($("roster-add") && document.getElementById("roster-add-list")) createCombo("roster-add", function () {});
      if ($("chain-target") && document.getElementById("chain-target-list")) createCombo("chain-target", function () { doChain(); });
    }
  } catch (err) {}
  renderRoster();
})();

load();
