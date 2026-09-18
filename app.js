let PALS = [], BY_CODE = {}, BY_NAME = {}, LOOKUP = {}, SPECIAL_SET = new Set();
let COMBOS = [], FILTERED = [], page = 0;
const PAGE_SIZE = 100;
const ROW_CAP = 60;

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
    const shown = items.slice(0, ROW_CAP);
    let html = shown.map((p, i) =>
      `<button type="button" class="combo-opt${i === state.active ? " active" : ""}" role="option" ` +
      `id="${inputId}-opt-${i}" aria-selected="${i === state.active}" data-code="${p.code}">` +
      `${palImg(p, true)}<span class="nm">${p.name}</span><span class="dex">#${p.paldex}</span>` +
      `<span class="pw">power ${p.power}</span></button>`
    ).join("");
    if (items.length > ROW_CAP) html += `<div class="combo-more">${(items.length - ROW_CAP).toLocaleString()} more… keep typing to narrow</div>`;
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
    if (e.key === "ArrowDown") { e.preventDefault(); if (state.items.length) { state.active = (state.active + 1) % Math.min(state.items.length, ROW_CAP); highlight(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (state.items.length) { state.active = (state.active - 1 + Math.min(state.items.length, ROW_CAP)) % Math.min(state.items.length, ROW_CAP); highlight(); } }
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
  BY_CODE = Object.fromEntries(pals.map((p) => [p.code, p]));
  BY_NAME = Object.fromEntries(pals.map((p) => [p.name.toLowerCase(), p]));
  LOOKUP = lookup;
  for (const s of specials) {
    const k = `${pairKey(s.parent_a_code, s.parent_b_code)}=${s.child_code}`;
    SPECIAL_SET.add(k);
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

  // precompute flat combos for All tab
  COMBOS = Object.entries(LOOKUP).map(([k, child]) => {
    const [a, b] = k.split("+");
    const pa = BY_CODE[a], pb = BY_CODE[b], pc = BY_CODE[child];
    const avg = pa && pb ? targetPower(pa, pb) : 0;
    return { a, b, child, avg, special: isSpecial(a, b, child), pa, pb, pc };
  });
  FILTERED = COMBOS;
  renderAll();
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
  box.className = "result";
  box.innerHTML = `
    <div class="parents-line dim">${palImg(a, true)} ${a.name} <span class="dim">(power ${a.power})</span> + ${palImg(b, true)} ${b.name} <span class="dim">(power ${b.power})</span> → Target power ${avg}${tipHtml()}</div>
    <div class="child">${palImg(c)} ${c.name} <span class="dim">#${c.paldex}</span>
      ${c.variant ? `<span class="badge variant">variant</span>` : ""}
      ${special ? `<span class="badge special">special</span>` : `<span class="badge formula">formula</span>`}
    </div>
    <div>${elBadges(c)} <span class="dim">power ${c.power} · ♂ male rate ${c.male}%</span></div>
    <div style="margin-top:8px"><button class="link" id="see-parents">See all ${COMBOS.filter((x) => x.child === c.code).length} ways to make ${c.name} →</button></div>`;
  $("see-parents").onclick = () => {
    switchTab("find");
    $("target").value = c.name;
    doFind();
  };
}

// ---- Find tab ----
function doFind() {
  const t = resolvePal($("target").value);
  const box = $("find-result");
  const onlySpecial = $("only-special").checked;
  if (!t) { box.className = "result empty"; box.textContent = "Pick a target to list every parent pair."; return; }
  let pairs = COMBOS.filter((x) => x.child === t.code);
  if (onlySpecial) pairs = pairs.filter((x) => x.special);
  if (!pairs.length) { box.className = "result empty"; box.textContent = `No ${onlySpecial ? "special " : ""}pairs make ${t.name}.`; return; }
  pairs.sort((x, y) => x.avg - y.avg || (x.pa.name + x.pb.name).localeCompare(y.pa.name + y.pb.name));
  box.className = "result";
  box.innerHTML = `<div class="dim"><strong>${pairs.length}</strong> pair${pairs.length > 1 ? "s" : ""} → <strong>${t.name}</strong> ${onlySpecial ? "(special only)" : ""}</div>` +
    pairs.slice(0, 500).map((x, i) =>
      `<div class="pair">${palImg(x.pa, true)}${x.pa.name} + ${palImg(x.pb, true)}${x.pb.name} <span class="dim">target power ${x.avg}</span>
       ${x.special ? `<span class="badge special">special</span>` : ""}
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
}

// ---- All tab ----
let sortKey = null, sortDir = 1;
const SORT_LABEL = { a: "Parent A", b: "Parent B", child: "Child", avg: "Target power" };

function sortedRows(rows) {
  if (!sortKey) return rows;
  const get = {
    a: (x) => x.pa.name, b: (x) => x.pb.name, child: (x) => x.pc.name, avg: (x) => x.avg,
  }[sortKey];
  return rows.slice().sort((x, y) => {
    const gx = get(x), gy = get(y);
    const c = typeof gx === "number" ? gx - gy : String(gx).localeCompare(String(gy));
    return c * sortDir || x.child.localeCompare(y.child);
  });
}

function applyAllFilter() {
  const q = $("all-search").value.trim().toLowerCase();
  const m = $("all-method").value;
  const el = $("all-element").value;
  const varOnly = $("all-variant").checked;
  FILTERED = COMBOS.filter((x) => {
    if (m === "special" && !x.special) return false;
    if (m === "formula" && x.special) return false;
    if (el && !x.pc.elements.includes(el)) return false;
    if (varOnly && !x.pc.variant) return false;
    if (!q) return true;
    return x.pa.name.toLowerCase().includes(q) || x.pb.name.toLowerCase().includes(q) || x.pc.name.toLowerCase().includes(q);
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
  $("all-body").innerHTML = slice.map((x) =>
    `<tr><td><span class="cell-pal">${palImg(x.pa, true)}${x.pa.name}</span></td>` +
    `<td><span class="cell-pal">${palImg(x.pb, true)}${x.pb.name}</span></td>` +
    `<td><span class="cell-pal">${palImg(x.pc, true)}<strong>${x.pc.name}</strong></span></td><td>${x.avg}</td>
     <td>${x.special ? `<span class="badge special">special</span>` : `<span class="badge formula">formula</span>`}</td></tr>`
  ).join("");
  $("all-meta").textContent = `${total.toLocaleString()} combos · page ${page + 1} of ${pages}`;
  $("page-info").textContent = `${page + 1} / ${pages}`;
}

// ---- tabs ----
function switchTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
}
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

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
$("all-search").addEventListener("input", applyAllFilter);
$("all-method").onchange = applyAllFilter;
$("all-element").onchange = applyAllFilter;
$("all-variant").onchange = applyAllFilter;
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

load();
