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
    log('lab: could not read bots/genes.json (run tools/bestiary/analyze_bots.js)');
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
            text: `${name(file)} gene ${gi + 1} reads ${a}, which in its bot is written by ` +
                  `${writers.length > 1 ? 'genes' : 'gene'} ` +
                  writers.map((j) => j + 1).join(', ') });
      }
      if (g.gl)
        warns.push({ kind: 'gl', file, gi,
          text: `${name(file)} gene ${gi + 1} uses a literal gene number in .delgene/.mkvirus: ` +
                'gene numbering changes in the hybrid' });
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
        text: `memory ${a}: used by ${files.map(name).join(' and ')} (not remapped)` });
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
      text: `memory ${a}: used by ${files.length} bots; remapped ${moved.join(', ')}` });
  }

  if (lab.parts.length) {
    if (!caps.has('repro-asex') && !caps.has('repro-sex'))
      warns.push({ kind: 'info', text: 'no gene reproduces: the hybrid leaves no offspring' });
    if (!['caza-nrg', 'caza-cuerpo', 'dispara', 'come-lazo', 'fotosintesis']
      .some((c) => caps.has(c)))
      warns.push({ kind: 'info', text: 'no gene gets energy (neither hunting nor photosynthesis)' });
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
    `' Hybrid: ${hname}`,
    `' Built in the Hybrid lab (${new Date().toISOString().slice(0, 10)})`,
    "' Genes:",
    ...lab.parts.map((p, k) => `'  ${k + 1}. ${name(p.file)} · gene ${p.gi + 1}`),
  ];
  const body = lab.parts.map((p, k) =>
    `' --- ${k + 1}. ${name(p.file)} · gene ${p.gi + 1} ---\n` +
    labGeneText(p.file, p.gi, remaps.get(p.file)));
  return head.join('\n') + '\n\n' + body.join('\n\n') + '\n';
}

// ---- Render -----------------------------------------------------------------
function labGeneRow(file, gi, extra) {
  const g = labGene(file, gi);
  const it = labItem(file);
  const caps = labGeneCaps(file, gi);
  const mem = (g.w || g.r) ? '<span class="lab-mem" title="uses its own memory">mem</span>' : '';
  return `<div class="lab-g" data-f="${escHtml(file)}" data-gi="${gi}">` +
    `<span class="lab-src" title="${escHtml(it ? it.b.name : file)}">${escHtml(it ? it.b.name : file)}</span>` +
    `<span class="lab-gi">gene ${gi + 1}</span>` +
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
    `${rows.length} gene${rows.length === 1 ? '' : 's'}${rows.length > MAX ? ` (showing ${MAX})` : ''}`;
  w.querySelector('#lab-srclist').innerHTML = rows.slice(0, MAX).map((r) =>
    labGeneRow(r.file, r.gi,
      '<button class="lab-see" title="View the code">👁</button>' +
      '<button class="lab-add" title="Add to the hybrid">+</button>')).join('') ||
    '<div class="inv-empty">No genes to show.</div>';
}

function labRenderBots() {
  const sel = lab.win.querySelector('#lab-botsel');
  const cur = sel.value;
  sel.innerHTML = lab.sources.length
    ? lab.sources.map((f) => `<option value="${escHtml(f)}">${escHtml((labItem(f) || { b: { name: f } }).b.name)}</option>`).join('')
    : '<option value="">(send bots from the Inventory: 🧬)</option>';
  if (lab.sources.includes(cur)) sel.value = cur;
}

function labRenderHybrid() {
  const w = lab.win;
  const { warns, caps } = labAnalyze();
  w.querySelector('#lab-parts').innerHTML = lab.parts.map((p, k) =>
    labGeneRow(p.file, p.gi,
      '<button class="lab-see" title="View the code">👁</button>' +
      `<button class="lab-up" data-k="${k}" title="Move up">↑</button>` +
      `<button class="lab-dn" data-k="${k}" title="Move down">↓</button>` +
      `<button class="lab-rm" data-k="${k}" title="Remove">✕</button>`)
      .replace('<div class="lab-g"', `<div class="lab-g" data-k="${k}"`)
      .replace('<span class="lab-src"', `<span class="lab-k">${k + 1}</span><span class="lab-src"`)).join('') ||
    '<div class="inv-empty">Add genes from the left (+).</div>';
  const order = Object.keys((inv.profiles && inv.profiles.caps) || {});
  w.querySelector('#lab-caps').innerHTML =
    order.filter((c) => caps.has(c)).map((c) => capChip(c)).join('') ||
    '<i class="inv-empty">—</i>';
  w.querySelector('#lab-warns').innerHTML = warns.map((x) =>
    `<div class="lab-w lab-w-${x.kind}">${x.kind === 'remap' || x.kind === 'info' ? 'ℹ' : '⚠'} ${escHtml(x.text)}` +
    (x.kind === 'dep' ? ' ' + x.writers.map((j) =>
      `<button class="lab-adddep" data-f="${escHtml(x.file)}" data-gi="${j}">+ gene ${j + 1}</button>`).join('') : '') +
    '</div>').join('');
  const nTok = lab.parts.reduce((n, p) => n + labTokens(labGene(p.file, p.gi)), 0);
  w.querySelector('#lab-sum').textContent =
    `${lab.parts.length} genes · ${nTok} tokens · ${new Set(lab.parts.map((p) => p.file)).size} source bots`;
  const dna = w.querySelector('#lab-dna');
  if (!dna.hidden) dna.value = labCompose(labName());
}

function labRenderPreview() {
  const box = lab.win.querySelector('#lab-preview');
  const p = lab.preview;
  if (!p) { box.hidden = true; return; }
  const it = labItem(p.file);
  box.hidden = false;
  box.querySelector('b').textContent = `${it ? it.b.name : p.file} · gene ${p.gi + 1}`;
  box.querySelector('pre').textContent = labGene(p.file, p.gi).t;
}

function labRenderSaved() {
  const sel = lab.win.querySelector('#lab-saved');
  sel.innerHTML = '<option value="">saved hybrids…</option>' +
    [...lab.hybrids.values()].sort((a, b) => a.name.localeCompare(b.name))
      .map((h) => `<option value="${escHtml(h.name)}">${escHtml(h.name)} (${h.parts.length} genes)</option>`).join('');
}

const labName = () => (lab.win.querySelector('#lab-name').value.trim() || 'Hybrid');

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
  if (!h.parts.length) { log('lab: the hybrid has no genes'); return; }
  lab.hybrids.set(h.name, h);
  if (inv.dbOk) await InvDB.put('hybrids', h).catch((e) => log('lab: ' + e.message));
  labRenderSaved();
  lab.win.querySelector('#lab-saved').value = h.name;
  log(`lab: hybrid "${h.name}" saved (${h.parts.length} genes)`);
}

function labLoadHybrid(name) {
  const h = lab.hybrids.get(name);
  if (!h) return;
  lab.parts = h.parts.filter((p) => labGene(p.file, p.gi)).map((p) => ({ ...p }));
  if (lab.parts.length < h.parts.length)
    log(`lab: ${h.parts.length - lab.parts.length} gene(s) of "${name}" are no longer in the Bestiary`);
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
  if (!BESTIARY.length) { log('lab: no bots/bots.json (is the page served over http?)'); return; }
  if (!inv.items.length) await invLoad();
  if (!inv.profiles) { log('lab: bots/profiles.json is missing'); return; }
  if (!(await labLoadGenes())) return;
  try {
    lab.hybrids = new Map((await InvDB.all('hybrids')).map((h) => [h.name, h]));
  } catch (e) { /* sin IndexedDB: los híbridos no se guardan */ }

  const w = makeWindow('Hybrid lab', Math.min(1100, innerWidth - 40), 0,
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
    '<div class="lab-h">Available genes</div>' +
    '<div class="inv-bar">' +
    '<select id="lab-mode"><option value="cap">by capability (whole Bestiary)</option>' +
    '<option value="bot">from one bot</option></select>' +
    `<select id="lab-capsel">${capOpts}</select>` +
    '<select id="lab-botsel" hidden></select>' +
    '<input type="search" id="lab-q" placeholder="filter by bot…" style="width:130px">' +
    '<label title="No own memory: they transplant with no dependencies or collisions">' +
    '<input type="checkbox" id="lab-auto"> self-contained only</label>' +
    '<span class="inv-sp"></span><span id="lab-srccount" class="inv-n"></span>' +
    '</div>' +
    '<div id="lab-srclist" class="lab-list"></div>' +
    '<div id="lab-preview" hidden><div class="lab-h"><b></b>' +
    '<button id="lab-prevx" title="Close">✕</button></div><pre></pre></div>' +
    '</div>' +
    '<div class="lab-col">' +
    '<div class="lab-h">Hybrid <span id="lab-sum" class="inv-n"></span></div>' +
    '<div class="inv-bar">' +
    '<input type="text" id="lab-name" value="Hybrid" style="width:150px" title="Species name">' +
    '<label><input type="checkbox" id="lab-veg"> vegetable</label>' +
    '<label title="If two bots use the same own-memory address, move the second one\'s to a free one">' +
    '<input type="checkbox" id="lab-remap" checked> remap memory</label>' +
    '<span class="inv-sp"></span>' +
    '<button id="lab-new">New</button>' +
    '<select id="lab-saved"></select>' +
    '<button id="lab-del" title="Delete the chosen saved hybrid">🗑</button>' +
    '</div>' +
    '<div id="lab-parts" class="lab-list"></div>' +
    '<div class="lab-caps"><span class="inv-n">Capabilities:</span> <span id="lab-caps"></span></div>' +
    '<div id="lab-warns"></div>' +
    '<textarea id="lab-dna" readonly spellcheck="false" hidden></textarea>' +
    '<div class="inv-foot">' +
    '<button id="lab-showdna">Show DNA</button>' +
    '<button id="lab-save">Save</button>' +
    '<button id="lab-toform">To the form</button>' +
    '<label>qty</label><input type="number" id="lab-qty" value="5" min="1" style="width:52px">' +
    '<label>nrg</label><input type="number" id="lab-nrg" value="3000" min="1" style="width:70px">' +
    '<button id="lab-seed" class="primary">Seed</button>' +
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
    $('lab-name').value = 'Hybrid';
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
    $('lab-showdna').textContent = dna.hidden ? 'Show DNA' : 'Hide DNA';
    labRenderHybrid();
  };
  $('lab-save').onclick = labSave;
  $('lab-toform').onclick = () => {
    if (!lab.parts.length) { log('lab: the hybrid has no genes'); return; }
    const sp = labSpecies();
    document.getElementById('dna').value = sp.dna;
    document.getElementById('sp-name').value = sp.name;
    document.getElementById('sp-veg').checked = sp.veg;
    document.getElementById('sp-color').value = invColor();
    const sel = document.getElementById('preset');
    let o = sel.querySelector('option[value="inv"]');
    if (!o) { o = document.createElement('option'); o.value = 'inv'; sel.appendChild(o); }
    o.textContent = 'Hybrid: ' + labName();
    sel.value = 'inv';
    log(`lab: ${sp.name} loaded into the form`);
  };
  $('lab-seed').onclick = () => {
    if (!lab.parts.length) { log('lab: the hybrid has no genes'); return; }
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
