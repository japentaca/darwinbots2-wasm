'use strict';
// Inventario de bots (capa host, fuera de la fidelidad). Ventana flotante que
// reemplaza a las 588 opciones del Bestiary en el selector de "Sembrar
// especie": búsqueda, filtros por capacidades genéticas, agrupación, tags
// libres, favoritos, notas, selecciones con nombre y siembra en lote.
//
// Datos:
//  - bots/bots.json      índice del Bestiary (lo carga index.html: BESTIARY)
//  - bots/profiles.json  perfil genético de cada bot, generado offline por
//                        tools/bestiary/analyze_bots.js con el propio core
//  - IndexedDB 'darwinbots-inventario': lo del usuario. Clave = hash del ADN
//    canónico (sobrevive a que el archivador renombre archivos); sin perfil,
//    'file:<archivo>'.
//
// Usa globales de index.html: BESTIARY, makeWindow, winLayer, log, escHtml,
// worker, cssToVbColor.

// ---- IndexedDB --------------------------------------------------------------
const InvDB = (() => {
  let dbp = null;
  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('darwinbots-inventario', 2);
        r.onupgradeneeded = () => {
          const db = r.result;
          const mk = (n, k) => {
            if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: k });
          };
          mk('bots', 'key');       // tags/fav/notas
          mk('sets', 'name');      // selecciones
          mk('hybrids', 'name');   // v2: híbridos del Laboratorio (lab.js)
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  function req(store, mode, fn) {
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  return {
    all: (store) => req(store, 'readonly', (s) => s.getAll()),
    put: (store, v) => req(store, 'readwrite', (s) => s.put(v)),
    del: (store, k) => req(store, 'readwrite', (s) => s.delete(k)),
  };
})();

// ---- Estado -----------------------------------------------------------------
const inv = {
  win: null,
  profiles: null,          // profiles.json (o null si no está publicado)
  items: [],               // {key, b, p}  (b = entrada de bots.json, p = perfil)
  byKey: new Map(),
  user: new Map(),         // key -> {key, name, tags[], fav, notes}
  sets: new Map(),         // name -> {name, keys[]}
  sel: new Set(),          // claves seleccionadas
  cur: null,               // clave con ficha abierta
  capFilter: new Map(),    // cap -> +1 (requerida) | -1 (excluida)
  collapsed: new Set(),    // grupos plegados
  dbOk: true,
};

async function invLoad() {
  if (!inv.profiles) {
    try {
      const r = await fetch('bots/profiles.json');
      if (r.ok) inv.profiles = await r.json();
    } catch (e) { /* sin perfiles: el inventario funciona sin capacidades */ }
  }
  const bots = (inv.profiles && inv.profiles.bots) || {};
  inv.items = BESTIARY.map((b) => {
    const p = bots[b.file] || null;
    return { key: p ? p.hash : 'file:' + b.file, b, p };
  });
  inv.byKey = new Map(inv.items.map((it) => [it.key, it]));
  try {
    const [u, s] = await Promise.all([InvDB.all('bots'), InvDB.all('sets')]);
    inv.user = new Map(u.map((r) => [r.key, r]));
    inv.sets = new Map(s.map((r) => [r.name, r]));
  } catch (e) {
    inv.dbOk = false;
    log('inventario: IndexedDB no disponible (¿file:// o modo privado?): ' +
        'tags y favoritos no se guardarán');
  }
}

function userRec(key) {
  return inv.user.get(key) || { key, tags: [], fav: false, notes: '' };
}
async function saveUser(rec) {
  const it = inv.byKey.get(rec.key);
  if (it) { rec.name = it.b.name; rec.file = it.b.file; }
  const empty = !rec.fav && !rec.tags.length && !rec.notes;
  if (empty) inv.user.delete(rec.key); else inv.user.set(rec.key, rec);
  if (!inv.dbOk) return;
  try {
    if (empty) await InvDB.del('bots', rec.key); else await InvDB.put('bots', rec);
  } catch (e) { log('inventario: no pude guardar (' + e.message + ')'); }
}
function allTags() {
  const t = new Map();
  for (const r of inv.user.values()) for (const g of r.tags) t.set(g, (t.get(g) || 0) + 1);
  return [...t.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
const capInfo = (k) => (inv.profiles && inv.profiles.caps[k]) ||
                       { label: k, group: '', desc: '' };
const archLabel = (k) => (inv.profiles && inv.profiles.archetypes[k]) || k || '—';
const SIZE_LABEL = { S: 'S (≤5 genes)', M: 'M (6-20)', L: 'L (21-60)', XL: 'XL (>60)' };
// Capacidades que casi todos tienen: no se muestran en la lista (sí en la ficha).
const CAP_COMMON = new Set(['mueve', 'gira', 'vision', 'repro-asex']);
const GROUP_HUE = { Movimiento: 210, Ataque: 0, Defensa: 35, Energía: 120,
                    Reproducción: 300, Multicelular: 180, Social: 260,
                    Sentidos: 55, Genoma: 330 };

// ---- Filtros y agrupación ---------------------------------------------------
function invFilterState() {
  const w = inv.win;
  const v = (id) => w.querySelector('#' + id);
  return {
    q: v('inv-q').value.trim().toLowerCase().split(/\s+/).filter(Boolean),
    board: v('inv-board').value,
    arch: v('inv-arch').value,
    size: v('inv-size').value,
    tag: v('inv-tag').value,
    fav: v('inv-fav').checked,
    onlySel: v('inv-onlysel').checked,
    group: v('inv-group').value,
    sort: v('inv-sort').value,
  };
}

function invMatches(it, f) {
  const u = userRec(it.key);
  if (f.board && it.b.board !== f.board) return false;
  if (f.arch && (!it.p || it.p.arch !== f.arch)) return false;
  if (f.size && (!it.p || it.p.size !== f.size)) return false;
  if (f.fav && !u.fav) return false;
  if (f.onlySel && !inv.sel.has(it.key)) return false;
  if (f.tag === '\u0000' && u.tags.length) return false;
  if (f.tag && f.tag !== '\u0000' && !u.tags.includes(f.tag)) return false;
  for (const [cap, mode] of inv.capFilter) {
    const has = !!(it.p && it.p.caps.includes(cap));
    if (mode > 0 && !has) return false;
    if (mode < 0 && has) return false;
  }
  if (f.q.length) {
    const hay = (it.b.name + ' ' + it.b.file + ' ' + u.tags.join(' ') + ' ' +
                 u.notes).toLowerCase();
    if (!f.q.every((w) => hay.includes(w))) return false;
  }
  return true;
}

function invGroupsOf(it, how) {
  const u = userRec(it.key);
  switch (how) {
    case 'board': return [it.b.board];
    case 'arch': return [archLabel(it.p && it.p.arch)];
    case 'size': return [it.p ? SIZE_LABEL[it.p.size] : '—'];
    case 'fav': return [u.fav ? '★ Favoritos' : 'Resto'];
    case 'tag': return u.tags.length ? u.tags : ['(sin tags)'];
    case 'cap': {
      const cs = it.p ? it.p.caps.filter((c) => !CAP_COMMON.has(c)) : [];
      return cs.length ? cs.map((c) => capInfo(c).label) : ['(solo básicas)'];
    }
    default: return ['Todos'];
  }
}

function invSorted(list, how) {
  const byName = (a, b) => a.b.name.localeCompare(b.b.name);
  if (how === 'genes') return list.sort((a, b) => ((b.p ? b.p.genes : 0) - (a.p ? a.p.genes : 0)) || byName(a, b));
  if (how === 'caps') return list.sort((a, b) => ((b.p ? b.p.caps.length : 0) - (a.p ? a.p.caps.length : 0)) || byName(a, b));
  return list.sort(byName);
}

// ---- Render -----------------------------------------------------------------
function capChip(k, extra) {
  const c = capInfo(k);
  const h = GROUP_HUE[c.group] ?? 220;
  return `<span class="inv-cap" style="--h:${h}" title="${escHtml(c.group + ': ' + c.desc)}"` +
         `${extra || ''}>${escHtml(c.label)}</span>`;
}
function tagChip(t, removable) {
  return `<span class="inv-tag" data-tag="${escHtml(t)}">#${escHtml(t)}` +
         (removable ? '<button class="inv-tag-x" title="Quitar tag">×</button>' : '') +
         '</span>';
}

function invRenderList() {
  const w = inv.win;
  if (!w) return;
  const f = invFilterState();
  const vis = invSorted(inv.items.filter((it) => invMatches(it, f)), f.sort);
  const groups = new Map();
  for (const it of vis)
    for (const g of invGroupsOf(it, f.group)) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    }
  const order = f.group === 'board' ? null
    : [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length ||
                                         a.localeCompare(b));
  const keys = order || [...groups.keys()];
  const html = [];
  for (const g of keys) {
    const list = groups.get(g);
    const nSel = list.filter((it) => inv.sel.has(it.key)).length;
    const closed = inv.collapsed.has(f.group + '|' + g);
    html.push(`<div class="inv-grp${closed ? ' closed' : ''}" data-g="${escHtml(g)}">` +
      `<div class="inv-gh"><span class="inv-tw">${closed ? '▸' : '▾'}</span>` +
      `<input type="checkbox" class="inv-gsel" title="Seleccionar el grupo"` +
      `${nSel === list.length ? ' checked' : ''}>` +
      `<b>${escHtml(g)}</b> <span class="inv-n">${list.length}` +
      `${nSel ? ` · ${nSel} sel.` : ''}</span></div>`);
    if (!closed) {
      for (const it of list) {
        const u = userRec(it.key);
        const caps = it.p ? it.p.caps.filter((c) => !CAP_COMMON.has(c)) : [];
        html.push(
          `<div class="inv-row${inv.cur === it.key ? ' cur' : ''}" data-k="${escHtml(it.key)}">` +
          `<input type="checkbox" class="inv-sel"${inv.sel.has(it.key) ? ' checked' : ''}>` +
          `<button class="inv-star${u.fav ? ' on' : ''}" title="Favorito">${u.fav ? '★' : '☆'}</button>` +
          `<span class="inv-name">${escHtml(it.b.name)}${it.b.veg ? ' <i>(veg)</i>' : ''}</span>` +
          `<span class="inv-meta">${it.p ? it.p.genes + ' g' : ''}</span>` +
          `<span class="inv-caps">${u.tags.map((t) => tagChip(t)).join('')}` +
          `${caps.map((c) => capChip(c)).join('')}</span></div>`);
      }
    }
    html.push('</div>');
  }
  const listEl = w.querySelector('#inv-list');
  const top = listEl.scrollTop;
  listEl.innerHTML = html.join('') ||
    '<div class="inv-empty">Ningún bot cumple los filtros.</div>';
  listEl.scrollTop = top;
  w.querySelector('#inv-count').textContent =
    `${vis.length} de ${inv.items.length} bots · ${inv.sel.size} seleccionados`;
}

function invRenderCaps() {
  const w = inv.win;
  const box = w.querySelector('#inv-capf');
  if (!inv.profiles) {
    box.innerHTML = '<span class="inv-empty">Sin bots/profiles.json: corré ' +
      'tools/bestiary/analyze_bots.js para tener las capacidades.</span>';
    return;
  }
  const count = {};
  for (const it of inv.items) if (it.p) for (const c of it.p.caps) count[c] = (count[c] || 0) + 1;
  const byGroup = new Map();
  for (const [k, c] of Object.entries(inv.profiles.caps)) {
    if (!byGroup.has(c.group)) byGroup.set(c.group, []);
    byGroup.get(c.group).push(k);
  }
  box.innerHTML = [...byGroup.entries()].map(([g, ks]) =>
    `<span class="inv-capg">${escHtml(g)}</span>` + ks.map((k) => {
      const m = inv.capFilter.get(k) || 0;
      return capChip(k, ` data-cap="${k}" data-m="${m}"`).replace(
        '</span>', ` <small>${count[k] || 0}</small></span>`);
    }).join('')).join('');
}

function invRenderTagOptions() {
  const w = inv.win;
  const sel = w.querySelector('#inv-tag');
  const cur = sel.value;
  const tags = allTags();
  sel.innerHTML = '<option value="">tag: todos</option><option value="\u0000">(sin tags)</option>' +
    tags.map(([t, n]) => `<option value="${escHtml(t)}">#${escHtml(t)} (${n})</option>`).join('');
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : '';
  w.querySelector('#inv-taglist').innerHTML =
    tags.map(([t]) => `<option value="${escHtml(t)}">`).join('');
  const sets = w.querySelector('#inv-sets');
  sets.innerHTML = '<option value="">selecciones guardadas…</option>' +
    [...inv.sets.values()].sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => `<option value="${escHtml(s.name)}">${escHtml(s.name)} (${s.keys.length})</option>`).join('');
}

function invRenderDetail() {
  const w = inv.win;
  const box = w.querySelector('#inv-detail');
  const it = inv.cur && inv.byKey.get(inv.cur);
  if (!it) {
    box.innerHTML = '<div class="inv-empty">Elegí un bot de la lista para ver su perfil genético.</div>';
    return;
  }
  const u = userRec(it.key), p = it.p;
  const url = /^https?:\/\//.test(it.b.url || '') ? it.b.url : '';
  let capsHtml = '<div class="inv-empty">sin perfil</div>', genesHtml = '';
  if (p) {
    const byGroup = new Map();
    for (const c of p.caps) {
      const g = capInfo(c).group;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(c);
    }
    capsHtml = [...byGroup.entries()].map(([g, cs]) =>
      `<div class="inv-dl"><span>${escHtml(g)}</span><span>${cs.map((c) => capChip(c)).join('')}</span></div>`).join('');
    genesHtml = '<details class="inv-genes"><summary>Capacidades por gen (' + p.genes + ')</summary>' +
      p.geneCaps.map((cs, i) => `<div class="inv-dl"><span>gen ${i + 1}</span><span>` +
        (cs.length ? cs.map((c) => capChip(c)).join('') : '<i>—</i>') + '</span></div>').join('') +
      '</details>';
  }
  box.innerHTML =
    `<h3>${escHtml(it.b.name)}</h3>` +
    `<div class="inv-sub">${escHtml(it.b.board)}${it.b.veg ? ' · vegetal' : ''}` +
    (p ? ` · ${escHtml(archLabel(p.arch))} · ${p.genes} genes · ${p.tokens} tokens` : '') +
    (url ? ` · <a href="${escHtml(url)}" target="_blank" rel="noopener">foro</a>` : '') + '</div>' +
    '<div class="row"><button id="inv-toform">Al formulario</button>' +
    '<button id="inv-seedone" class="primary">Sembrar</button>' +
    `<button id="inv-favone">${u.fav ? '★ Favorito' : '☆ Favorito'}</button>` +
    '<button id="inv-tolab" title="Usar sus genes en el Laboratorio de híbridos">🧬 Laboratorio</button></div>' +
    '<h4>Tags</h4>' +
    `<div class="inv-tags">${u.tags.map((t) => tagChip(t, true)).join('') || '<i class="inv-empty">sin tags</i>'}</div>` +
    '<div class="row"><input type="text" id="inv-newtag" list="inv-taglist" placeholder="nuevo tag…">' +
    '<button id="inv-addtag">+ tag</button></div>' +
    '<h4>Notas</h4>' +
    `<textarea id="inv-notes" placeholder="notas libres…">${escHtml(u.notes)}</textarea>` +
    '<h4>Capacidades genéticas</h4>' + capsHtml + genesHtml +
    (p ? `<div class="inv-sub">ADN ${escHtml(p.hash)} · ${escHtml(it.b.file)}</div>` : '');
}

function invRenderAll() {
  invRenderTagOptions();
  invRenderCaps();
  invRenderList();
  invRenderDetail();
}

// ---- Acciones ---------------------------------------------------------------
async function invFetchDna(b) {
  const r = await fetch('bots/' + b.file);
  if (!r.ok) throw new Error(`no pude leer bots/${b.file}`);
  return r.text();
}

async function invToForm(it) {
  let dna;
  try { dna = await invFetchDna(it.b); } catch (e) { log(e.message); return; }
  document.getElementById('dna').value = dna;
  document.getElementById('sp-name').value = it.b.name + '.txt';
  document.getElementById('sp-veg').checked = it.b.veg;
  document.getElementById('sp-qty').value = it.b.veg ? 15 : 5;
  document.getElementById('sp-nrg').value = 3000;
  const sel = document.getElementById('preset');
  let o = sel.querySelector('option[value="inv"]');
  if (!o) { o = document.createElement('option'); o.value = 'inv'; sel.appendChild(o); }
  o.textContent = 'Inventario: ' + it.b.name;
  sel.value = 'inv';
  log(`inventario: ${it.b.name} en el formulario`);
}

// Colores bien separados para una siembra en lote (ángulo áureo en el tono).
function invColor(i) {
  const h = (i * 137.508 + 10) % 360, s = 0.75, l = 0.58;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

async function invSeed(list) {
  const w = inv.win;
  const qty = parseInt(w.querySelector('#inv-qty').value, 10) || 5;
  const vqty = parseInt(w.querySelector('#inv-vqty').value, 10) || 15;
  const nrg = parseFloat(w.querySelector('#inv-nrg').value) || 3000;
  let n = 0;
  for (const it of list) {
    let dna;
    try { dna = await invFetchDna(it.b); } catch (e) { log(e.message); continue; }
    worker.postMessage({
      t: 'seed-species',
      sp: { dna, name: it.b.name + '.txt', veg: it.b.veg, qty: it.b.veg ? vqty : qty,
            nrg, color: cssToVbColor(invColor(n)) },
    });
    n++;
  }
  log(`inventario: ${n} especie(s) sembradas`);
}

async function invToggleFav(key) {
  const rec = { ...userRec(key) };
  rec.fav = !rec.fav;
  await saveUser(rec);
}

async function invAddTag(keys, tag) {
  tag = tag.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();
  if (!tag) return;
  for (const k of keys) {
    const rec = { ...userRec(k), tags: [...userRec(k).tags] };
    if (!rec.tags.includes(tag)) { rec.tags.push(tag); rec.tags.sort(); await saveUser(rec); }
  }
}
async function invRemoveTag(keys, tag) {
  for (const k of keys) {
    const rec = { ...userRec(k), tags: userRec(k).tags.filter((t) => t !== tag) };
    await saveUser(rec);
  }
}

function invExport() {
  const doc = {
    format: 'darwinbots-inventario', version: 1,
    exported: new Date().toISOString(),
    bots: [...inv.user.values()],
    sets: [...inv.sets.values()],
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 1)],
                                        { type: 'application/json' }));
  a.download = 'inventario-darwinbots.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function invImport(file) {
  let doc;
  try { doc = JSON.parse(await file.text()); } catch (e) { log('inventario: JSON inválido'); return; }
  if (!doc || doc.format !== 'darwinbots-inventario') { log('inventario: no es un respaldo del inventario'); return; }
  let nb = 0, ns = 0;
  for (const r of doc.bots || []) {
    if (!r || !r.key) continue;
    const cur = userRec(r.key);
    await saveUser({
      key: r.key,
      tags: [...new Set([...cur.tags, ...(r.tags || []).map(String)])].sort(),
      fav: cur.fav || !!r.fav,
      notes: r.notes ? String(r.notes) : cur.notes,
    });
    nb++;
  }
  for (const s of doc.sets || []) {
    if (!s || !s.name) continue;
    const rec = { name: String(s.name), keys: (s.keys || []).map(String) };
    inv.sets.set(rec.name, rec);
    if (inv.dbOk) await InvDB.put('sets', rec).catch(() => {});
    ns++;
  }
  log(`inventario: importados ${nb} bot(s) y ${ns} selección(es)`);
  invRenderAll();
}

// ---- Ventana ----------------------------------------------------------------
async function openInventory() {
  if (inv.win) { winLayer.appendChild(inv.win); return; }   // al frente
  if (!BESTIARY.length) { log('inventario: no hay bots/bots.json (¿la página se sirve por http?)'); return; }
  await invLoad();
  const w = makeWindow('Inventario de bots', Math.min(1040, innerWidth - 40), 0,
                       () => { inv.win = null; });
  inv.win = w;
  w.classList.add('inv-win');
  w.style.left = '20px';
  w.style.top = '50px';
  w.style.height = Math.min(680, innerHeight - 70) + 'px';
  const boards = [...new Set(BESTIARY.map((b) => b.board))];
  const archs = inv.profiles ? Object.entries(inv.profiles.archetypes) : [];
  w.body.innerHTML =
    '<div class="inv-bar">' +
    '<input type="search" id="inv-q" placeholder="buscar nombre, tag o nota…">' +
    '<select id="inv-board"><option value="">foro: todos</option>' +
    boards.map((b) => `<option>${escHtml(b)}</option>`).join('') + '</select>' +
    '<select id="inv-arch"><option value="">arquetipo: todos</option>' +
    archs.map(([k, l]) => `<option value="${k}">${escHtml(l)}</option>`).join('') + '</select>' +
    '<select id="inv-size"><option value="">tamaño: todos</option>' +
    Object.entries(SIZE_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('') + '</select>' +
    '<select id="inv-tag"></select>' +
    '<label><input type="checkbox" id="inv-fav"> ★ solo</label>' +
    '<label><input type="checkbox" id="inv-onlysel"> solo selección</label>' +
    '<span class="inv-sp"></span>' +
    '<label>agrupar</label><select id="inv-group">' +
    '<option value="board">foro</option><option value="arch" selected>arquetipo</option>' +
    '<option value="cap">capacidad</option><option value="tag">tag</option>' +
    '<option value="size">tamaño</option><option value="fav">favoritos</option>' +
    '<option value="none">sin agrupar</option></select>' +
    '<select id="inv-sort"><option value="name">orden: nombre</option>' +
    '<option value="genes">orden: genes</option><option value="caps">orden: nº capacidades</option></select>' +
    '</div>' +
    '<div id="inv-capf" title="Clic: requerida (verde) → excluida (roja) → sin filtro"></div>' +
    '<div class="inv-main"><div id="inv-list"></div><div id="inv-detail"></div></div>' +
    '<div class="inv-foot">' +
    '<span id="inv-count"></span>' +
    '<button id="inv-selvis" title="Seleccionar todos los visibles">☑ visibles</button>' +
    '<button id="inv-selnone">☐ ninguno</button>' +
    '<span class="inv-sep"></span>' +
    '<input type="text" id="inv-seltag" list="inv-taglist" placeholder="tag…" style="width:90px">' +
    '<button id="inv-seltag-add" title="Agregar el tag a la selección">+ tag</button>' +
    '<button id="inv-seltag-del" title="Quitar el tag de la selección">− tag</button>' +
    '<button id="inv-selfav" title="Marcar la selección como favorita">★</button>' +
    '<span class="inv-sep"></span>' +
    '<input type="text" id="inv-setname" placeholder="nombre…" style="width:90px">' +
    '<button id="inv-setsave" title="Guardar la selección con ese nombre">Guardar sel.</button>' +
    '<select id="inv-sets"></select>' +
    '<button id="inv-setdel" title="Borrar la selección guardada elegida">🗑</button>' +
    '<span class="inv-sep"></span>' +
    '<label>nº</label><input type="number" id="inv-qty" value="5" min="1" style="width:52px">' +
    '<label>veg</label><input type="number" id="inv-vqty" value="15" min="1" style="width:52px">' +
    '<label>nrg</label><input type="number" id="inv-nrg" value="3000" min="1" style="width:70px">' +
    '<button id="inv-seedsel" class="primary">Sembrar selección</button>' +
    '<button id="inv-sellab" title="Llevar la selección al Laboratorio de híbridos">🧬</button>' +
    '<span class="inv-sp"></span>' +
    '<button id="inv-export" title="Descargar tags, favoritos, notas y selecciones">Exportar</button>' +
    '<button id="inv-import">Importar</button>' +
    '<input type="file" id="inv-importf" accept=".json,application/json" hidden>' +
    '</div><datalist id="inv-taglist"></datalist>';

  const $ = (id) => w.querySelector('#' + id);
  let qT = 0;
  $('inv-q').oninput = () => { clearTimeout(qT); qT = setTimeout(invRenderList, 120); };
  for (const id of ['inv-board', 'inv-arch', 'inv-size', 'inv-tag', 'inv-fav',
                    'inv-onlysel', 'inv-group', 'inv-sort'])
    $(id).onchange = invRenderList;

  $('inv-capf').onclick = (e) => {
    const chip = e.target.closest('[data-cap]');
    if (!chip) return;
    const k = chip.dataset.cap, m = inv.capFilter.get(k) || 0;
    const nm = m === 0 ? 1 : m === 1 ? -1 : 0;
    if (nm) inv.capFilter.set(k, nm); else inv.capFilter.delete(k);
    invRenderCaps();
    invRenderList();
  };

  $('inv-list').onclick = async (e) => {
    const row = e.target.closest('.inv-row');
    const gh = e.target.closest('.inv-gh');
    if (gh) {
      const g = gh.parentElement.dataset.g, id = $('inv-group').value + '|' + g;
      if (e.target.classList.contains('inv-gsel')) {
        const f = invFilterState();
        const keys = inv.items.filter((it) => invMatches(it, f) &&
                                             invGroupsOf(it, f.group).includes(g)).map((it) => it.key);
        for (const k of keys) e.target.checked ? inv.sel.add(k) : inv.sel.delete(k);
      } else if (inv.collapsed.has(id)) inv.collapsed.delete(id);
      else inv.collapsed.add(id);
      invRenderList();
      return;
    }
    if (!row) return;
    const k = row.dataset.k;
    if (e.target.classList.contains('inv-sel')) {
      e.target.checked ? inv.sel.add(k) : inv.sel.delete(k);
      invRenderList();
      return;
    }
    if (e.target.classList.contains('inv-star')) {
      await invToggleFav(k);
      invRenderList();
      if (inv.cur === k) invRenderDetail();
      return;
    }
    inv.cur = k;
    invRenderList();
    invRenderDetail();
  };
  $('inv-list').ondblclick = (e) => {
    const row = e.target.closest('.inv-row');
    if (row && !e.target.closest('input,button')) invToForm(inv.byKey.get(row.dataset.k));
  };

  $('inv-detail').onclick = async (e) => {
    const it = inv.byKey.get(inv.cur);
    if (!it) return;
    const id = e.target.id;
    if (id === 'inv-toform') invToForm(it);
    else if (id === 'inv-seedone') invSeed([it]);
    else if (id === 'inv-tolab') labAddSources([it.b.file]);
    else if (id === 'inv-favone') { await invToggleFav(it.key); invRenderList(); invRenderDetail(); }
    else if (id === 'inv-addtag') {
      await invAddTag([it.key], $('inv-newtag').value);
      invRenderTagOptions(); invRenderList(); invRenderDetail();
      $('inv-newtag').focus();
    } else if (e.target.classList.contains('inv-tag-x')) {
      await invRemoveTag([it.key], e.target.parentElement.dataset.tag);
      invRenderTagOptions(); invRenderList(); invRenderDetail();
    }
  };
  $('inv-detail').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.id === 'inv-newtag') $('inv-addtag').click();
  };
  $('inv-detail').addEventListener('change', async (e) => {
    if (e.target.id !== 'inv-notes' || !inv.cur) return;
    await saveUser({ ...userRec(inv.cur), notes: e.target.value.trim() });
    invRenderList();
  });

  const visibleKeys = () => {
    const f = invFilterState();
    return inv.items.filter((it) => invMatches(it, f)).map((it) => it.key);
  };
  $('inv-selvis').onclick = () => { visibleKeys().forEach((k) => inv.sel.add(k)); invRenderList(); };
  $('inv-selnone').onclick = () => { inv.sel.clear(); invRenderList(); };
  $('inv-seltag-add').onclick = async () => {
    if (!inv.sel.size) { log('inventario: no hay bots seleccionados'); return; }
    await invAddTag([...inv.sel], $('inv-seltag').value);
    invRenderTagOptions(); invRenderList(); invRenderDetail();
  };
  $('inv-seltag-del').onclick = async () => {
    const t = $('inv-seltag').value.trim().replace(/^#/, '').toLowerCase();
    if (!t || !inv.sel.size) return;
    await invRemoveTag([...inv.sel], t);
    invRenderTagOptions(); invRenderList(); invRenderDetail();
  };
  $('inv-selfav').onclick = async () => {
    for (const k of inv.sel) if (!userRec(k).fav) await invToggleFav(k);
    invRenderList(); invRenderDetail();
  };
  $('inv-setsave').onclick = async () => {
    const name = $('inv-setname').value.trim();
    if (!name || !inv.sel.size) { log('inventario: poné un nombre y seleccioná bots'); return; }
    const rec = { name, keys: [...inv.sel] };
    inv.sets.set(name, rec);
    if (inv.dbOk) await InvDB.put('sets', rec).catch((er) => log('inventario: ' + er.message));
    invRenderTagOptions();
    $('inv-sets').value = name;
    log(`inventario: selección "${name}" guardada (${rec.keys.length} bots)`);
  };
  $('inv-sets').onchange = () => {
    const s = inv.sets.get($('inv-sets').value);
    if (!s) return;
    inv.sel = new Set(s.keys.filter((k) => inv.byKey.has(k)));
    $('inv-setname').value = s.name;
    invRenderList();
  };
  $('inv-setdel').onclick = async () => {
    const name = $('inv-sets').value;
    if (!name) return;
    inv.sets.delete(name);
    if (inv.dbOk) await InvDB.del('sets', name).catch(() => {});
    invRenderTagOptions();
  };
  $('inv-seedsel').onclick = () => {
    const list = [...inv.sel].map((k) => inv.byKey.get(k)).filter(Boolean);
    if (!list.length) { log('inventario: no hay bots seleccionados'); return; }
    invSeed(list);
  };
  $('inv-sellab').onclick = () => {
    const files = [...inv.sel].map((k) => inv.byKey.get(k)).filter(Boolean).map((it) => it.b.file);
    if (!files.length) { log('inventario: no hay bots seleccionados'); return; }
    labAddSources(files);
  };
  $('inv-export').onclick = invExport;
  $('inv-import').onclick = () => $('inv-importf').click();
  $('inv-importf').onchange = (e) => {
    const f = e.target.files[0];
    if (f) invImport(f);
    e.target.value = '';
  };

  invRenderAll();
  $('inv-q').focus();
}
