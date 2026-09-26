'use strict';
// Laboratorio de híbridos (capa host, fuera de la fidelidad). Arma un ADN
// nuevo con genes de distintos bots del Bestiary, eligiéndolos por
// capacidad genética.
//
// Los genes salen de bots/genes.json (tools/bestiary/analyze_bots.js): el
// texto de cada gen tal como lo dejó el core al cargar el bot (sysvars con
// nombre, `def` resueltos a direcciones), verificado con una ida y vuelta
// por el core para los 588 bots, así que un gen se trasplanta sin pérdida.
// Lo que sí puede romperse al mezclar, y el Laboratorio avisa:
//  - dependencias: un gen lee memoria propia (p. ej. 971) que en su bot
//    escribe otro gen que no se trajo → "+ gen N" lo agrega;
//  - colisiones: dos bots usan la misma dirección propia para cosas
//    distintas → con "remapear" (por defecto) el segundo pasa a una libre;
//  - números de gen literales en .delgene/.mkvirus: el trasplante cambia la
//    numeración.
// Los híbridos se guardan en IndexedDB (store 'hybrids', inventory.js).
//
// Usa globales de index.html e inventory.js.

const lab = {
  win: null,
  genes: null,           // genes.json
  sys: new Set(),        // direcciones de sysvar
  parts: [],             // [{file, gi}] en orden
  sources: [],           // archivos elegidos como fuente (modo "bots")
  remap: true,
  hybrids: new Map(),    // name -> {name, veg, remap, parts}
  preview: null,         // {file, gi} con el código a la vista
};

async function labLoadGenes() {
  if (lab.genes) return true;
  try {
    const r = await fetch('bots/genes.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    lab.genes = await r.json();
    lab.sys = new Set(lab.genes.sysAddrs || []);
    return true;
  } catch (e) {
    log('laboratorio: no pude leer bots/genes.json (corré tools/bestiary/analyze_bots.js)');
    return false;
  }
}

const labItem = (file) => inv.items.find((it) => it.b.file === file);
const labGene = (file, gi) => ((lab.genes.bots[file] || [])[gi]);
const labGeneCaps = (file, gi) => {
  const it = labItem(file);
  return (it && it.p && it.p.geneCaps[gi]) || [];
};
const labTokens = (g) => g.t.split(/\s+/).length;

// ---- Análisis del híbrido ---------------------------------------------------
// Devuelve {remaps: Map(file -> Map(addr -> nueva)), warns: [...], caps: Set}
function labAnalyze() {
  const warns = [], caps = new Set();
  const byFile = new Map();              // file -> Set(gi) incluidos
  for (const p of lab.parts) {
    if (!byFile.has(p.file)) byFile.set(p.file, new Set());
    byFile.get(p.file).add(p.gi);
    labGeneCaps(p.file, p.gi).forEach((c) => caps.add(c));
  }
  const name = (f) => (labItem(f) || { b: { name: f } }).b.name;

  // Dependencias de memoria propia dentro de cada bot de origen
  for (const [file, incl] of byFile) {
    const all = lab.genes.bots[file] || [];
    for (const gi of incl) {
      const g = all[gi];
      for (const a of g.r || []) {
        if ([...incl].some((j) => (all[j].w || []).includes(a))) continue;
        const writers = all.map((x, j) => ((x.w || []).includes(a) ? j : -1))
          .filter((j) => j >= 0);
        if (writers.length)
          warns.push({ kind: 'dep', file, gi, addr: a, writers,
            text: `${name(file)} gen ${gi + 1} lee ${a}, que en su bot ` +
                  `${writers.length > 1 ? 'escriben los genes' : 'escribe el gen'} ` +
                  writers.map((j) => j + 1).join(', ') });
      }
      if (g.gl)
        warns.push({ kind: 'gl', file, gi,
          text: `${name(file)} gen ${gi + 1} usa un número de gen literal en .delgene/.mkvirus: ` +
                'en el híbrido la numeración cambia' });
    }
  }

  // Colisiones de memoria propia entre bots distintos
  const users = new Map();               // addr -> [files] (orden de aparición)
  for (const [file, incl] of byFile)
    for (const gi of incl) {
      const g = lab.genes.bots[file][gi];
      for (const a of [...(g.w || []), ...(g.r || [])]) {
        if (!users.has(a)) users.set(a, []);
        if (!users.get(a).includes(file)) users.get(a).push(file);
      }
    }
  const remaps = new Map();
  const taken = new Set(users.keys());
  const pool = [];
  for (let a = 971; a <= 990; a++) pool.push(a);   // la zona libre de costumbre
  for (let a = 1; a <= 1000; a++) if (a < 971 || a > 990) pool.push(a);
  const nextFree = () => {
    const a = pool.find((x) => !taken.has(x) && !lab.sys.has(x));
    if (a !== undefined) taken.add(a);
    return a;
  };
  for (const [a, files] of users) {
    if (files.length < 2) continue;
    if (!lab.remap) {
      warns.push({ kind: 'col', addr: a,
        text: `memoria ${a}: la usan ${files.map(name).join(' y ')} (sin remapear)` });
      continue;
    }
    const moved = [];
    for (const f of files.slice(1)) {
      const b = nextFree();
      if (b === undefined) break;
      if (!remaps.has(f)) remaps.set(f, new Map());
      remaps.get(f).set(a, b);
      moved.push(`${name(f)} → ${b}`);
    }
    warns.push({ kind: 'remap', addr: a,
      text: `memoria ${a}: la usan ${files.length} bots; remapeado ${moved.join(', ')}` });
  }

  if (lab.parts.length) {
    if (!caps.has('repro-asex') && !caps.has('repro-sex'))
      warns.push({ kind: 'info', text: 'ningún gen reproduce: el híbrido no deja descendencia' });
    if (!['caza-nrg', 'caza-cuerpo', 'dispara', 'come-lazo', 'fotosintesis']
      .some((c) => caps.has(c)))
      warns.push({ kind: 'info', text: 'ningún gen consigue energía (ni caza ni fotosíntesis)' });
  }
  return { remaps, warns, caps };
}

// Texto del gen con las direcciones remapeadas (solo los tokens marcados
// como dirección literal por el analizador).
function labGeneText(file, gi, remap) {
  const g = labGene(file, gi);
  if (!remap || !g.ai) return g.t;
  const at = new Map();                  // índice de token -> nueva dirección
  for (const [a, idxs] of Object.entries(g.ai))
    if (remap.has(+a)) for (const i of idxs) at.set(i, remap.get(+a));
  if (!at.size) return g.t;
  let i = 0;
  return g.t.split('\n').map((line) => line.split(/\s+/).map((tok) => {
    const n = at.get(i++);
    if (n === undefined) return tok;
    return tok[0] === '*' ? '*' + n : String(n);
  }).join(' ')).join('\n');
}

function labCompose(hname) {
  const { remaps } = labAnalyze();
  const name = (f) => (labItem(f) || { b: { name: f } }).b.name;
  const head = [
    `' Híbrido: ${hname}`,
    `' Armado en el Laboratorio de híbridos (${new Date().toISOString().slice(0, 10)})`,
    "' Genes:",
    ...lab.parts.map((p, k) => `'  ${k + 1}. ${name(p.file)} · gen ${p.gi + 1}`),
  ];
  const body = lab.parts.map((p, k) =>
    `' --- ${k + 1}. ${name(p.file)} · gen ${p.gi + 1} ---\n` +
    labGeneText(p.file, p.gi, remaps.get(p.file)));
  return head.join('\n') + '\n\n' + body.join('\n\n') + '\n';
}

// ---- Render -----------------------------------------------------------------
function labGeneRow(file, gi, extra) {
  const g = labGene(file, gi);
  const it = labItem(file);
  const caps = labGeneCaps(file, gi);
  const mem = (g.w || g.r) ? '<span class="lab-mem" title="usa memoria propia">mem</span>' : '';
  return `<div class="lab-g" data-f="${escHtml(file)}" data-gi="${gi}">` +
    `<span class="lab-src" title="${escHtml(it ? it.b.name : file)}">${escHtml(it ? it.b.name : file)}</span>` +
    `<span class="lab-gi">gen ${gi + 1}</span>` +
    `<span class="lab-tk">${labTokens(g)} tk</span>` +
    `<span class="inv-caps">${mem}${caps.map((c) => capChip(c)).join('')}</span>` +
    extra + '</div>';
}

function labRenderSource() {
  const w = lab.win;
  const mode = w.querySelector('#lab-mode').value;
  w.querySelector('#lab-capsel').hidden = mode !== 'cap';
  w.querySelector('#lab-botsel').hidden = mode !== 'bot';
  const q = w.querySelector('#lab-q').value.trim().toLowerCase();
  const autonomous = w.querySelector('#lab-auto').checked;
  const rows = [];
  const push = (file, gi) => {
    const g = labGene(file, gi);
    if (autonomous && (g.w || g.r)) return;
    rows.push({ file, gi, tk: labTokens(g) });
  };
  if (mode === 'cap') {
    const cap = w.querySelector('#lab-capsel').value;
    for (const it of inv.items) {
      if (!it.p || !lab.genes.bots[it.b.file]) continue;
      if (q && !it.b.name.toLowerCase().includes(q)) continue;
      it.p.geneCaps.forEach((cs, gi) => { if (cs.includes(cap)) push(it.b.file, gi); });
    }
    rows.sort((a, b) => a.tk - b.tk);
  } else {
    const file = w.querySelector('#lab-botsel').value;
    (lab.genes.bots[file] || []).forEach((g, gi) => push(file, gi));
  }
  const MAX = 300;
  w.querySelector('#lab-srccount').textContent =
    `${rows.length} gen${rows.length === 1 ? '' : 'es'}${rows.length > MAX ? ` (se muestran ${MAX})` : ''}`;
  w.querySelector('#lab-srclist').innerHTML = rows.slice(0, MAX).map((r) =>
    labGeneRow(r.file, r.gi,
      '<button class="lab-see" title="Ver el código">👁</button>' +
      '<button class="lab-add" title="Agregar al híbrido">+</button>')).join('') ||
    '<div class="inv-empty">Sin genes para mostrar.</div>';
}

function labRenderBots() {
  const sel = lab.win.querySelector('#lab-botsel');
  const cur = sel.value;
  sel.innerHTML = lab.sources.length
    ? lab.sources.map((f) => `<option value="${escHtml(f)}">${escHtml((labItem(f) || { b: { name: f } }).b.name)}</option>`).join('')
    : '<option value="">(mandá bots desde el Inventario: 🧬)</option>';
  if (lab.sources.includes(cur)) sel.value = cur;
}

function labRenderHybrid() {
  const w = lab.win;
  const { warns, caps } = labAnalyze();
  w.querySelector('#lab-parts').innerHTML = lab.parts.map((p, k) =>
    labGeneRow(p.file, p.gi,
      '<button class="lab-see" title="Ver el código">👁</button>' +
      `<button class="lab-up" data-k="${k}" title="Subir">↑</button>` +
      `<button class="lab-dn" data-k="${k}" title="Bajar">↓</button>` +
      `<button class="lab-rm" data-k="${k}" title="Quitar">✕</button>`)
      .replace('<div class="lab-g"', `<div class="lab-g" data-k="${k}"`)
      .replace('<span class="lab-src"', `<span class="lab-k">${k + 1}</span><span class="lab-src"`)).join('') ||
    '<div class="inv-empty">Agregá genes desde la izquierda (+).</div>';
  const order = Object.keys((inv.profiles && inv.profiles.caps) || {});
  w.querySelector('#lab-caps').innerHTML =
    order.filter((c) => caps.has(c)).map((c) => capChip(c)).join('') ||
    '<i class="inv-empty">—</i>';
  w.querySelector('#lab-warns').innerHTML = warns.map((x) =>
    `<div class="lab-w lab-w-${x.kind}">${x.kind === 'remap' || x.kind === 'info' ? 'ℹ' : '⚠'} ${escHtml(x.text)}` +
    (x.kind === 'dep' ? ' ' + x.writers.map((j) =>
      `<button class="lab-adddep" data-f="${escHtml(x.file)}" data-gi="${j}">+ gen ${j + 1}</button>`).join('') : '') +
    '</div>').join('');
  const nTok = lab.parts.reduce((n, p) => n + labTokens(labGene(p.file, p.gi)), 0);
  w.querySelector('#lab-sum').textContent =
    `${lab.parts.length} genes · ${nTok} tokens · ${new Set(lab.parts.map((p) => p.file)).size} bots de origen`;
  const dna = w.querySelector('#lab-dna');
  if (!dna.hidden) dna.value = labCompose(labName());
}

function labRenderPreview() {
  const box = lab.win.querySelector('#lab-preview');
  const p = lab.preview;
  if (!p) { box.hidden = true; return; }
  const it = labItem(p.file);
  box.hidden = false;
  box.querySelector('b').textContent = `${it ? it.b.name : p.file} · gen ${p.gi + 1}`;
  box.querySelector('pre').textContent = labGene(p.file, p.gi).t;
}

function labRenderSaved() {
  const sel = lab.win.querySelector('#lab-saved');
  sel.innerHTML = '<option value="">híbridos guardados…</option>' +
    [...lab.hybrids.values()].sort((a, b) => a.name.localeCompare(b.name))
      .map((h) => `<option value="${escHtml(h.name)}">${escHtml(h.name)} (${h.parts.length} genes)</option>`).join('');
}

const labName = () => (lab.win.querySelector('#lab-name').value.trim() || 'Hibrido');

// ---- Acciones ---------------------------------------------------------------
function labAdd(file, gi) {
  lab.parts.push({ file, gi });
  labRenderHybrid();
}

function labSpecies() {
  const name = labName();
  return { name: name + '.txt', dna: labCompose(name),
           veg: lab.win.querySelector('#lab-veg').checked };
}

async function labSave() {
  const h = { name: labName(), veg: lab.win.querySelector('#lab-veg').checked,
              remap: lab.remap, parts: lab.parts.map((p) => ({ ...p })),
              updated: new Date().toISOString() };
  if (!h.parts.length) { log('laboratorio: el híbrido no tiene genes'); return; }
  lab.hybrids.set(h.name, h);
  if (inv.dbOk) await InvDB.put('hybrids', h).catch((e) => log('laboratorio: ' + e.message));
  labRenderSaved();
  lab.win.querySelector('#lab-saved').value = h.name;
  log(`laboratorio: híbrido "${h.name}" guardado (${h.parts.length} genes)`);
}

function labLoadHybrid(name) {
  const h = lab.hybrids.get(name);
  if (!h) return;
  lab.parts = h.parts.filter((p) => labGene(p.file, p.gi)).map((p) => ({ ...p }));
  if (lab.parts.length < h.parts.length)
    log(`laboratorio: ${h.parts.length - lab.parts.length} gen(es) de "${name}" ya no están en el Bestiary`);
  lab.remap = h.remap !== false;
  const w = lab.win;
  w.querySelector('#lab-name').value = h.name;
  w.querySelector('#lab-veg').checked = !!h.veg;
  w.querySelector('#lab-remap').checked = lab.remap;
  labRenderHybrid();
}

// RV-40 (index.html resolveDnaByName): ADN de un híbrido guardado por el
// nombre de especie, para las sims guardadas que lo sembraron.
async function labDnaByName(spName) {
  try {
    if (!(await labLoadGenes())) return null;
    if (!inv.items.length) await invLoad();
    const all = await InvDB.all('hybrids');
    const h = all.find((x) => x.name + '.txt' === spName);
    if (!h) return null;
    const saved = { parts: lab.parts, remap: lab.remap };
    lab.parts = h.parts.filter((p) => labGene(p.file, p.gi));
    lab.remap = h.remap !== false;
    const dna = labCompose(h.name);
    lab.parts = saved.parts; lab.remap = saved.remap;
    return dna;
  } catch (e) { return null; }
}

// Desde el Inventario: agregar bots como fuente (y abrir el Laboratorio).
async function labAddSources(files) {
  await openLab();
  if (!lab.win) return;
  for (const f of files) if (!lab.sources.includes(f)) lab.sources.push(f);
  labRenderBots();
  const w = lab.win;
  w.querySelector('#lab-mode').value = 'bot';
  w.querySelector('#lab-botsel').value = files[files.length - 1];
  labRenderSource();
}

// ---- Ventana ----------------------------------------------------------------
async function openLab() {
  if (lab.win) { winLayer.appendChild(lab.win); return; }
  if (!BESTIARY.length) { log('laboratorio: no hay bots/bots.json (¿la página se sirve por http?)'); return; }
  if (!inv.items.length) await invLoad();
  if (!inv.profiles) { log('laboratorio: falta bots/profiles.json'); return; }
  if (!(await labLoadGenes())) return;
  try {
    lab.hybrids = new Map((await InvDB.all('hybrids')).map((h) => [h.name, h]));
  } catch (e) { /* sin IndexedDB: los híbridos no se guardan */ }

  const w = makeWindow('Laboratorio de híbridos', Math.min(1100, innerWidth - 40), 0,
                       () => { lab.win = null; });
  lab.win = w;
  w.classList.add('inv-win', 'lab-win');
  w.style.left = '60px';
  w.style.top = '70px';
  w.style.height = Math.min(680, innerHeight - 90) + 'px';
  const capOpts = Object.entries(inv.profiles.caps).map(([k, c]) =>
    `<option value="${k}">${escHtml(c.group + ' · ' + c.label)}</option>`).join('');
  w.body.innerHTML =
    '<div class="inv-main">' +
    '<div class="lab-col">' +
    '<div class="lab-h">Genes disponibles</div>' +
    '<div class="inv-bar">' +
    '<select id="lab-mode"><option value="cap">por capacidad (todo el Bestiary)</option>' +
    '<option value="bot">de un bot</option></select>' +
    `<select id="lab-capsel">${capOpts}</select>` +
    '<select id="lab-botsel" hidden></select>' +
    '<input type="search" id="lab-q" placeholder="filtrar por bot…" style="width:130px">' +
    '<label title="Sin memoria propia: se trasplantan sin dependencias ni colisiones">' +
    '<input type="checkbox" id="lab-auto"> solo autónomos</label>' +
    '<span class="inv-sp"></span><span id="lab-srccount" class="inv-n"></span>' +
    '</div>' +
    '<div id="lab-srclist" class="lab-list"></div>' +
    '<div id="lab-preview" hidden><div class="lab-h"><b></b>' +
    '<button id="lab-prevx" title="Cerrar">✕</button></div><pre></pre></div>' +
    '</div>' +
    '<div class="lab-col">' +
    '<div class="lab-h">Híbrido <span id="lab-sum" class="inv-n"></span></div>' +
    '<div class="inv-bar">' +
    '<input type="text" id="lab-name" value="Hibrido" style="width:150px" title="Nombre de la especie">' +
    '<label><input type="checkbox" id="lab-veg"> vegetal</label>' +
    '<label title="Si dos bots usan la misma dirección de memoria propia, mover la del segundo a una libre">' +
    '<input type="checkbox" id="lab-remap" checked> remapear memoria</label>' +
    '<span class="inv-sp"></span>' +
    '<button id="lab-new">Nuevo</button>' +
    '<select id="lab-saved"></select>' +
    '<button id="lab-del" title="Borrar el híbrido guardado elegido">🗑</button>' +
    '</div>' +
    '<div id="lab-parts" class="lab-list"></div>' +
    '<div class="lab-caps"><span class="inv-n">Capacidades:</span> <span id="lab-caps"></span></div>' +
    '<div id="lab-warns"></div>' +
    '<textarea id="lab-dna" readonly spellcheck="false" hidden></textarea>' +
    '<div class="inv-foot">' +
    '<button id="lab-showdna">Ver ADN</button>' +
    '<button id="lab-save">Guardar</button>' +
    '<button id="lab-toform">Al formulario</button>' +
    '<label>nº</label><input type="number" id="lab-qty" value="5" min="1" style="width:52px">' +
    '<label>nrg</label><input type="number" id="lab-nrg" value="3000" min="1" style="width:70px">' +
    '<button id="lab-seed" class="primary">Sembrar</button>' +
    '</div>' +
    '</div></div>';

  const $ = (id) => w.querySelector('#' + id);
  let qT = 0;
  $('lab-mode').onchange = labRenderSource;
  $('lab-capsel').onchange = labRenderSource;
  $('lab-botsel').onchange = labRenderSource;
  $('lab-auto').onchange = labRenderSource;
  $('lab-q').oninput = () => { clearTimeout(qT); qT = setTimeout(labRenderSource, 120); };
  $('lab-remap').onchange = (e) => { lab.remap = e.target.checked; labRenderHybrid(); };
  $('lab-prevx').onclick = () => { lab.preview = null; labRenderPreview(); };

  w.body.addEventListener('click', (e) => {
    const row = e.target.closest('.lab-g');
    const t = e.target;
    if (t.classList.contains('lab-adddep')) { labAdd(t.dataset.f, +t.dataset.gi); return; }
    if (!row) return;
    const file = row.dataset.f, gi = +row.dataset.gi;
    if (t.classList.contains('lab-add')) labAdd(file, gi);
    else if (t.classList.contains('lab-see') || !t.closest('button')) {
      lab.preview = { file, gi };
      labRenderPreview();
    } else {
      const k = +t.dataset.k;
      if (t.classList.contains('lab-rm')) lab.parts.splice(k, 1);
      else if (t.classList.contains('lab-up') && k > 0)
        [lab.parts[k - 1], lab.parts[k]] = [lab.parts[k], lab.parts[k - 1]];
      else if (t.classList.contains('lab-dn') && k < lab.parts.length - 1)
        [lab.parts[k + 1], lab.parts[k]] = [lab.parts[k], lab.parts[k + 1]];
      labRenderHybrid();
    }
  });

  $('lab-new').onclick = () => {
    lab.parts = [];
    $('lab-name').value = 'Hibrido';
    $('lab-veg').checked = false;
    $('lab-saved').value = '';
    labRenderHybrid();
  };
  $('lab-saved').onchange = () => labLoadHybrid($('lab-saved').value);
  $('lab-del').onclick = async () => {
    const name = $('lab-saved').value;
    if (!name) return;
    lab.hybrids.delete(name);
    if (inv.dbOk) await InvDB.del('hybrids', name).catch(() => {});
    labRenderSaved();
  };
  $('lab-showdna').onclick = () => {
    const dna = $('lab-dna');
    dna.hidden = !dna.hidden;
    $('lab-showdna').textContent = dna.hidden ? 'Ver ADN' : 'Ocultar ADN';
    labRenderHybrid();
  };
  $('lab-save').onclick = labSave;
  $('lab-toform').onclick = () => {
    if (!lab.parts.length) { log('laboratorio: el híbrido no tiene genes'); return; }
    const sp = labSpecies();
    document.getElementById('dna').value = sp.dna;
    document.getElementById('sp-name').value = sp.name;
    document.getElementById('sp-veg').checked = sp.veg;
    document.getElementById('sp-color').value = invColor();
    const sel = document.getElementById('preset');
    let o = sel.querySelector('option[value="inv"]');
    if (!o) { o = document.createElement('option'); o.value = 'inv'; sel.appendChild(o); }
    o.textContent = 'Híbrido: ' + labName();
    sel.value = 'inv';
    log(`laboratorio: ${sp.name} en el formulario`);
  };
  $('lab-seed').onclick = () => {
    if (!lab.parts.length) { log('laboratorio: el híbrido no tiene genes'); return; }
    const sp = labSpecies();
    worker.postMessage({ t: 'seed-species', sp: {
      ...sp,
      qty: parseInt($('lab-qty').value, 10) || 5,
      nrg: parseFloat($('lab-nrg').value) || 3000,
      color: cssToVbColor(invColor()),
    } });
  };

  labRenderBots();
  labRenderSaved();
  labRenderSource();
  labRenderHybrid();
}
