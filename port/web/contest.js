'use strict';
// Contest F1 (capa host, fuera de la fidelidad). Ventana que junta en un solo
// lugar lo que el torneo necesita y hoy está repartido por la página: elegir
// contrincantes, aplicar los ajustes de liga (btnSetF1), encender el modo F1,
// reiniciar, sembrar, hacer el censo (FindSpecies) y arrancar. Después hace
// de marcador (el Contest_Form del original): población, victorias, ronda y
// ganador, con "Revancha".
//
// El orden importa y aquí queda fijo: el worker atiende los mensajes en
// orden, así que reset → seed-species… → f1start → run llega tal cual.
//
// Usa globales de index.html (BESTIARY, PRESETS, makeWindow, winLayer, log,
// escHtml, worker, cssToVbColor, setRunning, applyF1Settings) y de
// inventory.js / lab.js (inv, invLoad, invFetchDna, invColor, labDnaByName).

const contest = {
  win: null,
  roster: [],      // {name, src, file?, dna?, color, qty}
  running: false,  // hay un contest lanzado desde esta ventana
  rounds: 5,       // rondas mínimas pedidas (el original puede alargarlas)
  lastWins: null,  // victorias del frame anterior (para anunciar la ronda)
  winner: '',
};
const CONTEST_MAX = 20;          // PopArray(1 To 20), F1Mode.bas:59
const CONTEST_KEY = 'db-contest-roster';

// Regla del original (F1Mode.bas:361-426): con MinRounds = N, gana quien
// tenga MÁS de √N + N/2 victorias; si nadie llega, "Statistical Draw.
// Extending contest." y N sube en 1. Victorias necesarias con N rondas:
const contestWinsNeeded = (n) => Math.floor(Math.sqrt(n) + n / 2) + 1;
// Rondas que dura como mínimo (ganando una especie todas): el primer n ≥ N
// en el que n victorias alcanzan.
function contestMinLength(n) {
  while (contestWinsNeeded(n) > n) n++;
  return n;
}

function contestSaveRoster() {
  try {
    localStorage.setItem(CONTEST_KEY, JSON.stringify(contest.roster.map(
      ({ name, src, file, color, qty }) => ({ name, src, file, color, qty }))));
  } catch (e) { /* sin almacenamiento: la lista no se recuerda */ }
}
function contestLoadRoster() {
  try {
    const r = JSON.parse(localStorage.getItem(CONTEST_KEY) || '[]');
    if (Array.isArray(r)) contest.roster = r.filter((x) => x && x.name).slice(0, CONTEST_MAX);
  } catch (e) { contest.roster = []; }
}

// El censo agrupa por nombre de archivo sin ".txt": dos contrincantes con el
// mismo nombre serían una sola especie. Se desambigua con un sufijo.
function contestUniqueName(name) {
  const taken = new Set(contest.roster.map((r) => r.name));
  if (!taken.has(name)) return name;
  for (let k = 2; ; k++) if (!taken.has(`${name} ${k}`)) return `${name} ${k}`;
}

function contestAdd(entry) {
  if (contest.roster.length >= CONTEST_MAX) {
    log(`contest: máximo ${CONTEST_MAX} especies (como el original)`);
    return;
  }
  contest.roster.push({ qty: 5, color: invColor(), ...entry,
                        name: contestUniqueName(entry.name) });
  contestSaveRoster();
  contestRender();
}

// ADN de cada contrincante según su origen.
async function contestDna(r) {
  if (r.src === 'bestiary') {
    const b = BESTIARY.find((x) => x.file === r.file);
    if (!b) throw new Error(`${r.name}: ya no está en el Bestiary`);
    return invFetchDna(b);
  }
  if (r.src === 'hybrid') {
    const dna = await labDnaByName(r.file + '.txt');
    if (!dna) throw new Error(`${r.name}: no encuentro el híbrido "${r.file}"`);
    return dna;
  }
  if (r.src === 'preset') return PRESETS[r.file].dna;
  if (r.dna) return r.dna;                     // 'form': el ADN va en la lista
  throw new Error(`${r.name}: sin ADN`);
}

// ---- Arranque -----------------------------------------------------------------
function contestSetOpt(id, v) {
  const el = document.getElementById('o-' + id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  el.dispatchEvent(new Event('change'));
}

// Lanza un contest con estos luchadores ({name, color, qty, src, file|dna}).
// Lo usan la ventana de contest y el Canal (channel.js). Lanza excepción si
// algún ADN no se puede leer (antes de tocar la sim).
//   o = { nrg, f1, rounds, maxcyc, maxpop, cap, newSeed }
async function contestLaunch(fighters, o) {
  // Todo el ADN antes de reiniciar: la sim nueva no espera a la red.
  const dnas = [];
  for (const r of fighters) dnas.push(await contestDna(r));
  if (o.f1) applyF1Settings();
  contestSetOpt(91, 1);                                  // Modo F1
  contestSetOpt(97, o.rounds);
  const duel = fighters.length === 2;
  contestSetOpt(99, duel ? o.maxcyc || 0 : 0);
  contestSetOpt(100, duel ? o.maxpop || 0 : 0);
  if (o.newSeed) document.getElementById('seed').value = Math.floor(Math.random() * 100000);
  worker.postMessage({ t: 'f1-cap', cycles: o.cap || 0 });
  document.getElementById('btn-reset').click();           // Reiniciar
  fighters.forEach((r, i) => worker.postMessage({
    t: 'seed-species',
    sp: { dna: dnas[i], name: r.name + '.txt', veg: false, qty: r.qty, nrg: o.nrg,
          color: cssToVbColor(r.color) },
  }));
  worker.postMessage({ t: 'f1start' });                   // FindSpecies
  setRunning(true);
}

async function contestStart(opts = {}) {
  const w = contest.win;
  const $ = (id) => w.querySelector('#' + id);
  const note = $('ct-note');
  const fighters = contest.roster.filter((r) => r.qty > 0);
  if (fighters.length < 2) {
    note.textContent = 'Hacen falta al menos 2 especies para un contest.';
    note.className = 'ct-note warn';
    return;
  }
  note.textContent = 'Preparando…';
  note.className = 'ct-note';
  if (typeof channelStop === 'function') channelStop();   // un torneo a la vez
  contest.rounds = Math.max(1, parseInt($('ct-rounds').value, 10) || 5);
  try {
    await contestLaunch(fighters, {
      nrg: parseFloat($('ct-nrg').value) || 3000, f1: $('ct-f1').checked,
      rounds: contest.rounds, newSeed: opts.newSeed,
      maxcyc: parseInt($('ct-maxcyc').value, 10) || 0,
      maxpop: parseInt($('ct-maxpop').value, 10) || 0,
    });
  } catch (e) {
    note.textContent = e.message;
    note.className = 'ct-note warn';
    return;
  }
  contest.running = true;
  contest.lastWins = null;
  contest.winner = '';
  contestRender();
  log(`🏆 contest: ${fighters.map((r) => r.name).join(' vs ')}`);
}

// ---- Mensajes del worker (los reenvía index.html) ----------------------------
function contestOnMessage(msg) {
  if (typeof channelOnMessage === 'function') channelOnMessage(msg);
  if (!contest.win || !contest.running) return;
  const note = contest.win.querySelector('#ct-note');
  if (msg.t === 'f1-started') {
    if (!msg.n) {
      note.textContent = 'El censo no encontró contrincantes: el contest no arrancó.';
      note.className = 'ct-note warn';
      contest.running = false;
      contestRender();
    } else {
      note.textContent = `${msg.n} especies en liza.`;
      note.className = 'ct-note';
    }
  } else if (msg.t === 'f1-note') {
    note.textContent = msg.kind === 'single'
      ? 'Solo quedó una especie en el censo: el modo F1 se desactivó.'
      : msg.kind === 'cap' ? 'Tope de ciclos: la ronda es para la especie más numerosa.'
      : 'Más de 2 especies: el tope de ciclos y la población máxima se desactivan (como en el original).';
    note.className = 'ct-note warn';
    if (msg.kind === 'single') { contest.running = false; contestRender(); }
  } else if (msg.t === 'f1-over') {
    contest.winner = msg.winner;
    contestRender();
  }
}

// Nombre de quien sumó una victoria entre dos frames (o '').
function contestRoundWinner(prev, f1) {
  if (!prev) return '';
  const s = f1.sp.find((x, i) => x.wins > (prev[i] || 0));
  return s ? s.name : '';
}

// HTML del marcador (Contest_Form del original) para las stats de un frame.
// color: Map nombre → css; rounds: rondas mínimas pedidas; winner: '' o
// ganador del contest.
function contestBoardHtml(st, color, rounds, winner) {
  const f1 = st.f1;
  const total = f1.sp.reduce((a, s) => a + s.pop, 0) || 1;
  const maxWins = Math.max(0, ...f1.sp.map((s) => s.wins));
  const round = Math.min(f1.contests + 1, f1.minrounds);
  const done = f1.over || winner;
  const extended = f1.minrounds > rounds;
  return `<div class="ct-round">${done ? 'Terminado' : `Ronda ${round} / ${f1.minrounds}`}` +
    ` · ciclo ${st.cycle}${f1.restarts ? ` · restarts ${f1.restarts}` : ''}</div>` +
    (done ? '' : `<div class="ct-rule">Gana quien sume ${contestWinsNeeded(f1.minrounds)}🏅 o más` +
      (extended ? ` · alargado de ${rounds} a ${f1.minrounds} rondas por empate estadístico` : '') +
      '</div>') +
    f1.sp.map((s) => {
      const c = color.get(s.name) || '#8899bb';
      const pct = Math.round((s.pop / total) * 100);
      const lead = s.wins > 0 && s.wins === maxWins;
      return `<div class="ct-row${s.pop ? '' : ' out'}">` +
        `<span class="ct-dot" style="background:${c}"></span>` +
        `<span class="ct-name" title="${escHtml(s.name)}">${escHtml(s.name)}</span>` +
        `<span class="ct-bar"><span style="width:${pct}%;background:${c}"></span></span>` +
        `<span class="ct-pop">${s.pop}🤖</span>` +
        `<span class="ct-wins${lead ? ' lead' : ''}">${s.wins}🏅</span></div>`;
    }).join('') +
    (winner ? `<div class="ct-winner">🏆 Gana <b>${escHtml(winner)}</b></div>` : '');
}

// Marcador: se llama en cada frame con las stats del worker.
function contestOnStats(st) {
  if (typeof channelOnStats === 'function') channelOnStats(st);
  if (!contest.win || !contest.running || !st.f1) return;
  const rw = contestRoundWinner(contest.lastWins, st.f1);
  if (rw) contest.win.querySelector('#ct-note').textContent =
    `Ronda ${st.f1.contests} para ${rw}.`;
  contest.lastWins = st.f1.sp.map((s) => s.wins);
  contest.win.querySelector('#ct-board').innerHTML = contestBoardHtml(
    st, new Map(contest.roster.map((r) => [r.name, r.color])), contest.rounds,
    contest.winner);
}

// ---- Render -----------------------------------------------------------------
function contestRenderRoster() {
  const w = contest.win;
  const list = w.querySelector('#ct-roster');
  if (!contest.roster.length) {
    list.innerHTML = '<div class="ct-empty">Agrega al menos 2 especies desde las fuentes de abajo.</div>';
  } else {
    list.innerHTML = contest.roster.map((r, i) =>
      `<div class="ct-fighter" data-i="${i}">` +
      `<input type="color" class="ct-color" value="${r.color}" title="Color">` +
      `<span class="ct-name" title="${escHtml(r.name)}">${escHtml(r.name)}</span>` +
      `<span class="ct-src">${{ bestiary: 'Bestiary', hybrid: 'híbrido', preset: 'preset', form: 'formulario' }[r.src] || ''}</span>` +
      `<label>nº <input type="number" class="ct-qty" min="1" max="200" value="${r.qty}"></label>` +
      `<button class="ct-del" title="Quitar">✕</button></div>`).join('');
  }
  const n = contest.roster.length;
  w.querySelector('#ct-count').textContent =
    `${n} especie${n === 1 ? '' : 's'}` + (n > 2 ? ' · sin topes de duelo' : '');
  w.querySelector('#ct-duel').hidden = n !== 2;
  w.querySelector('#ct-go').disabled = n < 2;
}

function contestRenderSearch() {
  const w = contest.win;
  const q = w.querySelector('#ct-q').value.trim().toLowerCase();
  const res = w.querySelector('#ct-results');
  const hits = BESTIARY.filter((b) => !b.veg &&
    (!q || b.name.toLowerCase().includes(q))).slice(0, 40);
  res.innerHTML = hits.length
    ? hits.map((b) => `<button class="ct-hit" data-file="${escHtml(b.file)}" ` +
        `title="${escHtml(b.board || '')}">+ ${escHtml(b.name)}</button>`).join('')
    : '<div class="ct-empty">Sin resultados.</div>';
}

async function contestRenderHybrids() {
  const sel = contest.win.querySelector('#ct-hyb');
  let hs = [];
  try { hs = (await InvDB.all('hybrids')).filter((h) => !h.veg); } catch (e) { /* sin IndexedDB */ }
  sel.innerHTML = '<option value="">— híbrido —</option>' +
    hs.map((h) => `<option>${escHtml(h.name)}</option>`).join('');
  sel.disabled = !hs.length;
}

function contestRender() {
  if (!contest.win) return;
  const w = contest.win;
  const live = contest.running;
  w.querySelector('#ct-setup').hidden = live;
  w.querySelector('#ct-live').hidden = !live;
  if (!live) contestRenderRoster();
  w.querySelector('#ct-again').hidden = !contest.winner;
}

// ---- Ventana --------------------------------------------------------------
async function openContest() {
  if (contest.win) { winLayer.appendChild(contest.win); return; }   // al frente
  if (!contest.roster.length) contestLoadRoster();
  const w = makeWindow('🏆 Contest F1', Math.min(460, innerWidth - 40), 0,
                       () => { contest.win = null; });
  contest.win = w;
  w.classList.add('ct-win');
  w.style.left = Math.max(20, innerWidth - 520) + 'px';
  w.style.top = '50px';
  w.body.innerHTML =
    '<div id="ct-setup">' +
    '<div class="ct-h">Contrincantes <span id="ct-count"></span></div>' +
    '<div id="ct-roster"></div>' +
    '<div class="ct-h">Agregar</div>' +
    '<input type="search" id="ct-q" placeholder="buscar en el Bestiary…">' +
    '<div id="ct-results"></div>' +
    '<div class="ct-srcrow">' +
    '<select id="ct-hyb"></select>' +
    '<button id="ct-addsel" title="Los bots seleccionados en el Inventario (no vegetales)">📚 Selección del Inventario</button>' +
    '<button id="ct-addform" title="El ADN y el nombre del panel Sembrar especie">ADN del formulario</button>' +
    '<button id="ct-addanimal">Animal Minimalis</button>' +
    '</div>' +
    '<div class="ct-h">Reglas</div>' +
    '<div class="ct-rules">' +
    '<label>Rondas mínimas</label><input type="number" id="ct-rounds" min="1" value="5">' +
    '<div id="ct-rhint" class="ct-wide ct-rule"></div>' +
    '<label>Energía inicial</label><input type="number" id="ct-nrg" min="1" value="3000">' +
    '<label class="ct-wide"><input type="checkbox" id="ct-f1" checked> Usar ajustes de liga F1 (costes, campo 9237×6928, física)</label>' +
    '<div id="ct-duel" class="ct-wide ct-rules" hidden>' +
    '<label title="Solo en duelos (2 especies), como el original">Tope de ciclos por ronda (0 = sin tope)</label><input type="number" id="ct-maxcyc" min="0" value="0">' +
    '<label title="Solo en duelos (2 especies), como el original">Población máx por especie (0 = sin tope)</label><input type="number" id="ct-maxpop" min="0" value="0">' +
    '</div></div>' +
    '<button id="ct-go" class="primary ct-go">🏆 ¡Empezar!</button>' +
    '</div>' +
    '<div id="ct-live" hidden>' +
    '<div id="ct-board"><div class="ct-empty">Esperando el censo…</div></div>' +
    '<div class="ct-liverow">' +
    '<button id="ct-again" class="primary" hidden title="Mismas especies y reglas, semilla nueva">🔁 Revancha</button>' +
    '<button id="ct-edit" title="Volver a la preparación (la sim sigue)">✎ Cambiar contrincantes</button>' +
    '</div></div>' +
    '<div id="ct-note" class="ct-note"></div>';

  const $ = (id) => w.querySelector('#' + id);
  let qT = 0;
  $('ct-q').oninput = () => { clearTimeout(qT); qT = setTimeout(contestRenderSearch, 120); };
  $('ct-results').onclick = (e) => {
    const b = e.target.closest('[data-file]');
    if (!b) return;
    const it = BESTIARY.find((x) => x.file === b.dataset.file);
    if (it) contestAdd({ name: it.name, src: 'bestiary', file: it.file });
  };
  $('ct-hyb').onchange = (e) => {
    const name = e.target.value;
    if (name) contestAdd({ name, src: 'hybrid', file: name });
    e.target.value = '';
  };
  $('ct-addsel').onclick = async () => {
    if (!inv.items.length) await invLoad();
    const picked = [...inv.sel].map((k) => inv.byKey.get(k)).filter((it) => it && !it.b.veg);
    if (!picked.length) {
      $('ct-note').textContent = 'No hay bots (no vegetales) seleccionados en el Inventario.';
      return;
    }
    for (const it of picked) contestAdd({ name: it.b.name, src: 'bestiary', file: it.b.file });
  };
  $('ct-addform').onclick = () => {
    const dna = document.getElementById('dna').value;
    if (!dna.trim()) { $('ct-note').textContent = 'El formulario no tiene ADN.'; return; }
    const name = (document.getElementById('sp-name').value || 'bot.txt').replace(/\.txt$/i, '');
    contestAdd({ name, src: 'form', dna });
  };
  $('ct-addanimal').onclick = () =>
    contestAdd({ name: 'Animal_Minimalis', src: 'preset', file: 'animal' });
  $('ct-roster').addEventListener('input', (e) => {
    const row = e.target.closest('[data-i]');
    if (!row) return;
    const r = contest.roster[+row.dataset.i];
    if (e.target.classList.contains('ct-qty')) r.qty = Math.max(1, parseInt(e.target.value, 10) || 1);
    if (e.target.classList.contains('ct-color')) r.color = e.target.value;
    contestSaveRoster();
  });
  $('ct-roster').onclick = (e) => {
    if (!e.target.classList.contains('ct-del')) return;
    contest.roster.splice(+e.target.closest('[data-i]').dataset.i, 1);
    contestSaveRoster();
    contestRender();
  };
  const rhint = () => {
    const n = Math.max(1, parseInt($('ct-rounds').value, 10) || 1);
    const m = contestMinLength(n);
    $('ct-rhint').textContent =
      `Gana quien sume ${contestWinsNeeded(n)} victorias o más (más de √N + N/2, regla del original). ` +
      (m > n ? `Con ${n} ni ganándolas todas alcanza: el torneo se alargará al menos a ${m} rondas.`
             : 'Si nadie llega, se juega una ronda más.');
  };
  $('ct-rounds').oninput = rhint;
  rhint();
  $('ct-go').onclick = () => contestStart();
  $('ct-again').onclick = () => contestStart({ newSeed: true });
  $('ct-edit').onclick = () => {
    contest.running = false;
    $('ct-note').textContent = '';
    contestRender();
  };

  contestRenderSearch();
  contestRenderHybrids();
  contestRender();
}
