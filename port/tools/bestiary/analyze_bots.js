'use strict';
// Perfil genético de los bots publicados (web/bots/bots.json) → web/bots/
// profiles.json, que consume el Inventario de la página.
//
// No analiza el .txt crudo: siembra cada bot con dbcore.wasm y recorre el
// ADN tal como lo quedó en el bot (db_sim_bot_text), con los nombres de
// sysvar canónicos, sin comentarios y con los genes ya delimitados por el
// propio core. Así un `.aimshot store` mal escrito no cuenta como disparo:
// el core lo resolvió a otra dirección y eso es lo que se ve acá.
//
// Qué mide: las sysvars que cada gen ESCRIBE (store y familia) y las que LEE
// (*.x). Con un seguimiento aproximado de la pila recupera el valor literal
// de `.shoot store` para distinguir el tipo de disparo (shots.hpp:750-757:
// -1 energía, -2 dona energía, -3 veneno, -4 residuos, -6 cuerpo, -8
// esperma; positivo = disparo de información a memoria).
//
// Capa host pura: no toca port/core/ ni el contrato de fidelidad.
//
// Uso (desde este directorio, después de publish_bots.py):
//   node analyze_bots.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const createDbCore = require(
  path.resolve(__dirname, '../../build-wasm/dbcore.js'));

const BOTS = path.resolve(__dirname, '../../web/bots');

// Dirección → nombre de sysvar (el primero de cada dirección), de la misma
// tabla que usa el core. El texto decompilado nombra las sysvars cuando
// puede, pero una dirección empujada como literal (`0 216 ... store`) llega
// como número.
const SV_BY_ADDR = (() => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../core/include/dbcore/sysvars.hpp'), 'utf8');
  const m = new Map();
  for (const [, name, addr] of src.matchAll(/\{"([a-z0-9]+)", (\d+)\}/g))
    if (!m.has(+addr)) m.set(+addr, name);
  return m;
})();

// ---- Catálogo de capacidades -------------------------------------------
// key: [etiqueta, grupo, descripción]. El orden es el de presentación.
const CAPS = {
  mueve:        ['moves', 'Movement', 'writes .up/.dn/.sx/.dx'],
  gira:         ['turns', 'Movement', 'writes .aimdx/.aimsx/.setaim'],
  ancla:        ['anchors', 'Movement', 'writes .fixpos'],
  'caza-nrg':   ['hunts (energy)', 'Attack', '.shoot -1: steals energy'],
  'caza-cuerpo':['hunts (body)', 'Attack', '.shoot -6: steals body'],
  dispara:      ['shoots (computed value)', 'Attack', '.shoot with a value computed at run time'],
  veneno:       ['venom', 'Attack', '.strvenom/.venval or .shoot -3'],
  toxina:       ['poison', 'Defense', '.strpoison: defensive poison released when attacked'],
  virus:        ['virus', 'Attack', '.mkvirus/.vshoot: injects a gene'],
  residuos:     ['dumps waste', 'Energy', '.shoot -4: gets rid of waste'],
  'dona-nrg':   ['gives energy', 'Social', '.shoot -2'],
  'dispara-info':['shoots info', 'Social', 'positive .shoot: writes into the memory of another bot'],
  caparazon:    ['shell', 'Defense', '.mkshell'],
  limo:         ['slime', 'Defense', '.mkslime'],
  fotosintesis: ['photosynthesis', 'Energy', '.mkchlr/.rmchlr (chloroplasts)'],
  cuerpo:       ['manages body', 'Energy', '.strbody/.fdbody'],
  'repro-asex': ['asexual reproduction', 'Reproduction', '.repro/.mrepro'],
  'repro-sex':  ['sexual reproduction', 'Reproduction', '.sexrepro or .shoot -8 (sperm)'],
  lazos:        ['uses ties', 'Multicellular', '.tie/.deltie/.tienum/.tieval'],
  'come-lazo':  ['feeds through ties', 'Attack', '.tieloc -1: drains energy from the tied bot'],
  estructura:   ['multicellular structure', 'Multicellular', '.stifftie/.fixang/.fixlen/.tieang/.tielen: builds rigid bodies'],
  comparte:     ['shares resources', 'Multicellular', '.sharenrg/.sharewaste/.shareshell/.shareslime/.sharechlr'],
  comunica:     ['communicates', 'Social', 'writes .out1-10 or .tout1-10'],
  'lee-memoria':['reads foreign memory', 'Social', 'writes .memloc/.tmemloc'],
  vision:       ['vision', 'Senses', 'reads .eye1-9 or .ref*'],
  ojos:         ['configurable eyes', 'Senses', 'writes .focuseye/.eyeNdir/.eyeNwidth'],
  reconoce:     ['recognizes kin', 'Senses', 'reads .my* or .in1-10 (compares with the other bot)'],
  reacciona:    ['reacts to hits', 'Senses', 'reads .shflav/.hit*/.shang/.pain'],
  luz:          ['light-sensitive', 'Senses', 'reads .daytime/.sun/.light'],
  autoedita:    ['self-editing', 'Genome', 'writes .delgene'],
};

// Arquetipo (uno por bot, para agrupar): el primero que cumple.
const ARCHETYPES = [
  ['multicelular', 'Multicellular', (c, b) => b.board === 'Multi-Bots' || c.has('estructura')],
  ['vegetal', 'Vegetable', (c, b) => b.veg || c.has('fotosintesis')],
  ['depredador', 'Predator', (c) => c.has('caza-nrg') || c.has('caza-cuerpo') || c.has('dispara') ||
                                      c.has('veneno') || c.has('virus') || c.has('come-lazo')],
  ['defensivo', 'Defensive', (c) => c.has('caparazon') || c.has('limo') || c.has('toxina')],
  ['pasivo', 'Passive', () => true],
];

const STORE_VAL = new Set(['store', 'addstore', 'substore', 'multstore', 'divstore',
                           'ceilstore', 'floorstore']);
const STORE_UN = new Set(['inc', 'dec', 'rndstore', 'sgnstore', 'absstore', 'sqrstore',
                          'negstore']);
const BIN = new Set(['add', 'sub', 'mult', 'div', 'mod', 'pow', 'pyth', 'angle', 'dist',
                     'anglecmp', 'root', 'logx', 'ceil', 'floor', '&', '|', '^']);
const UN = new Set(['rnd', 'sgn', 'abs', 'sqr', 'sin', 'cos', '~', '++', '--', '-', '<<', '>>']);
const CMP = new Set(['=', '!=', '>', '<', '>=', '<=', '%=', '!%=', '~=', '!~=']);

// Capacidades de un gen a partir de sus escrituras y lecturas.
function geneCaps(writes, reads, shoots, vals) {
  const c = new Set();
  const w = (re) => [...writes].some((n) => re.test(n));
  const r = (re) => [...reads].some((n) => re.test(n));
  if (w(/^(up|dn|sx|dx)$/)) c.add('mueve');
  if (w(/^(aimdx|aimsx|aimright|aimleft|setaim)$/)) c.add('gira');
  if (w(/^fixpos$/)) c.add('ancla');
  for (const v of shoots) {
    if (v === null) c.add('dispara');
    else if (v === -1) c.add('caza-nrg');
    else if (v === -6) c.add('caza-cuerpo');
    else if (v === -2) c.add('dona-nrg');
    else if (v === -3) c.add('veneno');
    else if (v === -4) c.add('residuos');
    else if (v === -8) c.add('repro-sex');
    else if (v > 0) c.add('dispara-info');
  }
  if (w(/^(strvenom|mkvenom|venval|vloc)$/)) c.add('veneno');
  if (w(/^(strpoison|mkpoison|ploc|pval)$/)) c.add('toxina');
  if (w(/^(mkvirus|vshoot)$/)) c.add('virus');
  if (w(/^mkshell$/)) c.add('caparazon');
  if (w(/^mkslime$/)) c.add('limo');
  if (w(/^(mkchlr|rmchlr)$/)) c.add('fotosintesis');
  if (w(/^(strbody|fdbody)$/)) c.add('cuerpo');
  if (w(/^(repro|mrepro)$/)) c.add('repro-asex');
  if (w(/^sexrepro$/)) c.add('repro-sex');
  if (w(/^(tie|stifftie|deltie|tienum|tieloc|tieval|fixang|fixlen|readtie|tieang[1-4]|tielen[1-4])$/))
    c.add('lazos');
  if ((vals.get('tieloc') || []).includes(-1)) c.add('come-lazo');
  if (w(/^(stifftie|fixang|fixlen|tieang[1-4]|tielen[1-4])$/)) c.add('estructura');
  if (w(/^share(nrg|waste|shell|slime|chlr)$/)) c.add('comparte');
  if (w(/^t?out([1-9]|10)$/)) c.add('comunica');
  if (w(/^t?memloc$/)) c.add('lee-memoria');
  if (w(/^(focuseye|eye[1-9](dir|width))$/)) c.add('ojos');
  if (w(/^delgene$/)) c.add('autoedita');
  if (r(/^(eye[1-9]|eyef|ref[a-z]+)$/)) c.add('vision');
  if (r(/^(my[a-z]+|in([1-9]|10))$/)) c.add('reconoce');
  if (r(/^(shflav|hit|hitup|hitdn|hitdx|hitsx|shang|pain|shup|shdn|shdx|shsx)$/)) c.add('reacciona');
  if (r(/^(daytime|sun|light|availability)$/)) c.add('luz');
  return c;
}

// Recorre un gen del texto decompilado con una pila aproximada. Además de
// las sysvars, junta la memoria propia del bot (direcciones 1..1000 que no
// son sysvar, p. ej. las de sus `def`) y en qué tokens aparece como
// dirección literal, para que el Laboratorio pueda remapearla.
function scanGene(tokens) {
  const writes = new Set(), reads = new Set(), shoots = [];
  const vals = new Map();   // sysvar → valores literales guardados
  const cw = new Set(), cr = new Set();
  const ai = {};            // dirección propia → índices de token
  const mark = (addr, i) => { (ai[addr] = ai[addr] || []).push(i); };
  const own = (n) => n >= 1 && n <= 1000 && !SV_BY_ADDR.has(n);
  let st = [];
  const pop = () => st.pop() || { u: true };
  // Una entrada de pila usada como dirección: nombre de sysvar o propia.
  const target = (e) => {
    if (e.a) return e.a;
    if ('n' in e && SV_BY_ADDR.has(e.n)) return SV_BY_ADDR.get(e.n);
    if ('n' in e && own(e.n)) { cw.add(e.n); if (e.i !== undefined) mark(e.n, e.i); }
    return null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const lc = t.toLowerCase();
    if (lc === 'cond' || lc === 'start' || lc === 'else' || lc === 'stop' || lc === 'end') {
      st = [];
      continue;
    }
    if (/^-?\d+$/.test(t)) { st.push({ n: parseInt(t, 10), i }); continue; }
    if (t[0] === '.') { st.push({ a: t.slice(1).toLowerCase() }); continue; }
    if (t.startsWith('*.')) { reads.add(t.slice(2).toLowerCase()); st.push({ u: true }); continue; }
    if (/^\*-?\d+$/.test(t)) {
      const n = parseInt(t.slice(1), 10);
      if (SV_BY_ADDR.has(n)) reads.add(SV_BY_ADDR.get(n));
      else if (own(n)) { cr.add(n); mark(n, i); }
      st.push({ u: true });
      continue;
    }
    if (t[0] === '*') { st.push({ u: true }); continue; }
    if (STORE_VAL.has(lc)) {
      const name = target(pop()), val = pop();
      if (name) {
        writes.add(name);
        if (lc === 'store' && 'n' in val) {
          if (!vals.has(name)) vals.set(name, []);
          vals.get(name).push(val.n);
        }
        if (name === 'shoot' && lc === 'store') shoots.push('n' in val ? val.n : null);
      }
      continue;
    }
    if (STORE_UN.has(lc)) {
      const name = target(pop());
      if (name) writes.add(name);
      continue;
    }
    if (BIN.has(lc)) { pop(); pop(); st.push({ u: true }); continue; }
    if (UN.has(lc)) {
      const v = pop();
      st.push(lc === '-' && 'n' in v ? { n: -v.n } : { u: true });
      continue;
    }
    if (CMP.has(lc)) { pop(); pop(); continue; }
    if (lc === 'dup') { const v = pop(); st.push(v, v); continue; }
    if (lc === 'drop') { pop(); continue; }
    if (lc === 'swap') { const a = pop(), b = pop(); st.push(a, b); continue; }
    if (lc === 'over') { const a = pop(), b = pop(); st.push(b, a, b); continue; }
    if (lc === 'clear') { st = []; continue; }
    // lógica booleana y el resto: no tocan la pila de enteros
  }
  return { writes, reads, shoots, vals, cw, cr, ai };
}

// Texto decompilado → genes (el core marca el fin de cada uno). Cada gen
// guarda sus líneas (para trasplantarlo) y sus tokens en orden plano.
function splitGenes(text) {
  const genes = [];
  let cur = { lines: [], tokens: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/Gene:\s+\d+\s+Ends/.test(line)) {
      // Un gen sin stop al final del ADN: el core pega su última línea con
      // el marcador ("*.out1'''''  Gene: 7 Ends…").
      const code = line.slice(0, line.indexOf("'")).trim();
      if (code) { cur.lines.push(code); cur.tokens.push(...code.split(/\s+/)); }
      genes.push(cur);
      cur = { lines: [], tokens: [] };
      continue;
    }
    if (!line || line[0] === "'") continue;
    cur.lines.push(line);
    cur.tokens.push(...line.split(/\s+/));
  }
  genes.push(cur);
  return genes.filter((g) => g.tokens.length);
}

function canonical(text) {
  return text.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && l[0] !== "'").join('\n');
}

// Nombre que el autor puso en la cabecera del .txt: de las dos primeras
// líneas de comentario, la que parezca un nombre ("'Saber",
// "'NAME :BETA-AA", "'sexbau by Botsareus ..."), no una frase ni un
// "Gene 1 ...".
function headerName(raw) {
  let author = '', lines = 0;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (!t.startsWith("'") || ++lines > 2) break;
    let s = t.replace(/^'+/, '').trim().replace(/^name\s*:\s*/i, '');
    const by = s.match(/\bby\s+([A-Za-z0-9_-]+)/i);
    if (by && !author) author = by[1];
    s = s.replace(/\s*\b(compiled\s+)?by\b.*$/i, '').replace(/\.txt$/i, '')
      .replace(/\s+bot$/i, '').replace(/[.,:;]+$/, '').trim();
    if (!s || /^gene?\b/i.test(s) || s.startsWith('#')) continue;
    const evo = s.match(/^evolved from (\w+)/i);
    if (evo) return { name: `Evolved ${evo[1][0].toUpperCase()}${evo[1].slice(1)}`, author };
    if (s.length <= 32 && s.split(/\s+/).length <= 4) return { name: s, author };
  }
  return { name: '', author };
}

// bots.json sale de los títulos del foro, y varios temas comparten título:
// el mismo bot publicado en varios sub-boards, versiones distintas con el
// mismo título, o adjuntos titulados "1". Las copias con ADN idéntico se
// quitan (queda la primera, en el orden de publish_bots.py); a las demás
// se les da un nombre sacado de su ADN.
function uniqueNames(index, out, genesOut) {
  const groups = new Map();
  for (const b of index) {
    if (!out[b.file]) continue;
    if (!groups.has(b.name)) groups.set(b.name, []);
    groups.get(b.name).push(b);
  }
  const drop = new Set();
  for (const [title, bs] of groups) {
    if (bs.length < 2) continue;
    const seen = new Set();
    const keep = bs.filter((b) => {
      const h = out[b.file].hash;
      if (seen.has(h)) { drop.add(b); return false; }
      seen.add(h);
      return true;
    });
    if (keep.length < 2) continue;
    const info = keep.map((b) => ({
      b, p: out[b.file],
      ...headerName(fs.readFileSync(path.join(BOTS, b.file), 'utf8')),
    }));
    const distinct = (f) => new Set(info.map(f)).size === info.length;
    const genes = (n) => `${n} gene${n === 1 ? '' : 's'}`;
    const arch = (p) => ARCHETYPES.find(([k]) => k === p.arch)[1];
    if (!/[A-Za-z]{2}/.test(title)) {
      // título sin nombre: el de la cabecera, o el arquetipo y sus genes
      for (const x of info) {
        x.b.name = x.name ||
          `${arch(x.p)} with ${genes(x.p.genes)}${x.author ? ` (${x.author})` : ''}`;
      }
      if (new Set(info.map((x) => x.b.name)).size < info.length) {
        for (const x of info) x.b.name += ` #${x.p.hash.slice(0, 4)}`;
      }
    } else {
      // título con nombre: se conserva y se le agrega lo que distingue al ADN
      const tags = [
        (x) => genes(x.p.genes),
        (x) => x.name,
        (x) => arch(x.p).toLowerCase(),
        (x) => `${x.p.tokens} tokens`,
      ].find((f) => info.every((x) => f(x)) && distinct(f)) ||
        ((x) => `DNA ${x.p.hash.slice(0, 6)}`);
      for (const x of info) x.b.name = `${title} · ${tags(x)}`;
    }
    for (const x of info) console.log(`  nombre: ${x.b.file} → ${x.b.name}`);
  }
  for (const b of drop) {
    console.log(`  copia con el mismo ADN, fuera: ${b.file}`);
    delete out[b.file];
    delete genesOut[b.file];
    fs.unlinkSync(path.join(BOTS, b.file));
    index.splice(index.indexOf(b), 1);
  }
  fs.writeFileSync(path.join(BOTS, 'bots.json'), JSON.stringify(index, null, 1) + '\n');
}

function profile(text, bot) {
  const genes = splitGenes(text);
  const all = new Set();
  const geneCapsList = [], geneData = [];
  let tokens = 0;
  for (const g of genes) {
    tokens += g.tokens.length;
    const { writes, reads, shoots, vals, cw, cr, ai } = scanGene(g.tokens);
    const c = geneCaps(writes, reads, shoots, vals);
    c.forEach((k) => all.add(k));
    geneCapsList.push(Object.keys(CAPS).filter((k) => c.has(k)));
    // Número de gen literal en .delgene/.mkvirus: en otro genoma apunta a
    // otro gen (el trasplante cambia la numeración).
    const gl = ['delgene', 'mkvirus'].some((k) => (vals.get(k) || []).length);
    const d = { t: g.lines.join('\n') };
    if (cw.size) d.w = [...cw].sort((a, b) => a - b);
    if (cr.size) d.r = [...cr].sort((a, b) => a - b);
    if (Object.keys(ai).length) d.ai = ai;
    if (gl) d.gl = 1;
    geneData.push(d);
  }
  const caps = Object.keys(CAPS).filter((k) => all.has(k));
  const arch = ARCHETYPES.find(([, , f]) => f(all, bot))[0];
  const size = genes.length <= 5 ? 'S' : genes.length <= 20 ? 'M' : genes.length <= 60 ? 'L' : 'XL';
  const hash = crypto.createHash('sha1').update(canonical(text)).digest('hex').slice(0, 16);
  return { hash, genes: genes.length, tokens, caps, arch, size, geneCaps: geneCapsList,
           geneData };
}

(async () => {
  const M = await createDbCore();
  const C = (n, r, a) => M.cwrap(n, r, a);
  const api = {
    create:      C('db_sim_create', 'number', []),
    destroy:     C('db_sim_destroy', null, ['number']),
    start:       C('db_sim_start', null, ['number', 'number']),
    setField:    C('db_sim_set_field', null, ['number', 'number', 'number']),
    addSpecies:  C('db_sim_add_species', 'number',
                   ['number', 'string', 'string', 'number', 'number', 'number', 'number', 'number']),
    seedSpecies: C('db_sim_seed_species', 'number', ['number', 'number', 'number']),
    botText:     C('db_sim_bot_text', 'number', ['number', 'number']),
    free:        C('db_free', null, ['number']),
  };

  // ADN tal como queda en el fundador sembrado ('' si el core no lo acepta).
  const coreText = (dna, name, veg) => {
    const sim = api.create();
    let text = '';
    try {
      api.setField(sim, 9237, 6928);
      api.start(sim, 42);
      const idx = api.addSpecies(sim, dna, name, veg ? 1 : 0, 0, 3000, 0x40FF40, 1);
      if (api.seedSpecies(sim, idx, 1) === 1) {
        const p = api.botText(sim, 1);
        if (p) { text = M.UTF8ToString(p); api.free(p); }
      }
    } catch (e) { /* queda sin texto */ }
    try { api.destroy(sim); } catch {}
    return text;
  };

  const index = JSON.parse(fs.readFileSync(path.join(BOTS, 'bots.json'), 'utf8'));
  const out = {}, genesOut = {};
  let bad = 0, roundBad = 0;
  for (const b of index) {
    const dna = fs.readFileSync(path.join(BOTS, b.file), 'utf8');
    const text = coreText(dna, b.name + '.txt', b.veg);
    if (!text) { bad++; console.log(`  ! sin ADN: ${b.file}`); continue; }
    const p = profile(text, b);
    // Ida y vuelta: los genes trasplantables, pegados de nuevo, tienen que
    // dar el mismo ADN en el core (si no, el Laboratorio no es confiable).
    const again = coreText(p.geneData.map((g) => g.t).join('\n'), b.name + '.txt', b.veg);
    if (canonical(again) !== canonical(text)) {
      roundBad++;
      console.log(`  ! ida y vuelta distinta: ${b.file}`);
    }
    genesOut[b.file] = p.geneData;
    delete p.geneData;
    out[b.file] = p;
  }
  console.log(`ida y vuelta de genes: ${index.length - bad - roundBad} idénticos, ${roundBad} distintos`);
  uniqueNames(index, out, genesOut);

  const counts = {};
  for (const p of Object.values(out)) for (const k of p.caps) counts[k] = (counts[k] || 0) + 1;
  const doc = {
    version: 1,
    generated: new Date().toISOString().slice(0, 10),
    caps: Object.fromEntries(Object.entries(CAPS).map(([k, [label, group, desc]]) =>
      [k, { label, group, desc }])),
    archetypes: Object.fromEntries(ARCHETYPES.map(([k, label]) => [k, label])),
    bots: out,
  };
  fs.writeFileSync(path.join(BOTS, 'profiles.json'), JSON.stringify(doc) + '\n');
  // Texto y memoria propia de cada gen: solo lo usa el Laboratorio de
  // híbridos, que lo carga al abrirse.
  fs.writeFileSync(path.join(BOTS, 'genes.json'),
                   JSON.stringify({
                     version: 1,
                     // direcciones de sysvar: el Laboratorio no remapea a ellas
                     sysAddrs: [...SV_BY_ADDR.keys()].sort((a, b) => a - b),
                     bots: genesOut,
                   }) + '\n');
  const archCount = {};
  for (const p of Object.values(out)) archCount[p.arch] = (archCount[p.arch] || 0) + 1;
  console.log(`perfiles: ${Object.keys(out).length} (sin ADN: ${bad})`);
  console.log('arquetipos:', archCount);
  console.log('capacidades:', counts);
})();
