'use strict';
// Canal F1 (capa host, fuera de la fidelidad): contests encadenados, como un
// canal de televisión. Formato "rey de la colina": el ganador se queda y
// recibe retadores sorteados del Inventario; con R victorias seguidas se
// retira invicto y la pelea siguiente es toda nueva. Cada ronda tiene tope
// de ciclos (worker: f1CapCheck / db_sim_f1_cap): al pasarlo, la ronda es
// para la especie más numerosa, así ninguna pelea queda colgada.
//
// Reusa contest.js (contestLaunch, contestBoardHtml, contestRoundWinner) y
// del Inventario el pool filtrable (favoritos, tag, selección guardada).
// El Salón de la fama vive en localStorage (conveniencia por navegador).

const ch = {
  win: null,
  on: false,
  phase: 'idle',       // 'idle' | 'break' | 'fight'
  fighters: [],        // luchadores de la pelea en curso
  champ: null,         // {name, file, color}
  streak: 0,
  fightNo: 0,
  lastWins: null,
  winner: '',
  timer: 0,
  breakEnd: 0,
  cfg: null,           // config leída al encender
  recent: [],          // últimas peleas: {no, names[], winner, note}
  hof: {},             // nombre → {name, file, fights, wins, titles, best}
  fails: 0,            // lanzamientos fallidos seguidos
};
// Colores fijos de los luchadores, claros para el campo oscuro y ordenados
// para que los primeros sean los más distintos entre sí (las peleas chicas
// solo usan el principio). Hasta 20, el máximo de especies por pelea.
const CH_COLORS = [
  '#ff4040', '#3d9bff', '#ffd83a', '#ff5ce1', '#3fe8e0', '#ff9020', '#a46bff',
  '#8ce83c', '#ffffff', '#ff9eb0', '#1fbf7a', '#c79a62', '#b8c8ff', '#f0ff80',
  '#8a8aff', '#ffc6f0', '#e05a2a', '#7fd8ff', '#b0b0b0', '#c0ffc8',
];
const CH_HOF_KEY = 'db-channel-hof';
const CH_CFG_KEY = 'db-channel-cfg';

function chLoad() {
  try { ch.hof = JSON.parse(localStorage.getItem(CH_HOF_KEY) || '{}') || {}; } catch (e) { ch.hof = {}; }
}
function chSaveHof() {
  try { localStorage.setItem(CH_HOF_KEY, JSON.stringify(ch.hof)); } catch (e) { /* sin almacenamiento */ }
}
function chHofRec(f) {
  return ch.hof[f.name] || (ch.hof[f.name] = { name: f.name, file: f.file, fights: 0,
                                                wins: 0, titles: 0, best: 0 });
}

// ---- Pool del sorteo ----------------------------------------------------------
function chPool(filter) {
  let items = inv.items.filter((it) => !it.b.veg);
  if (filter === 'fav') items = items.filter((it) => userRec(it.key).fav);
  else if (filter.startsWith('tag:')) {
    const t = filter.slice(4);
    items = items.filter((it) => userRec(it.key).tags.includes(t));
  } else if (filter.startsWith('set:')) {
    const set = inv.sets.get(filter.slice(4));
    const keys = new Set(set ? set.keys : []);
    items = items.filter((it) => keys.has(it.key));
  }
  // Un nombre por especie: el censo agrupa por nombre.
  const seen = new Set();
  return items.filter((it) => !seen.has(it.b.name) && seen.add(it.b.name));
}

function chSample(list, k) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

// ---- Programación -------------------------------------------------------------
function chNote(text, warn) {
  if (!ch.win) return;
  const n = ch.win.querySelector('#ch-note');
  n.textContent = text;
  n.className = 'ct-note' + (warn ? ' warn' : '');
}

// Arma la pelea siguiente y abre la cortinilla.
function chNext() {
  clearTimeout(ch.timer);
  if (!ch.on) return;
  const c = ch.cfg;
  const pool = chPool(c.pool).filter((it) => !ch.champ || it.b.name !== ch.champ.name);
  const need = ch.champ ? c.k - 1 : c.k;
  if (pool.length < need) {
    chNote(`The draw pool has ${pool.length} beasts and ${need} are needed: widen the filter.`, true);
    channelStop();
    return;
  }
  // el campeón conserva su color; los retadores toman los siguientes libres
  const free = CH_COLORS.filter((col) => !ch.champ || col !== ch.champ.color);
  const picked = chSample(pool, need).map((it, i) => ({
    name: it.b.name, src: 'bestiary', file: it.b.file, qty: c.qty, color: free[i],
  }));
  ch.fighters = ch.champ ? [{ ...ch.champ, src: 'bestiary', qty: c.qty }, ...picked] : picked;
  ch.fightNo++;
  ch.phase = 'break';
  ch.breakEnd = performance.now() + c.pause * 1000;
  chRender();
  chTick();
}

// Cuenta atrás de la cortinilla (y refresco del rótulo).
function chTick() {
  if (!ch.on || ch.phase !== 'break') return;
  const left = Math.ceil((ch.breakEnd - performance.now()) / 1000);
  if (left <= 0) { chLaunch(); return; }
  chRenderBreak(left);
  ch.timer = setTimeout(chTick, 250);
}

async function chLaunch() {
  const c = ch.cfg;
  ch.phase = 'fight';
  ch.lastWins = null;
  ch.winner = '';
  contest.running = false;                 // un torneo a la vez
  if (typeof contestRender === 'function') contestRender();
  try {
    // Ajustes F1 solo en la primera pelea: después ya están en el panel.
    await contestLaunch(ch.fighters, { nrg: c.nrg, f1: c.f1 && !ch.f1Applied,
                                       rounds: c.rounds, wins: c.wins, cap: c.cap,
                                       newSeed: true });
    ch.f1Applied = true;
    ch.fails = 0;
  } catch (e) {
    // Bot ilegible: se anula la pelea y se sortea otra.
    ch.recent.unshift({ no: ch.fightNo, names: ch.fighters.map((f) => f.name),
                        winner: '', note: 'void: ' + e.message });
    if (++ch.fails > 5) { chNote('Too many unreadable bots in a row: channel off.', true); channelStop(); return; }
    chNext();
    return;
  }
  log(`📺 fight #${ch.fightNo}: ${ch.fighters.map((f) => f.name).join(' vs ')}`);
  chRender();
}

// Resultado de una pelea: campeón, racha, retiro y Salón de la fama.
function chResult(winner, note) {
  if (ch.phase !== 'fight') return;
  ch.phase = 'idle';
  ch.winner = winner;
  const r = { no: ch.fightNo, names: ch.fighters.map((f) => f.name), winner, note: note || '' };
  if (winner) {
    for (const f of ch.fighters) chHofRec(f).fights++;
    const wf = ch.fighters.find((f) => f.name === winner);
    const rec = chHofRec(wf || { name: winner, file: '' });
    rec.wins++;
    if (ch.champ && ch.champ.name === winner) ch.streak++;
    else { ch.champ = wf ? { name: wf.name, file: wf.file, color: wf.color } : null; ch.streak = 1; }
    rec.best = Math.max(rec.best, ch.streak);
    if (ch.streak >= ch.cfg.retire) {
      rec.titles++;
      r.note = `👑 retires undefeated after ${ch.streak} wins`;
      log(`📺 ${winner} retires undefeated (${ch.streak} wins in a row)`);
      ch.champ = null;
      ch.streak = 0;
    }
    chSaveHof();
  }
  ch.recent.unshift(r);
  ch.recent.length = Math.min(ch.recent.length, 12);
  chRender();
  if (ch.on) ch.timer = setTimeout(chNext, 1500);   // un respiro para ver el marcador
}

// ---- Mensajes y frames (los reenvía contest.js) --------------------------------
function channelOnMessage(msg) {
  if (!ch.on || ch.phase !== 'fight') return;
  if (msg.t === 'f1-started' && !msg.n) chResult('', 'void: the census found no fighters');
  else if (msg.t === 'f1-note' && msg.kind === 'single') chResult('', 'void: only one species in the census');
  else if (msg.t === 'f1-note' && msg.kind === 'cap') chNote('Cycle cap reached: the round goes to the most numerous species.');
  else if (msg.t === 'f1-over') chResult(msg.winner);
}

function channelOnStats(st) {
  if (!ch.on || ch.phase !== 'fight' || !st.f1) return;
  const rw = contestRoundWinner(ch.lastWins, st.f1);
  if (rw) chNote(`Round ${st.f1.contests} goes to ${rw}.`);
  ch.lastWins = st.f1.sp.map((s) => s.wins);
  const color = new Map(ch.fighters.map((f) => [f.name, f.color]));
  if (ch.win) ch.win.querySelector('#ch-board').innerHTML =
    contestBoardHtml(st, color, ch.cfg.rounds, ch.winner, ch.cfg.wins);
  chOverlay(st);
}

// ---- Encender / apagar -------------------------------------------------------
function chReadCfg() {
  const $ = (id) => ch.win.querySelector('#' + id);
  const int = (id, lo, hi, d) => Math.min(hi, Math.max(lo, parseInt($(id).value, 10) || d));
  return {
    k: int('ch-k', 2, 20, 2), rounds: int('ch-rounds', 1, 99, 5),
    wins: Math.min(99, Math.max(0, parseInt($('ch-wins').value, 10) || 0)),
    retire: int('ch-retire', 1, 999, 5), cap: int('ch-cap', 100, 1e6, 5000),
    qty: int('ch-qty', 1, 200, 5), nrg: int('ch-nrg', 1, 1e6, 3000),
    pause: int('ch-pause', 0, 60, 5), f1: $('ch-f1').checked, pool: $('ch-pool').value,
  };
}

async function channelStart() {
  if (!inv.items.length) await invLoad();
  ch.cfg = chReadCfg();
  try { localStorage.setItem(CH_CFG_KEY, JSON.stringify(ch.cfg)); } catch (e) { /* nada */ }
  ch.on = true;
  ch.champ = null;
  ch.streak = 0;
  ch.fails = 0;
  ch.f1Applied = false;
  chNote('');
  chNext();
}

function channelStop() {
  if (!ch.on) return;
  ch.on = false;
  ch.phase = 'idle';
  clearTimeout(ch.timer);
  worker.postMessage({ t: 'f1-cap', cycles: 0 });
  chRender();
}

// ---- Render -------------------------------------------------------------------
function chOverlay(st) {
  const el = document.getElementById('ch-overlay');
  if (!el) return;
  if (!ch.on) { el.hidden = true; return; }
  el.hidden = false;
  const vs = ch.fighters.map((f) =>
    `<span style="color:${f.color}">${escHtml(f.name)}</span>`).join(' <i>vs</i> ');
  const champ = ch.champ
    ? ` · 👑 ${escHtml(ch.champ.name)} <b>${ch.streak}/${ch.cfg.retire}</b>` : '';
  if (ch.phase === 'break') {
    el.innerHTML = `<div class="ch-live">📺 NEXT FIGHT · #${ch.fightNo}</div><div class="ch-vs">${vs}</div>`;
  } else {
    const f1 = st && st.f1;
    const round = f1 ? ` · round ${Math.min(f1.contests + 1, f1.minrounds)}/${f1.minrounds}` : '';
    el.innerHTML = `<div class="ch-live"><span class="ch-dot"></span>LIVE · fight #${ch.fightNo}${round}${champ}</div>` +
      `<div class="ch-vs">${vs}</div>` +
      (ch.winner ? `<div class="ch-win">🏆 ${escHtml(ch.winner)}</div>` : '');
  }
}

function chRenderBreak(left) {
  if (!ch.win) { chOverlay(); return; }
  ch.win.querySelector('#ch-board').innerHTML =
    `<div class="ch-next">Next fight #${ch.fightNo} in <b>${left}</b>…</div>` +
    ch.fighters.map((f) => `<div class="ct-row"><span class="ct-dot" style="background:${f.color}"></span>` +
      `<span class="ct-name">${escHtml(f.name)}</span>` +
      `<span></span><span></span><span class="ct-wins">${ch.champ && f.name === ch.champ.name ? '👑' : ''}</span></div>`).join('');
  chOverlay();
}

function chRenderHof() {
  const rows = Object.values(ch.hof)
    .sort((a, b) => b.titles - a.titles || b.wins - a.wins || a.fights - b.fights).slice(0, 15);
  ch.win.querySelector('#ch-hof').innerHTML = rows.length
    ? '<table class="ch-table"><tr><th></th><th>Beast</th><th title="Fights">⚔</th>' +
      '<th title="Wins">🏅</th><th title="Undefeated retirements">👑</th><th title="Best streak">🔥</th></tr>' +
      rows.map((r, i) => `<tr><td>${i + 1}</td><td class="ch-n" title="${escHtml(r.name)}">${escHtml(r.name)}</td>` +
        `<td>${r.fights}</td><td>${r.wins}</td><td>${r.titles}</td><td>${r.best}</td></tr>`).join('') +
      '</table>'
    : '<div class="ct-empty">No fights recorded yet.</div>';
}

function chRender() {
  chOverlay();
  if (!ch.win) return;
  const $ = (id) => ch.win.querySelector('#' + id);
  $('ch-setup').hidden = ch.on;
  $('ch-live').hidden = !ch.on;
  $('ch-toggle').textContent = ch.on ? '⏹ Turn the channel off' : '📺 Turn the channel on';
  $('ch-toggle').classList.toggle('primary', !ch.on);
  $('ch-champ').innerHTML = ch.champ
    ? `👑 Champion: <b style="color:${ch.champ.color}">${escHtml(ch.champ.name)}</b> · streak ${ch.streak}/${ch.cfg.retire}`
    : (ch.on ? 'No champion: open fight' : '');
  $('ch-recent').innerHTML = ch.recent.map((r) =>
    `<div class="ch-res"><span>#${r.no}</span> ${r.names.map(escHtml).join(' vs ')} → ` +
    (r.winner ? `<b>${escHtml(r.winner)}</b>` : '—') +
    (r.note ? ` <i>${escHtml(r.note)}</i>` : '') + '</div>').join('');
  chRenderHof();
}

async function chRenderPools() {
  if (!inv.items.length) await invLoad();
  const sel = ch.win.querySelector('#ch-pool');
  const cur = sel.value;
  const tags = allTags();
  sel.innerHTML = '<option value="all">the whole Bestiary</option>' +
    '<option value="fav">★ favorites</option>' +
    tags.map(([t, n]) => `<option value="tag:${escHtml(t)}">#${escHtml(t)} (${n})</option>`).join('') +
    [...inv.sets.keys()].map((n) => `<option value="set:${escHtml(n)}">selection: ${escHtml(n)}</option>`).join('');
  if (cur) sel.value = cur;
  const upd = () => {
    const n = chPool(sel.value).length;
    ch.win.querySelector('#ch-pooln').textContent = `${n} beasts`;
  };
  sel.onchange = upd;
  upd();
}

async function openChannel() {
  if (ch.win) { winLayer.appendChild(ch.win); return; }
  if (!BESTIARY.length) { log('channel: no bots/bots.json (is the page served over http?)'); return; }
  chLoad();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CH_CFG_KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const v = (k, d) => (saved[k] !== undefined ? saved[k] : d);
  const w = makeWindow('📺 F1 Channel', Math.min(460, innerWidth - 40), 0, () => { ch.win = null; });
  ch.win = w;
  w.classList.add('ct-win');
  w.style.left = Math.max(20, innerWidth - 520) + 'px';
  w.style.top = '70px';
  w.body.innerHTML =
    '<div id="ch-setup">' +
    '<div class="ct-h">Lineup</div>' +
    '<div class="ct-rules">' +
    `<label>Fighters per fight</label><input type="number" id="ch-k" min="2" max="20" value="${v('k', 2)}">` +
    `<label>Minimum rounds per fight</label><input type="number" id="ch-rounds" min="1" value="${v('rounds', 5)}">` +
    `<label title="The original's Maxrounds: the first fighter to win this many rounds takes the fight. 0 = only the statistical rule, which with 3+ fighters can drag on for a long time">Wins to take the fight</label><input type="number" id="ch-wins" min="0" value="${v('wins', 3)}">` +
    `<label title="Consecutive wins the champion needs to retire undefeated">Champion retires after</label><input type="number" id="ch-retire" min="1" value="${v('retire', 5)}">` +
    `<label title="Past it, the round goes to the most numerous species">Cycle cap per round</label><input type="number" id="ch-cap" min="100" step="500" value="${v('cap', 5000)}">` +
    `<label>Bots per species</label><input type="number" id="ch-qty" min="1" value="${v('qty', 5)}">` +
    `<label>Starting energy</label><input type="number" id="ch-nrg" min="1" value="${v('nrg', 3000)}">` +
    `<label>Pause between fights (s)</label><input type="number" id="ch-pause" min="0" max="60" value="${v('pause', 5)}">` +
    `<label class="ct-wide"><input type="checkbox" id="ch-f1" ${v('f1', true) ? 'checked' : ''}> Use F1 league settings</label>` +
    '</div>' +
    '<div class="ct-h">Draw pool <span id="ch-pooln"></span></div>' +
    '<select id="ch-pool"></select>' +
    '<div class="ct-rule">Favorites, tags and selections are set up in the 📚 Inventory.</div>' +
    '</div>' +
    '<button id="ch-toggle" class="primary ct-go">📺 Turn the channel on</button>' +
    '<div id="ch-live" hidden>' +
    '<div id="ch-champ" class="ch-champ"></div>' +
    '<div id="ch-board"></div>' +
    '</div>' +
    '<div id="ch-note" class="ct-note"></div>' +
    '<details class="ch-sec"><summary>Recent fights</summary><div id="ch-recent"></div></details>' +
    '<details class="ch-sec" open><summary>Hall of Fame</summary><div id="ch-hof"></div>' +
    '<button id="ch-hofclear" class="ch-small">Clear the Hall</button></details>';
  const $ = (id) => w.querySelector('#' + id);
  $('ch-toggle').onclick = () => (ch.on ? channelStop() : channelStart());
  $('ch-hofclear').onclick = () => {
    if (!Object.keys(ch.hof).length) return;
    ch.hof = {};
    chSaveHof();
    chRender();
  };
  await chRenderPools();
  if (saved.pool) { $('ch-pool').value = saved.pool; $('ch-pool').onchange(); }
  chRender();
}
