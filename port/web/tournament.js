'use strict';
// Torneos (E11, capa host, fuera de la fidelidad): una sola ventana,
// "🏆 Tournaments", con pestañas Setup / Play (con los resultados), en lugar de las
// ventanas Contest, Channel y Leagues. El modelo, la base y los partidos son
// de league.js; aquí están la ventana, el selector de participantes y el TV
// mode: el Canal de antes convertido en lanzador de ediciones. Juega la
// temporada entera, anuncia al campeón con un rótulo sobre el campo y lanza
// la temporada siguiente con un sorteo nuevo, sin fin.
//
// Usa globales de index.html (BESTIARY, PRESETS, makeWindow, winLayer, log,
// escHtml, worker), de inventory.js (inv, invLoad, invFetchDna, allTags,
// InvDB), de lab.js (labDnaByName), de contest.js (contestBoardHtml,
// contestRoundWinner, contestDna) y de league.js.

const tn = {
  win: null,
  tab: 'setup',
  resNo: 0,          // resultados: temporada a mostrar (0 = la abierta)
  confirm: '',       // botón de dos clics armado ('del' | 'season')
  confirmT: 0,
  loaded: false,     // lgLoadAll y las migraciones, una vez por página
};
const tv = {
  on: false,
  phase: 'idle',     // 'idle' | 'break' (cortinilla) | 'fight' | 'banner' (campeón)
  L: null,           // torneo que juega (siempre lg.cur: cambiar de torneo lo apaga)
  fx: null,          // pelea en curso o próxima
  fightNo: 0,
  fails: 0,          // lanzamientos fallidos o nulos seguidos
  timer: 0,
  until: 0,          // fin de la cortinilla o del rótulo (performance.now)
  pause: 5,
  winner: '',
  champ: null,       // campeón de la edición que terminó ({name, how})
  st: null,          // últimas stats del partido (para el rótulo)
};
const TV_PAUSE_KEY = 'db-tv-pause';
const TV_BANNER_S = 12;

const tnPoolName = (p) => (p === 'all' ? 'the whole Bestiary' : p === 'fav' ? 'the ★ favorites'
  : p === 'sel' ? 'the Inventory selection' : p.startsWith('tag:') ? `#${p.slice(4)}`
  : p.startsWith('set:') ? `the selection "${p.slice(4)}"` : p);

function tnFmtText(f) {
  return f.format === 'rr' ? `round robin, ${f.legs === 2 ? 'two legs' : 'one leg'}`
    : f.format === 'ladder' ? 'step ladder'
    : f.format === 'single' ? 'single match'
    : f.format === 'cup' ? `World cup, groups of 4${f.groupLegs === 2 ? ' (two legs)' : ''}, ` +
      `${f.pots === 'random' ? 'random pots' : 'pots by Elo'}${f.third ? ', third-place match' : ''}`
    : `king of the hill, ${f.k} per fight, retires after ${f.retire} wins`;
}

// Avance de la temporada, en una línea.
function tnProgress(S, ms) {
  if (S.entrants.length < 2) return '';
  if (lgSeasonDone(S, ms)) return '🏁 complete';
  const f = S.fmt.format;
  if (f === 'rr') { const st = lgRrState(S, ms); return `${st.played} of ${st.total} fixtures played`; }
  if (f === 'ladder') {
    const st = lgLadderState(S, ms);
    return `${st.placed} of ${S.live ? S.live.n : st.total} on the ladder`;
  }
  if (f === 'cup') {
    if (!lgCupSizeOk(S)) return 'needs 8, 16 or 32 entrants';
    const st = lgCupState(S, ms);
    if (st.phase === 'draw') return 'groups not drawn yet';
    if (st.phase === 'groups') return `group stage: ${st.played} of ${st.total} matches`;
    return `knockout: ${st.label.split(' · ')[0]}`;
  }
  if (f === 'koth') {
    const k = lgKothState(S, ms);
    return `${k.played} of at most ${lgKothCap(S)} fights` +
      (k.champ ? ` · 👑 ${k.champ} ${k.streak}/${S.fmt.retire}` : '');
  }
  return 'not played yet';
}

function tnNote(text, warn) {
  if (!tn.win) return;
  const n = tn.win.querySelector('#tn-note');
  n.textContent = text;
  n.className = 'ct-note' + (warn ? ' warn' : '');
}

function tnArm(kind, fn) {
  if (tn.confirm === kind) {
    tn.confirm = '';
    clearTimeout(tn.confirmT);
    fn();
    return;
  }
  tn.confirm = kind;
  clearTimeout(tn.confirmT);
  tn.confirmT = setTimeout(() => { tn.confirm = ''; tnRender(); }, 3000);
  tnRender();
}

// ---- Copa (E12) -------------------------------------------------------------------
const tnCupSizeMsg = (S) => `A World cup needs 8, 16 or 32 entrants (now ${S.entrants.length}).`;
const tnColorOf = (S) => new Map(S.entrants.map((e) => [e.name, e.color]));

// Setup: los grupos sorteados, con el bombo y el Elo del Hall of Fame de cada uno.
function tnCupSetupHtml(L, S) {
  if (!lgCupSizeOk(S)) return `<div class="ct-empty">${tnCupSizeMsg(S)}</div>`;
  if (!lgCupGroupsOk(S))
    return '<div class="ct-empty">Not drawn yet: 🎲 draws them now; otherwise they are drawn when the first match starts.</div>';
  const elo = new Map(lgAllTime(L, lg.matches).map((r) => [r.name, r.elo]));
  const col = tnColorOf(S);
  return '<div class="tn-groups">' + S.groups.map((g, gi) =>
    `<div class="tn-group"><div class="tn-gname">Group ${lgCupLetter(gi)}</div>` +
    g.map((n, p) => `<div class="tn-grow"><span class="tn-pot" title="Pot ${p + 1}">${p + 1}</span>` +
      `<span class="ct-dot lg-dot" style="background:${col.get(n)}"></span>` +
      `<span class="tn-gn" title="${escHtml(n)}">${escHtml(n)}</span>` +
      `<span class="tn-elo" title="Hall of Fame Elo">${Math.round(elo.has(n) ? elo.get(n) : LG_ELO0)}</span></div>`).join('') +
    '</div>').join('') + '</div>' +
    `<div class="ct-rule">${S.fmt.pots === 'random' ? 'Pure random draw.'
      : 'Pots by the Hall of Fame Elo (1500 without history): one entrant of each pot per group.'}</div>`;
}

// Resultados: tablas de grupo (los 2 primeros, resaltados) y el cuadro.
function tnCupResultsHtml(S, ms) {
  if (!lgCupSizeOk(S)) return `<div class="ct-empty">${tnCupSizeMsg(S)}</div>`;
  if (!lgCupGroupsOk(S)) return '<div class="ct-empty">The groups are not drawn yet.</div>';
  const st = lgCupState(S, ms);
  return '<div class="tn-groups">' + st.groups.map((g, gi) =>
    `<div class="tn-group"><div class="tn-gname">Group ${g.name}</div>` +
    '<table class="ch-table tn-gt"><tr><th></th><th>Entrant</th><th title="Played">P</th><th title="Won">W</th><th>Elo</th></tr>' +
    g.rows.map((r, i) => `<tr${i < 2 ? ' class="tn-q"' : ''}><td>${i + 1}</td>` +
      `<td class="ch-n" title="${escHtml(r.name)}"><span class="ct-dot lg-dot" style="background:${r.color}"></span>${escHtml(r.name)}</td>` +
      `<td>${r.p}</td><td>${r.w}</td><td>${Math.round(r.elo)}</td></tr>`).join('') +
    '</table>' + tnCupGroupFixturesHtml(S, st, gi) + '</div>').join('') + '</div>' +
    '<div class="ct-rule">The top 2 of each group go through. Ties: head to head, group Elo, fewer rounds won at the cycle cap, fewer cycles, draw order.</div>' +
    tnCupBracketHtml(S, st);
}

// Los partidos del grupo gi por jornada: el ganador resaltado, el que sigue
// con borde.
function tnCupGroupFixturesHtml(S, st, gi) {
  const col = tnColorOf(S), busy = lg.live ? ' disabled' : '';
  const nx = st.phase === 'groups' && st.next ? lgPairKey(st.next[0].name, st.next[1].name) : '';
  let nextShown = false;
  const side = (f, n) => `<span class="tn-side${f.winner === n ? ' tn-won' : f.winner ? ' tn-lost' : ''}" title="${escHtml(n)}">` +
    `<span class="ct-dot lg-dot" style="background:${col.get(n)}"></span>${escHtml(n)}</span>`;
  return '<div class="tn-gfx">' + st.fixtures.filter((f) => f.gi === gi).map((f) => {
    const isNext = !f.winner && !nextShown && lgPairKey(f.a, f.b) === nx;
    if (isNext) nextShown = true;
    return `<div class="tn-fx${isNext ? ' next' : ''}"><span class="tn-day" title="Matchday ${f.day}">${f.day}</span>` +
      side(f, f.a) + side(f, f.b) +
      (f.id !== undefined ? `<button class="ch-small lg-replay" data-replay="${f.id}"${busy}` +
        ` title="Replay match #${f.no} with the same seed">↻</button>` : '<span class="tn-fxr"></span>') + '</div>';
  }).join('') + '</div>';
}

// El cuadro: una columna por ronda. Mientras se juegan los grupos, la
// primera ronda muestra los puestos (1A, 2B…); las rondas por jugar, los
// ganadores que ya se conocen.
function tnCupBracketHtml(S, st) {
  const G = S.groups.length, col = tnColorOf(S), first = st.bracket[0] || [];
  let round = [];
  for (let k = 0; k < G; k++) {
    const top = k < G / 2, gi = 2 * (top ? k : k - G / 2);
    const [a, b] = top ? [gi, gi + 1] : [gi + 1, gi];
    round.push(first[k] || { pa: `1${lgCupLetter(a)}`, pb: `2${lgCupLetter(b)}` });
  }
  const rounds = [round];
  while (round.length > 1) {
    const r = rounds.length, nx = [];
    for (let k = 0; k < round.length; k += 2)
      nx.push((st.bracket[r] && st.bracket[r][k / 2]) || { a: round[k].winner, b: round[k + 1].winner });
    rounds.push(nx);
    round = nx;
  }
  const busy = lg.live ? ' disabled' : '';
  const key = (a, b) => [a, b].sort().join('\u0001');
  const next = st.next ? key(st.next[0].name, st.next[1].name) : '';
  const side = (t, n, ph) => (n
    ? `<div class="tn-side${t.winner === n ? ' tn-won' : t.winner ? ' tn-lost' : ''}" title="${escHtml(n)}">` +
      `<span class="ct-dot lg-dot" style="background:${col.get(n)}"></span>${escHtml(n)}</div>`
    : `<div class="tn-side tbd">${ph || '—'}</div>`);
  const tie = (t) => `<div class="tn-tie${t.a && t.b && !t.winner && key(t.a, t.b) === next ? ' next' : ''}">` +
    side(t, t.a, t.pa) + side(t, t.b, t.pb) +
    (t.id !== undefined ? `<button class="ch-small lg-replay" data-replay="${t.id}"${busy}` +
      ` title="Replay match #${t.no} with the same seed">↻</button>` : '') + '</div>';
  return '<div class="tn-bracket">' + rounds.map((r) =>
    `<div class="tn-round"><div class="tn-rname">${r.length === 1 ? 'Final' : lgCupRound(r.length)}</div><div class="tn-ties">` +
    r.map(tie).join('') +
    (r.length === 1 && S.fmt.third ? '<div class="tn-rname">Third place</div>' + tie(st.third || {}) : '') +
    '</div></div>').join('') + '</div>';
}

async function tnCupDrawGroups() {
  const L = lg.cur;
  if (!L) return;
  const S = lgSeason(L);
  if (lgSeasonMatches(S.no).length) { tnNote('This season has matches: the groups are locked.', true); return; }
  if (!lgCupSizeOk(S)) { tnNote(tnCupSizeMsg(S), true); return; }
  delete S.groups;
  lgCupDraw(L, lg.matches);
  await lgSave(L);
  tnNote('Groups drawn.');
  tnRender();
}

// ---- TV mode -------------------------------------------------------------------
function tvReadPause() {
  const el = tn.win && tn.win.querySelector('#tn-pause');
  const n = parseInt(el ? el.value : '', 10);
  const p = Math.min(60, Math.max(0, Number.isNaN(n) ? 5 : n));
  try { localStorage.setItem(TV_PAUSE_KEY, String(p)); } catch (e) { /* nada */ }
  return p;
}

async function tvStart() {
  const L = lg.cur;
  if (!L || tv.on) return;
  if (!inv.items.length) await invLoad();
  if (lg.live) leagueAbort();              // un partido a la vez
  Object.assign(tv, { on: true, L, fx: null, fightNo: 0, fails: 0, winner: '', champ: null, st: null,
                      pause: tvReadPause(), phase: 'idle' });
  log(`📺 TV mode on: ${L.name}`);
  tnRender();
  await tvEdition();
}

// Una edición: la temporada abierta si está a medias; si no tiene partidos,
// se vuelve a sortear; si terminó, temporada nueva con sorteo nuevo. Con el
// sorteo en cada pelea no se sortea nada aquí: lo hace tvNext.
async function tvEdition() {
  const L = tv.L, S = lgSeason(L), ms = lgSeasonMatches(S.no);
  let r = null;
  tnNote('Drawing the entrants…');
  if (!ms.length) {
    if (lgLiveSync(L)) await lgSave(L);
    if (!S.live) r = await lgRedraw(L);
  } else if (lgSeasonDone(S, ms)) r = await lgNewSeason(L, { draw: true });
  if (!tv.on || tv.L !== L) return;        // apagado mientras sorteaba
  if (lgSeason(L).live) {
    if (lgPool(lgSeason(L).live.pool).length < 2) {
      tnNote(`The draw pool (${tnPoolName(lgSeason(L).live.pool)}) has fewer than 2 bots: TV mode off.`, true);
      tvStop();
      return;
    }
  } else if (lgSeason(L).entrants.length < 2) {
    tnNote(`The draw pool (${tnPoolName(lgDrawOf(L).pool)}) has fewer than 2 readable bots: TV mode off.`, true);
    tvStop();
    return;
  }
  const cur = lgSeason(L);
  if (cur.fmt.format === 'cup' && !lgCupSizeOk(cur)) {
    tnNote(`A World cup needs 8, 16 or 32 entrants; this edition drew ${cur.entrants.length}: TV mode off.`, true);
    tvStop();
    return;
  }
  await lgCupEnsure(L);                     // copa: los grupos de la edición
  if (!tv.on || tv.L !== L) return;
  if (r) log(`📺 ${L.name}: edition ${lgSeason(L).no}, ${r.added} entrants drawn`);
  tnNote(lgSeason(L).live ? `Edition ${lgSeason(L).no}: entrants drawn at every fight.`
                          : `Edition ${lgSeason(L).no}: ${lgSeason(L).entrants.length} entrants.`);
  tn.resNo = 0;
  tvNext();
}

async function tvNext() {
  clearTimeout(tv.timer);
  if (!tv.on) return;
  const L = tv.L;
  await lgLiveFill(L);                      // sorteo en cada pelea: los de esta
  if (!tv.on || tv.L !== L) return;
  const fx = lgNextFixture(L);
  if (!fx && !lgSeasonDone(lgSeason(L), lgSeasonMatches(lgSeason(L).no))) {
    tnNote('The draw pool has too few readable bots for the next fight: TV mode off.', true);
    tvStop();
    return;
  }
  if (!fx) { tvSeasonOver(); return; }
  Object.assign(tv, { fx, phase: 'break', winner: '', st: null,
                      until: performance.now() + tv.pause * 1000 });
  tv.fightNo++;
  tnRender();
  tvTick();
}

// Cuenta atrás de la cortinilla o del rótulo del campeón.
function tvTick() {
  clearTimeout(tv.timer);
  if (!tv.on || (tv.phase !== 'break' && tv.phase !== 'banner')) return;
  const left = Math.ceil((tv.until - performance.now()) / 1000);
  if (left <= 0) {
    if (tv.phase === 'break') tvLaunch(); else tvEdition();
    return;
  }
  tvOverlay(left);
  tnRenderTv(left);
  tv.timer = setTimeout(tvTick, 250);
}

async function tvLaunch() {
  tv.phase = 'fight';
  try {
    await lgPlay(tv.L, tv.fx);               // las reglas de la temporada en cada pelea
  } catch (e) {
    tv.phase = 'idle';
    if (++tv.fails > 5) { tnNote('Too many failed launches in a row: TV mode off.', true); tvStop(); return; }
    tnNote(`Fight #${tv.fightNo} could not start: ${e.message}`, true);
    tvNext();
    return;
  }
  log(`📺 fight #${tv.fightNo}: ${tv.fx.fighters.map((e) => e.name).join(' vs ')}`);
  tvOverlay();
  tnRender();
}

// La liga registró la pelea (lgRecord): respiro y la siguiente.
function tnOnResult(rec) {
  if (!tv.on || tv.phase !== 'fight' || rec.league !== tv.L.id) return;
  tv.phase = 'idle';
  tv.winner = rec.winner;
  if (rec.winner) tv.fails = 0;
  else if (++tv.fails > 5) { tnNote('Too many void fights in a row: TV mode off.', true); tvStop(); return; }
  tvOverlay();
  tv.timer = setTimeout(tvNext, 1500);      // un respiro para ver el marcador
}

function tvSeasonOver() {
  const L = tv.L, S = lgSeason(L);
  tv.champ = lgSeasonChampion(S, lgSeasonMatches(S.no));
  log(`📺 ${L.name}, edition ${S.no} complete` +
      (tv.champ ? `: 🏆 ${tv.champ.name} ${LG_HOW[tv.champ.how]}` : ''));
  tnNote(`Edition ${S.no} complete` + (tv.champ ? `: 🏆 ${tv.champ.name} ${LG_HOW[tv.champ.how]}.` : '.'));
  tv.phase = 'banner';
  tv.until = performance.now() + Math.max(TV_BANNER_S, tv.pause) * 1000;
  tnRender();
  tvTick();
}

// Apagar no abandona el partido en curso: se registra al terminar.
function tvStop() {
  if (!tv.on) return;
  tv.on = false;
  tv.phase = 'idle';
  clearTimeout(tv.timer);
  if (!lg.live) {
    worker.postMessage({ t: 'f1-cap', cycles: 0 });
    worker.postMessage({ t: 'f1-popcap', n: 0 });
  }
  log('📺 TV mode off');
  tvOverlay();
  tnRender();
}

// Rótulo sobre el campo (#ch-overlay): cortinilla, partido en vivo y campeón.
function tvOverlay(left) {
  const el = document.getElementById('ch-overlay');
  if (!el) return;
  if (!tv.on) { el.hidden = true; return; }
  el.hidden = false;
  const L = tv.L, S = lgSeason(L);
  const tag = `🏆 ${escHtml(L.name)} · edition ${S.no}`;
  if (tv.phase === 'banner') {
    el.innerHTML = `<div class="ch-live">📺 ${tag} · COMPLETE</div>` +
      (tv.champ ? `<div class="ch-win">🏆 ${escHtml(tv.champ.name)}</div>` +
                  `<div class="ch-live">${LG_HOW[tv.champ.how]}</div>` : '') +
      (left ? `<div class="ch-live">next edition in <b>${left}</b></div>` : '');
    return;
  }
  const fx = tv.fx;
  const vs = fx ? fx.fighters.map((e) =>
    `<span style="color:${e.color}">${escHtml(e.name)}</span>`).join(' <i>vs</i> ') : '';
  // Copa: la fase en grande ("GROUP C · MATCHDAY 2", "SEMI-FINAL · MATCH 1 OF 2", "FINAL").
  const cup = S.fmt.format === 'cup';
  const label = fx ? `<div class="${cup ? 'ch-phase' : 'ch-live'}">${escHtml(cup ? fx.label.toUpperCase() : fx.label)}</div>` : '';
  if (tv.phase === 'break') {
    el.innerHTML = `<div class="ch-live">📺 NEXT FIGHT #${tv.fightNo}${left ? ` in <b>${left}</b>` : ''} · ${tag}</div>` +
      `<div class="ch-vs">${vs}</div>` + label;
    return;
  }
  const f1 = tv.st && tv.st.f1;
  const round = f1 ? ` · round ${Math.min(f1.contests + 1, f1.minrounds)}/${f1.minrounds}` : '';
  el.innerHTML = `<div class="ch-live"><span class="ch-dot"></span>LIVE · fight #${tv.fightNo}${round} · ${tag}</div>` +
    `<div class="ch-vs">${vs}</div>` + (tv.winner ? `<div class="ch-win">🏆 ${escHtml(tv.winner)}</div>` : label);
}

// ---- Stats de cada frame (las reenvía index.html) ------------------------------
function tnOnStats(st) {
  const m = lg.live;
  if (!m || !m.ready || !st.f1) return;
  const rw = contestRoundWinner(m.lastWins, st.f1);
  if (rw) tnNote(`Round ${st.f1.contests} goes to ${rw}.`);
  m.lastWins = st.f1.sp.map((s) => s.wins);
  if (tv.on && tv.phase === 'fight') { tv.st = st; tvOverlay(); }
  if (!tn.win) return;
  const L = lgFind(m.league);
  const S = L && (m.replay ? L.seasons.find((s) => s.no === m.season) : lgSeason(L));
  const f = S ? S.fmt : LG_FMT_DEFAULT;
  tn.win.querySelector('#tn-board').innerHTML = contestBoardHtml(
    st, new Map(m.fighters.map((e) => [e.name, e.color])), f.rounds, '', f.wins);
}

// ---- Render -----------------------------------------------------------------------
function tnRender() {
  if (!tn.win) { tvOverlay(); return; }
  const w = tn.win;
  const $ = (id) => w.querySelector('#' + id);
  const L = lg.cur;
  const scratch = lgIsScratch(L);
  $('tn-pick').innerHTML =
    `<option value="${LG_SCRATCH_ID}"${scratch ? ' selected' : ''}>⚡ Scratch: quick match (not saved)</option>` +
    lg.list.map((x) => `<option value="${x.id}"${x === L ? ' selected' : ''}>🏆 ${escHtml(x.name)}</option>`).join('');
  $('tn-save').hidden = !scratch;
  $('tn-del').textContent = tn.confirm === 'del' ? (scratch ? 'Clear it?' : 'Delete it?') : '🗑';
  $('tn-del').title = scratch ? 'Clear the Scratch: entrants and matches' : 'Delete this tournament and its matches';
  $('tn-export').disabled = !L || scratch;
  for (const b of w.querySelectorAll('.tn-tabs button')) b.classList.toggle('on', b.dataset.tab === tn.tab);
  if (tn.tab !== 'setup') tn.tab = 'play';
  for (const t of ['setup', 'play']) $('tn-' + t).hidden = tn.tab !== t;
  if (!L) return;
  const S = lgSeason(L), ms = lgSeasonMatches(S.no);
  const locked = ms.length > 0;
  tnRenderSetup(L, S, ms, locked);
  tnRenderPlay(L, S, ms, locked);
  tnRenderResults(L);
}

function tnRenderSetup(L, S, ms, locked) {
  const $ = (id) => tn.win.querySelector('#' + id);
  const scratch = lgIsScratch(L);
  if (document.activeElement !== $('tn-name')) $('tn-name').value = L.name;
  $('tn-name').disabled = scratch;
  $('tn-name').title = scratch ? 'The Scratch has no name: 💾 saves it as a tournament' : 'Tournament name';
  $('tn-season').innerHTML = `Season <b>${S.no}</b> · ${lgPlayed(ms).length} matches` +
    (locked ? ' · 🔒 format, match values and rules are locked until a new season'
            : ' · format, match values and rules editable');
  $('tn-fmt').innerHTML = lgFmtHtml(S.fmt, locked);
  $('tn-rules').innerHTML = lgRulesSummary(S.rules);
  for (const id of ['tn-rsave', 'tn-rf1', 'tn-rfree']) $(id).disabled = locked;
  const single = S.fmt.format === 'single' && S.entrants.length > LG_MAX_FIGHTERS;
  const cup = S.fmt.format === 'cup';
  $('tn-ecount').textContent = `${S.entrants.length}` +
    (single ? ` · only the first ${LG_MAX_FIGHTERS} play a single match` : '') +
    (cup && !lgCupSizeOk(S) ? ' · a World cup needs 8, 16 or 32' : '') +
    (S.fmt.format === 'rr' && S.entrants.length * (S.entrants.length - 1) / 2 > LG_RR_WARN
      ? ` · ⚠ ${(S.entrants.length * (S.entrants.length - 1) / 2).toLocaleString('en')} fixtures` : '');
  $('tn-cupsetup').hidden = !cup;
  if (cup) {
    $('tn-groups').innerHTML = tnCupSetupHtml(L, S);
    $('tn-drawgroups').disabled = locked || !lgCupSizeOk(S);
    $('tn-drawgroups').title = locked ? 'This season has matches: the groups are locked'
      : lgCupGroupsOk(S) ? 'Draw the groups again' : 'Draw the groups now';
  }
  const playedBy = new Set(ms.flatMap((m) => m.fighters));
  const d = locked ? ' disabled' : '';
  $('tn-entrants').innerHTML = S.entrants.length
    ? S.entrants.map((e, i) => `<div class="ct-fighter" data-i="${i}">` +
        `<input type="color" class="ct-color" value="${e.color}" title="Color"${d}>` +
        `<span class="ct-name" title="${escHtml(e.name)} · DNA ${e.hash}">${escHtml(e.name)}</span>` +
        `<span class="ct-src">${{ bestiary: 'Bestiary', hybrid: 'hybrid', form: 'form', preset: 'preset' }[e.src] || ''}</span>` +
        `<label title="Bots of this species; empty = the format's ${S.fmt.qty}">qty ` +
        `<input type="number" class="ct-qty" min="1" max="200" value="${e.qty || ''}" placeholder="${S.fmt.qty}"${d}></label>` +
        `<button class="ct-del" title="${playedBy.has(e.name) ? 'Already played this season' : 'Remove'}"` +
        `${playedBy.has(e.name) ? ' disabled' : ''}>✕</button></div>`).join('')
    : S.live ? '<div class="ct-empty">Drawn from the pool as the season is played.</div>'
    : '<div class="ct-empty">Add at least 2 entrants, or draw them.</div>';
  const dr = lgDrawOf(L);
  if (document.activeElement !== $('tn-drawn')) $('tn-drawn').value = dr.n;
  if ($('tn-drawpool').value !== dr.pool) $('tn-drawpool').value = dr.pool;
  $('tn-drawmode').value = dr.mode;
  const poolN = lgPool(dr.pool).length;
  $('tn-drawn').max = Math.max(2, poolN);
  $('tn-drawn').title = `How many (the pool has ${poolN}; more than that draws the whole pool)`;
  $('tn-drawhint').textContent = [tnDrawHint(dr, S, locked), tnRrWarn(S, Math.min(dr.n, poolN))].filter(Boolean).join(' ');
  $('tn-draw').disabled = locked;
  $('tn-draw').title = locked ? 'This season has matches: start a new season to draw again'
                              : 'Replace the entrants with this many drawn at random from the pool';
}

function tnRenderPlay(L, S, ms, locked) {
  const $ = (id) => tn.win.querySelector('#' + id);
  const live = lg.live && lg.live.league === L.id;
  const busy = !!lg.live;
  $('tn-sum').innerHTML = `<b>${escHtml(L.name)}</b> · season ${S.no} · ${escHtml(tnFmtText(S.fmt))} · ` +
    `${S.entrants.length} entrants` + (tnProgress(S, ms) ? ` · ${escHtml(tnProgress(S, ms))}` : '');
  const fx = live || tv.on ? null : lgNextFixture(L);
  // Copa sin grupos (se sortean con el primer partido) o de un tamaño que no sirve.
  const cupWait = S.fmt.format === 'cup' && !fx && !lgSeasonDone(S, ms) && S.entrants.length >= 2
    ? (lgCupSizeOk(S) ? 'draw' : 'size') : '';
  // Sorteo en cada pelea: los de la próxima salen del pool al lanzarla.
  const liveWait = !!S.live && !fx && !lgSeasonDone(S, ms);
  const names = (list) => list.map((e) => `<b style="color:${e.color}">${escHtml(e.name)}</b>`).join(' vs ');
  $('tn-next').innerHTML = live
    ? `${lg.live.replay ? `Replaying #${lg.live.replay.no}` : 'Playing'}: ${names(lg.live.fighters)}`
    : tv.on && tv.fx && tv.phase !== 'banner' ? `Next: ${names(tv.fx.fighters)} <span class="ct-rule">${escHtml(tv.fx.label)}</span>`
    : fx ? `Next: ${names(fx.fighters)} <span class="ct-rule">${escHtml(fx.label)}</span>`
    : liveWait ? `Next: <span class="ct-empty">drawn from ${escHtml(tnPoolName(S.live.pool))} when the fight starts</span>`
    : S.entrants.length < 2 ? '<span class="ct-empty">Add at least 2 entrants in Setup, or draw them.</span>'
    : cupWait === 'size' ? `<span class="ct-empty">${tnCupSizeMsg(S)}</span>`
    : cupWait === 'draw' ? '<span class="ct-empty">The groups are drawn when the first match starts (or in Setup).</span>'
    : lgChampionHtml(S, ms);
  $('tn-play-next').hidden = tv.on || (!live && !fx && cupWait !== 'draw' && !liveWait);
  $('tn-play-next').disabled = busy;
  $('tn-abort').hidden = !live;
  $('tn-newseason').hidden = tv.on || !locked;
  $('tn-newseason').disabled = busy;
  const dr = lgDrawOf(L);
  $('tn-newseason').textContent = tn.confirm === 'season'
    ? `Start season ${S.no + 1}? (click again)`
    : '📅 New season' + (dr.mode !== 'fixed' ? ' (new draw)' : '');
  $('tn-board').hidden = !live && !(tv.on && tv.phase === 'break');
  if (!live && !tv.on) $('tn-board').innerHTML = '';
  $('tn-tv').textContent = tv.on ? '⏹ Stop the TV mode' : '📺 TV mode';
  $('tn-tv').classList.toggle('primary', !tv.on);
  $('tn-tv').title = tv.on ? 'Stop after this fight (it is still recorded)'
    : 'Play this tournament on its own, season after season, each with entrants drawn at random';
  $('tn-tvhint').textContent = tv.on
    ? `📺 On air: edition ${lgSeason(tv.L).no}, fight #${tv.fightNo}. Every fight is recorded in the tournament.`
    : `Plays the season to the end, shows the champion over the field and starts a new season ` +
      (lgLiveOn(L) ? `drawing from ${tnPoolName(dr.pool)} at every fight` : `with ${dr.n} entrants drawn from ${tnPoolName(dr.pool)}`) +
      ` (Setup → Entrants), over and over.`;
  if (tv.on && tv.phase === 'break') tnRenderTv(Math.ceil((tv.until - performance.now()) / 1000));
}

// Cortinilla del TV mode en el marcador.
function tnRenderTv(left) {
  if (!tn.win || tv.phase !== 'break' || !tv.fx) return;
  const b = tn.win.querySelector('#tn-board');
  b.hidden = false;
  b.innerHTML = `<div class="ch-next">Next fight #${tv.fightNo} in <b>${Math.max(0, left)}</b>…</div>` +
    tv.fx.fighters.map((e) => `<div class="ct-row"><span class="ct-dot" style="background:${e.color}"></span>` +
      `<span class="ct-name">${escHtml(e.name)}</span><span></span><span></span><span></span></div>`).join('');
}

function tnRenderResults(L) {
  const $ = (id) => tn.win.querySelector('#' + id);
  const cur = lgSeason(L);
  const S = (tn.resNo && L.seasons.find((s) => s.no === tn.resNo)) || cur;
  const ms = lgSeasonMatches(S.no);
  $('tn-seasons').innerHTML = L.seasons.map((s) =>
    `<button class="ch-small${s === S ? ' on' : ''}" data-season="${s.no}">${s.no}</button>`).join(' ');
  $('tn-rhead').innerHTML = `Season <b>${S.no}</b>${S === cur ? ' (current)' : ''} · ${escHtml(tnFmtText(S.fmt))} · ` +
    `${S.entrants.length} entrants · ${lgPlayed(ms).length} matches` +
    (lgSeasonDone(S, ms) ? `<div>${lgChampionHtml(S, ms)}</div>` : '') +
    (S === cur ? '' : `<details class="ch-sec"><summary>Rules of season ${S.no}</summary>${lgRulesSummary(S.rules)}</details>`);
  const cup = S.fmt.format === 'cup';
  $('tn-cupres').hidden = !cup;
  if (cup) $('tn-cup').innerHTML = tnCupResultsHtml(S, ms);
  $('tn-table').innerHTML = lgStandingsHtml(S, ms);
  $('tn-h2h').innerHTML = lgH2HHtml(S, ms);
  $('tn-hist').innerHTML = lgHistoryHtml(ms);
  $('tn-hof').innerHTML = tnAllTimeHtml(L);
}

function tnAllTimeHtml(L) {
  const rows = lgAllTime(L, lg.matches);
  if (!rows.length) return '<div class="ct-empty">No matches yet.</div>';
  const done = L.seasons.filter((s) => lgSeasonDone(s, lgSeasonMatches(s.no))).length;
  return `<div class="ct-rule">${L.seasons.length} seasons · ${done} complete. Elo carries over from season to season.</div>` +
    '<table class="ch-table"><tr><th></th><th>Entrant</th><th title="Seasons won">🏆</th>' +
    '<th title="Seasons played">S</th><th title="Played">P</th><th title="Won">W</th>' +
    '<th title="Win rate">%</th><th>Elo</th></tr>' +
    rows.slice(0, 50).map((r, i) => `<tr><td>${i + 1}</td><td class="ch-n" title="${escHtml(r.name)}">` +
      `<span class="ct-dot lg-dot" style="background:${r.color}"></span>${escHtml(r.name)}</td>` +
      `<td>${r.titles || ''}</td><td>${r.seasons}</td><td>${r.p}</td><td>${r.w}</td>` +
      `<td>${Math.round((r.w / r.p) * 100)}</td><td>${Math.round(r.elo)}</td></tr>`).join('') +
    '</table>';
}

function tnRenderSearch() {
  const w = tn.win;
  const q = w.querySelector('#tn-q').value.trim().toLowerCase();
  const hits = BESTIARY.filter((b) => !b.veg && (!q || b.name.toLowerCase().includes(q))).slice(0, 40);
  w.querySelector('#tn-hits').innerHTML = hits.length
    ? hits.map((b) => `<button class="ct-hit" data-file="${escHtml(b.file)}" ` +
        `title="${escHtml(b.board || '')}">+ ${escHtml(b.name)}</button>`).join('')
    : '<div class="ct-empty">No results.</div>';
}

// ---- Participantes ------------------------------------------------------------------
async function tnAdd(e) {
  const L = lg.cur;
  if (!L) return;
  if (!lgAddEntrant(lgSeason(L), e)) tnNote(`${e.name} is already in (same DNA).`);
  else tnNote(`${e.name} added.`);
  await lgSave(L);
  tnRender();
}

async function tnAddItems(items) {
  const { added, failed } = await lgEnroll(lg.cur, items);
  tnNote(`${added} entrants added` + (failed ? ` · ${failed} unreadable` : '') +
         (items.length - added - failed ? ` · ${items.length - added - failed} already in` : '') + '.');
  tnRender();
}

// Todos contra todos con muchos participantes: el calendario crece con n².
function tnRrWarn(S, n) {
  const fx = (n * (n - 1)) / 2;
  return S.fmt.format === 'rr' && fx > LG_RR_WARN
    ? `⚠ Round robin: drawing ${n} means ${fx.toLocaleString('en')} fixtures.` : '';
}

// Qué hace el sorteo en cada pelea con el formato de la temporada.
function tnDrawHint(dr, S, locked) {
  if (dr.mode !== 'fight') return '';
  const f = S.fmt.format;
  if (f === 'cup') return 'A World cup needs its entrants before the first match: it draws them at every new season.';
  if (locked && !S.live) return 'From the next season on (this one started with its list).';
  const n = S.live ? S.live.n : dr.n;
  return (locked ? 'This season: ' : '') + (
    f === 'koth' ? `the challengers of every fight come from the pool; the season ends with a retirement or after ${LG_KOTH_CAP * n} fights (3 × ${n}).`
    : f === 'ladder' ? `each newcomer is drawn when its turn comes, up to ${n} on the ladder.`
    : `${n} are drawn when the first match starts.`);
}

async function tnSaveDraw(patch) {
  const L = lg.cur;
  if (!L) return;
  L.draw = lgDrawClean({ ...lgDrawOf(L), ...patch });
  lgLiveSync(L);
  await lgSave(L);
  tnRender();
}

// ---- Ventana ------------------------------------------------------------------------
// Primera apertura: carga los torneos, el Scratch y lo que dejaron el Contest
// y el Canal viejos (el roster pasa al Scratch; el Hall of Fame se ofrece).
async function tnLoad() {
  if (tn.loaded) return;
  tn.loaded = true;
  if (!inv.items.length) await invLoad();
  lgScratch();
  const r = await lgMigrateRoster(lg.scratch.L, contestDna);
  await lgLoadAll();
  if (r && r.added) tnNote(`The old Contest list moved to the Scratch: ${r.added} entrants` +
                           (r.lost ? ` (${r.lost} could not be read)` : '') + '.');
}

async function openTournaments(tab) {
  if (tab) tn.tab = tab;
  if (tn.win) { winLayer.appendChild(tn.win); tnRender(); return; }
  if (!BESTIARY.length) { log('tournaments: no bots/bots.json (is the page served over http?)'); return; }
  const w = makeWindow('🏆 Tournaments', Math.min(500, innerWidth - 40), 0, () => { tn.win = null; });
  tn.win = w;
  w.classList.add('ct-win');
  w.style.left = Math.max(20, innerWidth - 560) + 'px';
  w.style.top = '56px';
  let pause = 5;
  try { pause = parseInt(localStorage.getItem(TV_PAUSE_KEY), 10); } catch (e) { /* nada */ }
  if (Number.isNaN(pause)) pause = 5;
  w.body.innerHTML =
    '<div class="lg-top">' +
    '<select id="tn-pick" title="Tournament"></select>' +
    '<button id="tn-new" title="New tournament (F1 rules; change them in Setup)">＋ New</button>' +
    '<button id="tn-save" title="Keep the Scratch as a tournament, with its matches">💾 Save as tournament</button>' +
    '<button id="tn-del">🗑</button>' +
    '<button id="tn-export" title="Download this tournament (rules, entrants with their DNA and matches) as a file">⬇</button>' +
    '<button id="tn-import" title="Load a tournament from a file (also the leagues exported before)">⬆</button>' +
    '<input id="tn-file" type="file" accept=".json,application/json" hidden>' +
    '</div>' +
    '<div id="tn-oldhof" class="tn-banner" hidden>The old Channel\'s Hall of Fame has no match history, so it cannot ' +
    'join a tournament\'s Hall of Fame. <button id="tn-hofdl">⬇ Download it</button> ' +
    '<button id="tn-hofdrop">Discard it</button></div>' +
    '<div class="tn-tabs"><button data-tab="setup">⚙ Setup</button><button data-tab="play">▶ Play</button>' +
    '</div>' +
    // Setup
    '<div id="tn-setup">' +
    '<input id="tn-name" class="lg-name">' +
    '<div id="tn-season" class="ct-rule"></div>' +
    '<details class="ch-sec" open><summary>Format and match</summary><div id="tn-fmt"></div></details>' +
    '<details class="ch-sec"><summary>World rules</summary><div id="tn-rules"></div>' +
    '<div class="ct-srcrow">' +
    '<button id="tn-rload" title="Write these rules into the Sim options panel, to look at or retouch them there">Load into the panel</button>' +
    '<button id="tn-rsave" title="Replace the rules with the Sim options panel as it is now">Save the panel as rules</button>' +
    '<button id="tn-rf1" title="The F1 league settings (btnSetF1): league costs, 9237×6928 toroidal field">F1 preset</button>' +
    '<button id="tn-rfree" title="The current Sim options with every cost at 0">No-cost preset</button>' +
    '</div><div class="ct-rule">Every match applies these rules; the Game modes of Sim options are set by the tournament.</div></details>' +
    '<details class="ch-sec" open><summary>Entrants <span id="tn-ecount"></span></summary>' +
    '<div id="tn-entrants" class="tn-list"></div>' +
    '<input type="search" id="tn-q" placeholder="search the Bestiary and click to add…">' +
    '<div id="tn-hits"></div>' +
    '<div class="ct-srcrow">' +
    `<select id="tn-pool" title="Add every bot of a group">${lgPoolOptions('— add a group —')}</select>` +
    '<select id="tn-hyb"></select>' +
    '<button id="tn-addform" title="The DNA and name from the Seed species panel">DNA from the form</button>' +
    '<button id="tn-addanimal">Animal Minimalis</button>' +
    '</div>' +
    '<div class="ct-srcrow tn-draw">' +
    '<button id="tn-draw">🎲 Draw</button><input type="number" id="tn-drawn" min="2"> from ' +
    `<select id="tn-drawpool">${lgPoolOptions('')}</select>` +
    '</div>' +
    '<label class="tn-chk">Entrants: <select id="tn-drawmode">' +
    '<option value="fixed">the list, carried over to the next season</option>' +
    '<option value="random">drawn again at every new season</option>' +
    '<option value="fight">drawn from the pool at every fight</option></select></label>' +
    '<div id="tn-drawhint" class="ct-rule"></div>' +
    '<div class="ct-rule">Each entrant keeps the DNA it had when it joined. The TV mode draws at every edition.</div>' +
    '</details>' +
    '<details id="tn-cupsetup" class="ch-sec" open hidden><summary>🌍 World cup groups</summary>' +
    '<div id="tn-groups"></div>' +
    '<div class="ct-srcrow"><button id="tn-drawgroups">🎲 Draw groups</button></div></details>' +
    '</div>' +
    // Play
    '<div id="tn-play" hidden>' +
    '<div id="tn-sum" class="ch-champ"></div>' +
    '<div id="tn-next"></div>' +
    '<div class="ct-liverow">' +
    '<button id="tn-play-next" class="primary">▶ Play next</button>' +
    '<button id="tn-abort" title="Stop recording this match">✕ Abandon</button>' +
    '<button id="tn-newseason" title="Unlocks format and rules; entrants carry over, or are drawn again">📅 New season</button>' +
    '</div>' +
    '<div id="tn-board"></div>' +
    '<div class="tn-tvbox">' +
    '<button id="tn-tv" class="ct-go"></button>' +
    `<label>Pause between fights <input type="number" id="tn-pause" min="0" max="60" value="${pause}"> s</label>` +
    '<div id="tn-tvhint" class="ct-rule"></div>' +
    '</div>' +
    // Resultados (debajo, en la misma pestaña)
    '<div class="ct-liverow tn-seasons">📊 Results · season <span id="tn-seasons"></span></div>' +
    '<div id="tn-rhead" class="ct-rule"></div>' +
    '<details id="tn-cupres" class="ch-sec" open hidden><summary>🌍 Groups and bracket</summary><div id="tn-cup"></div></details>' +
    '<details class="ch-sec" open><summary>Standings</summary><div id="tn-table" class="tn-scroll"></div></details>' +
    '<details class="ch-sec"><summary>Head to head</summary><div id="tn-h2h" class="tn-scroll"></div></details>' +
    '<details class="ch-sec" open><summary>Matches</summary><div id="tn-hist" class="tn-scroll"></div></details>' +
    '<details class="ch-sec" open><summary>🏛 Hall of Fame · all seasons</summary><div id="tn-hof" class="tn-scroll"></div></details>' +
    '</div>' +
    '<div id="tn-note" class="ct-note"></div>';
  // #tn-play es la pestaña; el botón "Play next" lleva otro id.
  const $ = (id) => w.querySelector('#' + id);

  // ---- Barra de arriba y pestañas ----
  $('tn-pick').onchange = async (e) => {
    const id = e.target.value;
    await lgSelect(id === LG_SCRATCH_ID ? lgScratch() : lg.list.find((L) => L.id === id) || null);
    tn.resNo = 0;
  };
  $('tn-new').onclick = async () => {
    await lgCreate('f1');
    tn.tab = 'setup';
    tnNote(`${lg.cur.name} created: pick its format and entrants.`);
    tnRender();
  };
  $('tn-save').onclick = async () => {
    const L = await lgScratchSave();
    if (L) tnNote(`Saved as "${L.name}" (rename it in Setup). The Scratch keeps the same entrants.`);
  };
  $('tn-del').onclick = () => lg.cur && tnArm('del', async () => {
    if (lgIsScratch(lg.cur)) {
      if (lg.live && lg.live.league === LG_SCRATCH_ID) leagueAbort();
      tvStop();
      lg.scratch = lgScratchNew(null, lgF1Rules());
      await lgSelect(lg.scratch.L);
      tnNote('Scratch cleared.');
    } else await lgDelete(lg.cur);
    if (!lg.cur) await lgSelect(lgScratch());
  });
  $('tn-export').onclick = () => lg.cur && !lgIsScratch(lg.cur) && lgExport(lg.cur);
  $('tn-import').onclick = () => $('tn-file').click();
  $('tn-file').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) await lgImport(f);
  };
  w.querySelector('.tn-tabs').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tn.tab = b.dataset.tab;
    tnRender();
  };
  const hof = lgOldHofFile();
  $('tn-oldhof').hidden = !hof;
  $('tn-hofdl').onclick = () => { lgOldHofDownload(); $('tn-oldhof').hidden = true; };
  $('tn-hofdrop').onclick = () => { lgOldHofDiscard(); $('tn-oldhof').hidden = true; };

  // ---- Setup ----
  $('tn-name').onchange = async (e) => {
    const v = e.target.value.trim();
    if (!lg.cur || !v || lgIsScratch(lg.cur)) return;
    lg.cur.name = v;
    await lgSave(lg.cur);
    tnRender();
  };
  $('tn-fmt').onchange = async (e) => {
    const k = e.target.dataset.f;
    if (!k || !lg.cur) return;
    const S = lgSeason(lg.cur), f = S.fmt;
    if (e.target.type === 'checkbox') f[k] = e.target.checked;
    else if (e.target.tagName === 'SELECT') f[k] = e.target.value;
    else {
      const n = parseInt(e.target.value, 10);
      const lo = +e.target.min || 0, hi = +e.target.max || 1e7;
      f[k] = Math.min(hi, Math.max(lo, Number.isNaN(n) ? LG_FMT_DEFAULT[k] : n));
    }
    if (k === 'format' || k === 'pots') delete S.groups;   // copa: otro sorteo
    lgLiveSync(lg.cur);                                     // la copa no sortea en cada pelea
    await lgSave(lg.cur);
    tnRender();
  };
  const setRules = async (rules, msg) => {
    if (!lg.cur) return;
    lgSeason(lg.cur).rules = rules;
    await lgSave(lg.cur);
    tnNote(msg);
    tnRender();
  };
  $('tn-rload').onclick = () => {
    if (!lg.cur) return;
    lgApplyRules(lgSeason(lg.cur).rules);
    tnNote('Rules loaded into the panel: size changes apply when you press Reset.');
    tnRender();
  };
  $('tn-rsave').onclick = () => setRules(lgCaptureRules(), 'Rules saved from the panel.');
  $('tn-rf1').onclick = () => setRules(lgF1Rules(), 'F1 league rules set.');
  $('tn-rfree').onclick = () => setRules(lgNoCostRules(), 'No-cost rules set (the panel as it is, every cost at 0).');
  let qT = 0;
  $('tn-q').oninput = () => { clearTimeout(qT); qT = setTimeout(tnRenderSearch, 120); };
  $('tn-hits').onclick = async (e) => {
    const b = e.target.closest('[data-file]');
    const it = b && BESTIARY.find((x) => x.file === b.dataset.file);
    if (!it) return;
    try {
      await tnAdd({ name: it.name, dna: await invFetchDna(it), src: 'bestiary', file: it.file });
    } catch (err) { tnNote(`${it.name}: its DNA could not be read.`, true); }
  };
  $('tn-pool').onchange = async (e) => {
    const f = e.target.value;
    e.target.value = '';
    if (!f || !lg.cur) return;
    const items = lgPool(f);
    if (!items.length) { tnNote('That group is empty.', true); return; }
    tnNote(`Reading ${items.length} bots…`);
    await tnAddItems(items);
  };
  $('tn-hyb').onchange = async (e) => {
    const name = e.target.value;
    e.target.value = '';
    if (!name || !lg.cur) return;
    const dna = await labDnaByName(name + '.txt');
    if (!dna) { tnNote(`Hybrid "${name}" not found.`, true); return; }
    await tnAdd({ name, dna, src: 'hybrid', file: name });
  };
  $('tn-addform').onclick = async () => {
    const dna = document.getElementById('dna').value;
    if (!dna.trim()) { tnNote('The form has no DNA.', true); return; }
    const name = (document.getElementById('sp-name').value || 'bot.txt').replace(/\.txt$/i, '');
    await tnAdd({ name, dna, src: 'form' });
  };
  $('tn-addanimal').onclick = () =>
    tnAdd({ name: 'Animal_Minimalis', dna: PRESETS.animal.dna, src: 'preset', file: 'animal' });
  $('tn-entrants').onclick = async (e) => {
    if (!e.target.classList.contains('ct-del') || !lg.cur) return;
    lgSeason(lg.cur).entrants.splice(+e.target.closest('[data-i]').dataset.i, 1);
    await lgSave(lg.cur);
    tnRender();
  };
  $('tn-entrants').onchange = async (e) => {
    const row = e.target.closest('[data-i]');
    if (!row || !lg.cur) return;
    const x = lgSeason(lg.cur).entrants[+row.dataset.i];
    if (e.target.classList.contains('ct-qty')) {
      const q = parseInt(e.target.value, 10);
      if (q > 0) x.qty = Math.min(200, q); else delete x.qty;
    }
    if (e.target.classList.contains('ct-color')) x.color = e.target.value;
    await lgSave(lg.cur);
    tnRender();
  };
  $('tn-drawn').onchange = (e) => tnSaveDraw({ n: e.target.value });
  $('tn-drawpool').onchange = (e) => tnSaveDraw({ pool: e.target.value });
  $('tn-drawmode').onchange = (e) => tnSaveDraw({ mode: e.target.value });
  $('tn-drawgroups').onclick = () => tnCupDrawGroups();
  $('tn-draw').onclick = async () => {
    const L = lg.cur;
    if (!L) return;
    const d = lgDrawOf(L);
    tnNote(`Drawing ${d.n} from ${tnPoolName(d.pool)}…`);
    const r = await lgRedraw(L);
    if (!r) { tnNote('This season has matches: start a new season to draw again.', true); return; }
    tnNote(`${r.added} entrants drawn at random` + (r.failed ? ` · ${r.failed} unreadable` : '') +
           (r.added < d.n ? ` (the pool only had ${r.added} readable bots)` : '') + '.', r.added < 2);
  };

  // ---- Play ----
  $('tn-play-next').onclick = () => lgPlayNext();
  $('tn-abort').onclick = () => leagueAbort();
  $('tn-newseason').onclick = () => lg.cur && tnArm('season', async () => {
    const r = await lgNewSeason(lg.cur);
    tn.resNo = 0;
    tnNote(`Season ${lgSeason(lg.cur).no} started` + (r ? `: ${r.added} entrants drawn.` : '.'));
  });
  $('tn-tv').onclick = () => (tv.on ? tvStop() : tvStart());
  $('tn-pause').onchange = () => { tv.pause = tvReadPause(); };

  // ---- Resultados ----
  $('tn-seasons').onclick = (e) => {
    const b = e.target.closest('[data-season]');
    if (!b) return;
    tn.resNo = +b.dataset.season;
    tnRender();
  };
  // Repetir un partido (del cuadro, los grupos o la lista).
  w.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-replay]');
    if (b && !b.disabled) lgReplay(+b.dataset.replay);
  });

  let hs = [];
  try { hs = (await InvDB.all('hybrids')).filter((h) => !h.veg); } catch (e) { /* sin IndexedDB */ }
  $('tn-hyb').innerHTML = '<option value="">— hybrid —</option>' +
    hs.map((h) => `<option>${escHtml(h.name)}</option>`).join('');
  $('tn-hyb').disabled = !hs.length;
  tnRenderSearch();
  await tnLoad();
  tnRender();
}
