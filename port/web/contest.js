'use strict';
// Partido F1 (capa host, fuera de la fidelidad): lanzar un contest en un
// paso (reglas de modo de juego, reinicio, siembra, censo y arranque) y el
// marcador del Contest_Form del original. E11: la ventana del Contest ya no
// existe; los torneos (league.js, tournament.js) lanzan cada partido desde
// aquí.
//
// El orden importa y aquí queda fijo: el worker atiende los mensajes en
// orden, así que reset → seed-species… → f1start → run llega tal cual.
//
// Usa globales de index.html (BESTIARY, PRESETS, log, escHtml, worker,
// cssToVbColor, setRunning) y de inventory.js / lab.js (invFetchDna,
// labDnaByName).

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
// La misma regla, explicada (bajo los valores del partido).
function contestRuleHint(n, wins) {
  const m = contestMinLength(n);
  return wins
    ? `The first species to win ${wins} rounds takes the match (the original's Maxrounds). ` +
      `Otherwise, from round ${n} on, whoever has ${contestWinsNeeded(n)}🏅 or more (√N + N/2).`
    : `Whoever reaches ${contestWinsNeeded(n)} wins or more takes it (more than √N + N/2, the original's rule). ` +
      (m > n ? `With ${n}, not even winning them all is enough: the match will run at least ${m} rounds.`
             : 'If nobody gets there, one more round is played.');
}

// ADN según el origen (lo usa la migración del roster del Contest viejo).
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
// Lanza excepción si algún ADN no se puede leer (antes de tocar la sim).
//   o = { nrg, rounds, wins, cap, capMode, newSeed }
// E11: el tope de ciclos es siempre el del host (cap + capMode, sirve para N
// especies); los topes del core para duelos (99 y 100) quedan en 0 y siguen
// en Sim options para el F1 manual del original.
async function contestLaunch(fighters, o) {
  // Todo el ADN antes de reiniciar: la sim nueva no espera a la red.
  const dnas = [];
  for (const r of fighters) dnas.push(await contestDna(r));
  contestSetOpt(91, 1);                                  // Modo F1
  contestSetOpt(97, o.rounds);
  contestSetOpt(98, o.wins || 0);                         // Maxrounds
  contestSetOpt(99, 0);
  contestSetOpt(100, 0);
  if (o.newSeed) document.getElementById('seed').value = Math.floor(Math.random() * 100000);
  worker.postMessage({ t: 'f1-cap', cycles: o.cap || 0, mode: o.capMode || 'pop' });
  quietF1Census = true;                                   // el censo va abajo
  document.getElementById('btn-reset').click();           // Reiniciar
  fighters.forEach((r, i) => worker.postMessage({
    t: 'seed-species',
    sp: { dna: dnas[i], name: r.name + '.txt', veg: false, qty: r.qty, nrg: o.nrg,
          color: cssToVbColor(r.color) },
  }));
  worker.postMessage({ t: 'f1start' });                   // FindSpecies
  setRunning(true);
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
