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
//
// E10 L2: con una liga elegida, el Canal juega su calendario (league.js:
// lgNextFixture, lgPlay) con sus reglas y su formato en cada pelea. La liga
// registra el resultado (lgRecord) y avisa aquí (channelOnLeagueResult); el
// Salón de la fama se reemplaza por la tabla de la liga.

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
  league: null,        // E10: liga que juega el Canal (null = Canal libre)
  fx: null,            // E10: pelea de la liga en curso ({fighters, label})
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
  if (ch.league) { chNextLeague(); return; }
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

// ---- Liga (E10 L2) ------------------------------------------------------------
// Campeón y racha salen del historial de la liga (rey de la colina).
function chSyncChamp() {
  const S = lgSeason(ch.league);
  ch.champ = null;
  ch.streak = 0;
  if (S.fmt.format !== 'koth') return;
  const k = lgKothState(S, lgSeasonMatches(S.no));
  const e = k.champ && S.entrants.find((x) => x.name === k.champ);
  if (e) { ch.champ = { name: e.name, color: e.color }; ch.streak = k.streak; }
}

function chNextLeague() {
  const L = ch.league, S = lgSeason(L);
  const fx = lgNextFixture(L);
  if (!fx) { chSeasonOver(L); return; }
  ch.fx = fx;
  ch.fighters = fx.fighters.map((e) => ({ name: e.name, color: e.color }));
  chSyncChamp();
  ch.fightNo++;
  ch.phase = 'break';
  ch.breakEnd = performance.now() + ch.cfg.pause * 1000;
  chRender();
  chTick();
}

// Calendario completo (todos contra todos o escalera): anuncia al campeón de la
// temporada, apaga el Canal y deja el rótulo unos segundos.
function chSeasonOver(L) {
  const S = lgSeason(L);
  const few = S.entrants.length < 2;
  const top = few ? null : lgStandings(S, lgSeasonMatches(S.no))[0];
  const msg = few ? `${L.name} needs at least 2 entrants.`
                  : `${L.name}, season ${S.no} complete` + (top ? `: 🏆 ${top.name}` : '');
  log('📺 ' + msg);
  channelStop();
  chNote(msg, few);
  const el = document.getElementById('ch-overlay');
  if (!el || few) return;
  el.hidden = false;
  el.innerHTML = `<div class="ch-live">📺 🏟 ${escHtml(L.name)} · SEASON ${S.no} COMPLETE</div>` +
    (top ? `<div class="ch-win">🏆 ${escHtml(top.name)}</div>` : '');
  clearTimeout(ch.bannerT);
  ch.bannerT = setTimeout(() => { ch.bannerT = 0; if (!ch.on) el.hidden = true; }, 20000);
}

// La liga registró la pelea (lgRecord): marcador, racha y la siguiente.
function channelOnLeagueResult(rec) {
  if (!ch.on || !ch.league || ch.phase !== 'fight' || rec.league !== ch.league.id) return;
  ch.phase = 'idle';
  ch.winner = rec.winner;
  const S = lgSeason(ch.league);
  const r = { no: ch.fightNo, names: rec.fighters.slice(), winner: rec.winner, note: rec.note || '' };
  chSyncChamp();
  if (rec.winner) {
    ch.fails = 0;
    // En rey de la colina el ganador queda de campeón salvo que se retire.
    if (S.fmt.format === 'koth' && !ch.champ) {
      r.note = `👑 retires undefeated after ${S.fmt.retire} wins`;
      log(`📺 ${rec.winner} retires undefeated (${S.fmt.retire} wins in a row)`);
    }
  } else if (++ch.fails > 5) {
    chNote('Too many void fights in a row: channel off.', true);
    channelStop();
  }
  ch.recent.unshift(r);
  ch.recent.length = Math.min(ch.recent.length, 12);
  chRender();
  if (ch.on) ch.timer = setTimeout(chNext, 1500);
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
  ch.ready = false;
  ch.lastWins = null;
  ch.winner = '';
  contest.running = false;                 // un torneo a la vez
  if (typeof contestRender === 'function') contestRender();
  if (ch.league) {
    try {
      await lgPlay(ch.league, ch.fx);         // reglas de la liga en cada pelea
    } catch (e) {
      ch.phase = 'idle';
      ch.recent.unshift({ no: ch.fightNo, names: ch.fighters.map((f) => f.name),
                          winner: '', note: 'void: ' + e.message });
      if (++ch.fails > 5) { chNote('Too many failed launches in a row: channel off.', true); channelStop(); return; }
      chNext();
      return;
    }
    log(`📺 fight #${ch.fightNo}: ${ch.fighters.map((f) => f.name).join(' vs ')}`);
    chRender();
    return;
  }
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
  // Hasta el censo de esta pelea llegan mensajes de la sim anterior.
  if (msg.t === 'f1-started') ch.ready = true;
  else if (!ch.ready) return;
  // Con liga, el resultado lo registra league.js y llega por channelOnLeagueResult.
  if (ch.league) {
    if (msg.t === 'f1-note' && msg.kind === 'cap')
      chNote('Cycle cap reached: the round goes to the ' +
             (ch.cfg.capMode === 'nrg' ? 'species with the most energy.' : 'most numerous species.'));
    return;
  }
  if (msg.t === 'f1-started' && !msg.n) chResult('', 'void: the census found no fighters');
  else if (msg.t === 'f1-note' && msg.kind === 'single') chResult('', 'void: only one species in the census');
  else if (msg.t === 'f1-note' && msg.kind === 'cap') chNote('Cycle cap reached: the round goes to the most numerous species.');
  else if (msg.t === 'f1-over') chResult(msg.winner);
}

function channelOnStats(st) {
  if (!ch.on || ch.phase !== 'fight' || !ch.ready || !st.f1) return;
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
  // Vacío o ilegible → el valor por defecto; un 0 escrito vale (pausa 0, sin tope).
  const int = (id, lo, hi, d) => {
    const n = parseInt($(id).value, 10);
    return Math.min(hi, Math.max(lo, Number.isNaN(n) ? d : n));
  };
  return {
    k: int('ch-k', 2, 20, 2), rounds: int('ch-rounds', 1, 99, 5),
    wins: int('ch-wins', 0, 99, 3),
    retire: int('ch-retire', 1, 999, 5), cap: int('ch-cap', 100, 1e6, 5000),
    qty: int('ch-qty', 1, 200, 5), nrg: int('ch-nrg', 1, 1e6, 3000),
    pause: int('ch-pause', 0, 60, 5), f1: $('ch-f1').checked, pool: $('ch-pool').value,
  };
}

async function channelStart() {
  if (!inv.items.length) await invLoad();
  if (typeof leagueAbort === 'function') leagueAbort();   // un torneo a la vez
  const base = chReadCfg();
  const lid = ch.win.querySelector('#ch-league').value;
  ch.league = lid ? lg.list.find((L) => L.id === lid) || null : null;
  if (lid && !ch.league) { chNote('That league no longer exists.', true); return; }
  try { localStorage.setItem(CH_CFG_KEY, JSON.stringify({ ...base, league: lid })); } catch (e) { /* nada */ }
  ch.cfg = base;
  if (ch.league) {
    // Formato de la liga; del Canal solo la pausa entre peleas.
    const f = lgSeason(ch.league).fmt;
    ch.cfg = { ...base, k: f.k, rounds: f.rounds, wins: f.wins, retire: f.retire,
               cap: f.cap, qty: f.qty, nrg: f.nrg, capMode: f.capMode };
    if (lg.cur !== ch.league) await lgSelect(ch.league);   // el calendario lee lg.matches
    // Liga sin participantes: sorteo del pool del Canal (ADN congelado).
    if (lgSeason(ch.league).entrants.length < 2) {
      const n = Math.min(200, Math.max(2, parseInt(ch.win.querySelector('#ch-lgn').value, 10) || 8));
      chNote(`Drawing ${n} entrants for ${ch.league.name}…`);
      const { added } = await lgDrawRandom(ch.league, chPool(base.pool), n);
      lgRender();
      if (lgSeason(ch.league).entrants.length < 2) {
        chNote('The draw pool has fewer than 2 readable bots.', true);
        return;
      }
      log(`📺 ${ch.league.name}: ${added} entrants drawn at random`);
    }
  }
  clearTimeout(ch.bannerT);
  ch.bannerT = 0;
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
  if (!ch.on) { if (!ch.bannerT) el.hidden = true; return; }   // E10: rótulo de fin de temporada
  el.hidden = false;
  const vs = ch.fighters.map((f) =>
    `<span style="color:${f.color}">${escHtml(f.name)}</span>`).join(' <i>vs</i> ');
  const champ = ch.champ
    ? ` · 👑 ${escHtml(ch.champ.name)} <b>${ch.streak}/${ch.cfg.retire}</b>` : '';
  // E10: con liga, su nombre y (todos contra todos, escalera) la jornada.
  const lgTag = ch.league ? ` · 🏟 ${escHtml(ch.league.name)}` +
    (!ch.champ && ch.fx && lgSeason(ch.league).fmt.format !== 'koth' ? ` · ${escHtml(ch.fx.label)}` : '') : '';
  if (ch.phase === 'break') {
    el.innerHTML = `<div class="ch-live">📺 NEXT FIGHT · #${ch.fightNo}${lgTag}</div><div class="ch-vs">${vs}</div>`;
  } else {
    const f1 = st && st.f1;
    const round = f1 ? ` · round ${Math.min(f1.contests + 1, f1.minrounds)}/${f1.minrounds}` : '';
    el.innerHTML = `<div class="ch-live"><span class="ch-dot"></span>LIVE · fight #${ch.fightNo}${round}${champ}${lgTag}</div>` +
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

// Liga elegida: la del Canal encendido o la del selector.
function chSelLeague() {
  if (ch.on) return ch.league;
  const sel = ch.win && ch.win.querySelector('#ch-league');
  return (sel && sel.value && lg.list.find((L) => L.id === sel.value)) || null;
}

function chRenderHof() {
  const L = chSelLeague();
  ch.win.querySelector('#ch-hofsum').textContent = L ? `Standings · ${L.name}` : 'Hall of Fame';
  ch.win.querySelector('#ch-hofclear').hidden = !!L;
  if (L && lg.cur === L) {
    const S = lgSeason(L);
    ch.win.querySelector('#ch-hof').innerHTML = lgStandingsHtml(S, lgSeasonMatches(S.no));
    return;
  }
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
  const rr = ch.league && lgSeason(ch.league).fmt.format !== 'koth';   // con calendario
  $('ch-champ').innerHTML = ch.champ
    ? `👑 Champion: <b style="color:${ch.champ.color}">${escHtml(ch.champ.name)}</b> · streak ${ch.streak}/${ch.cfg.retire}`
    : rr ? `🏟 ${escHtml(ch.league.name)} · ${escHtml(ch.fx ? ch.fx.label : '')}`
    : (ch.on ? 'No champion: open fight' : '');
  chRenderLeagueSum();
  $('ch-recent').innerHTML = ch.recent.map((r) =>
    `<div class="ch-res"><span>#${r.no}</span> ${r.names.map(escHtml).join(' vs ')} → ` +
    (r.winner ? `<b>${escHtml(r.winner)}</b>` : '—') +
    (r.note ? ` <i>${escHtml(r.note)}</i>` : '') + '</div>').join('');
  chRenderHof();
}

// E10: selector de liga y resumen; con liga, el lineup y el pool del Canal
// no se usan (el formato, las reglas y los participantes son de la liga).
function chRenderLeagueOpts() {
  const sel = ch.win.querySelector('#ch-league');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— no league: free channel —</option>' +
    lg.list.map((L) => `<option value="${L.id}">🏟 ${escHtml(L.name)}</option>`).join('');
  if (lg.list.some((L) => L.id === cur)) sel.value = cur;
}

function chRenderLeagueSum() {
  const L = chSelLeague();
  const $ = (id) => ch.win.querySelector('#' + id);
  $('ch-free').hidden = !!L;
  const S = L && lgSeason(L);
  // Liga sin participantes: el Canal los sortea del pool al encenderse.
  const draw = !!L && S.entrants.length < 2;
  $('ch-poolbox').hidden = !!L && !draw;
  $('ch-lgdraw').hidden = !draw;
  if (!L) { $('ch-lgsum').innerHTML = ''; return; }
  const f = S.fmt, ms = lgSeasonMatches(S.no);
  const fmt = f.format === 'rr' ? `round robin, ${f.legs === 2 ? 'two legs' : 'one leg'}`
    : f.format === 'ladder' ? 'step ladder'
    : `king of the hill, ${f.k} per fight, retires after ${f.retire}`;
  let next = '';
  if (lg.cur === L && f.format === 'rr' && S.entrants.length >= 2) {
    const st = lgRrState(S, ms);
    next = st.next ? ` · ${st.played} of ${st.total} fixtures played` : ' · 🏁 season complete';
  } else if (lg.cur === L && f.format === 'ladder' && S.entrants.length >= 2) {
    const st = lgLadderState(S, ms);
    next = st.next ? ` · ${st.placed} of ${st.total} on the ladder` : ' · 🏁 season complete';
  }
  $('ch-lgsum').innerHTML = `Season <b>${S.no}</b> · ${escHtml(fmt)} · ${S.entrants.length} entrants${next}` +
    '<div class="ct-rule">Rules, format and entrants come from the league (🏟 Leagues); ' +
    'every fight is recorded there.</div>';
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
    '<div class="ct-h">League</div>' +
    '<select id="ch-league"></select>' +
    '<div id="ch-lgsum" class="ch-lgsum"></div>' +
    '<div id="ch-free">' +
    '<div class="ct-h">Lineup</div>' +
    '<div class="ct-rules">' +
    `<label>Fighters per fight</label><input type="number" id="ch-k" min="2" max="20" value="${v('k', 2)}">` +
    `<label>Minimum rounds per fight</label><input type="number" id="ch-rounds" min="1" value="${v('rounds', 5)}">` +
    `<label title="The original's Maxrounds: the first fighter to win this many rounds takes the fight. 0 = only the statistical rule, which with 3+ fighters can drag on for a long time">Wins to take the fight</label><input type="number" id="ch-wins" min="0" value="${v('wins', 3)}">` +
    `<label title="Consecutive wins the champion needs to retire undefeated">Champion retires after</label><input type="number" id="ch-retire" min="1" value="${v('retire', 5)}">` +
    `<label title="Past it, the round goes to the most numerous species">Cycle cap per round</label><input type="number" id="ch-cap" min="100" step="500" value="${v('cap', 5000)}">` +
    `<label>Bots per species</label><input type="number" id="ch-qty" min="1" value="${v('qty', 5)}">` +
    `<label>Starting energy</label><input type="number" id="ch-nrg" min="1" value="${v('nrg', 3000)}">` +
    `<label class="ct-wide"><input type="checkbox" id="ch-f1" ${v('f1', true) ? 'checked' : ''}> Use F1 league settings</label>` +
    '</div>' +
    '</div>' +
    '<div id="ch-poolbox">' +
    '<div id="ch-lgdraw" class="ct-rule" hidden>This league has no entrants yet: turning the channel on draws ' +
    '<input type="number" id="ch-lgn" min="2" max="200" value="8"> at random from the pool below.</div>' +
    '<div class="ct-h">Draw pool <span id="ch-pooln"></span></div>' +
    '<select id="ch-pool"></select>' +
    '<div class="ct-rule">Favorites, tags and selections are set up in the 📚 Inventory.</div>' +
    '</div>' +
    '<div class="ct-rules">' +
    `<label>Pause between fights (s)</label><input type="number" id="ch-pause" min="0" max="60" value="${v('pause', 5)}">` +
    '</div>' +
    '</div>' +
    '<button id="ch-toggle" class="primary ct-go">📺 Turn the channel on</button>' +
    '<div id="ch-live" hidden>' +
    '<div id="ch-champ" class="ch-champ"></div>' +
    '<div id="ch-board"></div>' +
    '</div>' +
    '<div id="ch-note" class="ct-note"></div>' +
    '<details class="ch-sec"><summary>Recent fights</summary><div id="ch-recent"></div></details>' +
    '<details class="ch-sec" open><summary id="ch-hofsum">Hall of Fame</summary><div id="ch-hof"></div>' +
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
  if (!lg.list.length) await lgLoadAll();
  chRenderLeagueOpts();
  if (saved.league && lg.list.some((L) => L.id === saved.league)) $('ch-league').value = saved.league;
  $('ch-league').onchange = async (e) => {
    const L = lg.list.find((x) => x.id === e.target.value);
    if (L && lg.cur !== L) await lgSelect(L);
    chRender();
  };
  if ($('ch-league').value) await $('ch-league').onchange({ target: $('ch-league') });
  chRender();
}
