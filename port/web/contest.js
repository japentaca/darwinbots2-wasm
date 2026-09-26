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
  wins: 3,         // victorias que ganan el torneo (Maxrounds, id 98; 0 = sin tope)
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
// Con 3+ especies la regla estadística puede no cumplirse nunca (el mejor
// rara vez gana mucho más de la mitad): el tope de victorias Maxrounds del
// original (F1Mode.bas:352-359, se mira antes) sí termina siempre.
function contestRuleText(n, wins) {
  const need = contestWinsNeeded(n);
  if (!wins) return `Whoever reaches ${need}🏅 or more wins`;
  return wins <= need ? `First to ${wins}🏅 wins`
                      : `First to ${wins}🏅 wins, or ${need}🏅 by round ${n}`;
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
    log(`contest: at most ${CONTEST_MAX} species (as in the original)`);
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
    if (!b) throw new Error(`${r.name}: no longer in the Bestiary`);
    return invFetchDna(b);
  }
  if (r.src === 'hybrid') {
    const dna = await labDnaByName(r.file + '.txt');
    if (!dna) throw new Error(`${r.name}: hybrid "${r.file}" not found`);
    return dna;
  }
  if (r.src === 'preset') return PRESETS[r.file].dna;
  if (r.dna) return r.dna;                     // 'form': el ADN va en la lista
  throw new Error(`${r.name}: no DNA`);
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
//   o = { nrg, f1, rounds, wins, maxcyc, maxpop, cap, newSeed }
async function contestLaunch(fighters, o) {
  // Todo el ADN antes de reiniciar: la sim nueva no espera a la red.
  const dnas = [];
  for (const r of fighters) dnas.push(await contestDna(r));
  if (o.f1) applyF1Settings();
  contestSetOpt(91, 1);                                  // Modo F1
  contestSetOpt(97, o.rounds);
  contestSetOpt(98, o.wins || 0);                         // Maxrounds
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
    note.textContent = 'A contest needs at least 2 species.';
    note.className = 'ct-note warn';
    return;
  }
  note.textContent = 'Preparing…';
  note.className = 'ct-note';
  if (typeof channelStop === 'function') channelStop();   // un torneo a la vez
  contest.rounds = Math.max(1, parseInt($('ct-rounds').value, 10) || 5);
  contest.wins = Math.max(0, parseInt($('ct-wins').value, 10) || 0);
  try {
    await contestLaunch(fighters, {
      nrg: parseFloat($('ct-nrg').value) || 3000, f1: $('ct-f1').checked,
      rounds: contest.rounds, wins: contest.wins, newSeed: opts.newSeed,
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
      note.textContent = 'The census found no contenders: the contest did not start.';
      note.className = 'ct-note warn';
      contest.running = false;
      contestRender();
    } else {
      note.textContent = `${msg.n} species in the running.`;
      note.className = 'ct-note';
    }
  } else if (msg.t === 'f1-note') {
    note.textContent = msg.kind === 'single'
      ? 'Only one species left in the census: F1 mode was turned off.'
      : msg.kind === 'cap' ? 'Cycle cap reached: the round goes to the most numerous species.'
      : 'More than 2 species: the cycle cap and max population are turned off (as in the original).';
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
function contestBoardHtml(st, color, rounds, winner, wins) {
  const f1 = st.f1;
  const total = f1.sp.reduce((a, s) => a + s.pop, 0) || 1;
  const maxWins = Math.max(0, ...f1.sp.map((s) => s.wins));
  const round = Math.min(f1.contests + 1, f1.minrounds);
  const done = f1.over || winner;
  const extended = f1.minrounds > rounds;
  return `<div class="ct-round">${done ? 'Over' : `Round ${round} / ${f1.minrounds}`}` +
    ` · cycle ${st.cycle}${f1.restarts ? ` · restarts ${f1.restarts}` : ''}</div>` +
    (done ? '' : `<div class="ct-rule">${contestRuleText(f1.minrounds, wins)}` +
      (extended ? ` · extended from ${rounds} to ${f1.minrounds} rounds by statistical draw` : '') +
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
    (winner ? `<div class="ct-winner">🏆 <b>${escHtml(winner)}</b> wins</div>` : '');
}

// Marcador: se llama en cada frame con las stats del worker.
function contestOnStats(st) {
  if (typeof channelOnStats === 'function') channelOnStats(st);
  if (!contest.win || !contest.running || !st.f1) return;
  const rw = contestRoundWinner(contest.lastWins, st.f1);
  if (rw) contest.win.querySelector('#ct-note').textContent =
    `Round ${st.f1.contests} goes to ${rw}.`;
  contest.lastWins = st.f1.sp.map((s) => s.wins);
  contest.win.querySelector('#ct-board').innerHTML = contestBoardHtml(
    st, new Map(contest.roster.map((r) => [r.name, r.color])), contest.rounds,
    contest.winner, contest.wins);
}

// ---- Render -----------------------------------------------------------------
function contestRenderRoster() {
  const w = contest.win;
  const list = w.querySelector('#ct-roster');
  if (!contest.roster.length) {
    list.innerHTML = '<div class="ct-empty">Add at least 2 species from the sources below.</div>';
  } else {
    list.innerHTML = contest.roster.map((r, i) =>
      `<div class="ct-fighter" data-i="${i}">` +
      `<input type="color" class="ct-color" value="${r.color}" title="Color">` +
      `<span class="ct-name" title="${escHtml(r.name)}">${escHtml(r.name)}</span>` +
      `<span class="ct-src">${{ bestiary: 'Bestiary', hybrid: 'hybrid', preset: 'preset', form: 'form' }[r.src] || ''}</span>` +
      `<label>qty <input type="number" class="ct-qty" min="1" max="200" value="${r.qty}"></label>` +
      `<button class="ct-del" title="Remove">✕</button></div>`).join('');
  }
  const n = contest.roster.length;
  w.querySelector('#ct-count').textContent =
    `${n} species` + (n > 2 ? ' · no duel caps' : '');
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
    : '<div class="ct-empty">No results.</div>';
}

async function contestRenderHybrids() {
  const sel = contest.win.querySelector('#ct-hyb');
  let hs = [];
  try { hs = (await InvDB.all('hybrids')).filter((h) => !h.veg); } catch (e) { /* sin IndexedDB */ }
  sel.innerHTML = '<option value="">— hybrid —</option>' +
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
  const w = makeWindow('🏆 F1 Contest', Math.min(460, innerWidth - 40), 0,
                       () => { contest.win = null; });
  contest.win = w;
  w.classList.add('ct-win');
  w.style.left = Math.max(20, innerWidth - 520) + 'px';
  w.style.top = '50px';
  w.body.innerHTML =
    '<div id="ct-setup">' +
    '<div class="ct-h">Contenders <span id="ct-count"></span></div>' +
    '<div id="ct-roster"></div>' +
    '<div class="ct-h">Add</div>' +
    '<input type="search" id="ct-q" placeholder="search the Bestiary…">' +
    '<div id="ct-results"></div>' +
    '<div class="ct-srcrow">' +
    '<select id="ct-hyb"></select>' +
    '<button id="ct-addsel" title="The bots selected in the Inventory (non-vegetables)">📚 Inventory selection</button>' +
    '<button id="ct-addform" title="The DNA and name from the Seed species panel">DNA from the form</button>' +
    '<button id="ct-addanimal">Animal Minimalis</button>' +
    '</div>' +
    '<div class="ct-h">Rules</div>' +
    '<div class="ct-rules">' +
    '<label>Minimum rounds</label><input type="number" id="ct-rounds" min="1" value="5">' +
    '<label title="Maxrounds of the original: the first species to reach this many round wins takes the tournament">Wins to take it (0 = no cap)</label><input type="number" id="ct-wins" min="0" value="3">' +
    '<div id="ct-rhint" class="ct-wide ct-rule"></div>' +
    '<label>Starting energy</label><input type="number" id="ct-nrg" min="1" value="3000">' +
    '<label class="ct-wide"><input type="checkbox" id="ct-f1" checked> Use F1 league settings (costs, 9237×6928 field, physics)</label>' +
    '<div id="ct-duel" class="ct-wide ct-rules" hidden>' +
    '<label title="Duels only (2 species), as in the original">Cycle cap per round (0 = no cap)</label><input type="number" id="ct-maxcyc" min="0" value="0">' +
    '<label title="Duels only (2 species), as in the original">Max population per species (0 = no cap)</label><input type="number" id="ct-maxpop" min="0" value="0">' +
    '</div></div>' +
    '<button id="ct-go" class="primary ct-go">🏆 Start!</button>' +
    '</div>' +
    '<div id="ct-live" hidden>' +
    '<div id="ct-board"><div class="ct-empty">Waiting for the census…</div></div>' +
    '<div class="ct-liverow">' +
    '<button id="ct-again" class="primary" hidden title="Same species and rules, new seed">🔁 Rematch</button>' +
    '<button id="ct-edit" title="Back to setup (the sim keeps running)">✎ Change contenders</button>' +
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
      $('ct-note').textContent = 'No (non-vegetable) bots are selected in the Inventory.';
      return;
    }
    for (const it of picked) contestAdd({ name: it.b.name, src: 'bestiary', file: it.b.file });
  };
  $('ct-addform').onclick = () => {
    const dna = document.getElementById('dna').value;
    if (!dna.trim()) { $('ct-note').textContent = 'The form has no DNA.'; return; }
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
    const wins = Math.max(0, parseInt($('ct-wins').value, 10) || 0);
    $('ct-rhint').textContent = wins
      ? `The first species to win ${wins} rounds takes it (the original's Maxrounds). ` +
        `Otherwise, from round ${n} on, whoever has ${contestWinsNeeded(n)}🏅 or more (√N + N/2).`
      :
      `Whoever reaches ${contestWinsNeeded(n)} wins or more takes it (more than √N + N/2, the original's rule). ` +
      (m > n ? `With ${n}, not even winning them all is enough: the tournament will run at least ${m} rounds.`
             : 'If nobody gets there, one more round is played.');
  };
  $('ct-rounds').oninput = rhint;
  $('ct-wins').oninput = rhint;
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
