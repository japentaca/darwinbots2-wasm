// @ts-check
// Los rótulos de engine/league.js ({clave, params}) con el texto en inglés
// de la interfaz clásica (port/web/league.js): el mapeo documentado en la
// cabecera de engine/league.js, en forma ejecutable. Lo usan los smokes de
// test/smokes/ (para chequear los mismos textos que los de tools/) y
// test/paridad_torneos.test.js (para comparar los rótulos de las dos
// implementaciones). No es la interfaz: la nueva los traduce con t().

/** @param {number} n @param {number} [k] */
function cupRound(n, k) {
  if (n === 1) return 'FINAL';
  const r = n === 2 ? 'Semi-final' : n === 4 ? 'Quarter-final' : `Round of ${2 * n}`;
  return k ? `${r} · match ${k} of ${n}` : r;
}

/** @param {{clave: string, params: Record<string, any>} | null | undefined} r */
export function rotuloEn(r) {
  if (!r) return '';
  const p = r.params || {};
  switch (r.clave) {
    case 'single':
      return `Single match: ${p.n} entrants${p.total > p.n ? ` (the first ${p.n} of ${p.total})` : ''}`;
    case 'rr':
      return `Fixture ${p.no} of ${p.total}`;
    case 'ladder':
      return `Ladder: ${p.challenger} challenges rung ${p.rung} (entrant ${p.entrant} of ${p.total})`;
    case 'cup-group':
      return `Group ${p.group} · matchday ${p.day} of ${p.days}`;
    case 'cup-ko':
      return cupRound(p.ties, p.match);
    case 'cup-third':
      return 'Third place';
    case 'swiss':
      return (
        `Swiss round ${p.round} of ${p.rounds} · match ${p.match} of ${p.matches}` +
        (p.bye ? ` · bye: ${p.bye}` : '')
      );
    case 'koth':
      return (
        (p.champ ? `👑 ${p.champ} defends the crown` : 'Open fight: no champion') +
        ` · fight ${p.fight}` +
        (p.cap === null ? '' : ` of at most ${p.cap}`)
      );
    case 'replay':
      return `Replay of match #${p.no} (season ${p.season}, seed ${p.seed})`;
    default:
      throw new Error(`rótulo desconocido: ${r.clave}`);
  }
}

// LG_HOW de la clásica (cómo se ganó la temporada).
export const HOW_EN = {
  match: 'wins the match',
  retired: 'retires undefeated',
  elo: 'tops the Elo at the fight cap',
  dry: 'tops the table when no fresh challenger is left',
  table: 'tops the table',
  ladder: 'holds the top rung',
  cup: 'wins the final',
  swiss: 'tops the Swiss table',
};

// Mensajes de ErrorLiga de lgImportObj con el texto de la clásica.
/** @param {{clave: string, params?: Record<string, any>}} e */
export function errorEn(e) {
  const p = e.params || {};
  switch (e.clave) {
    case 'not-league':
      return 'Not a DarwinBots league file.';
    case 'newer-version':
      return `League file version ${p.version} is newer than this page.`;
    case 'no-seasons':
      return 'The league has no seasons.';
    case 'season-incomplete':
      return `Season ${p.season} is incomplete.`;
    case 'entrant-no-dna':
      return `Season ${p.season}: an entrant has no name or DNA.`;
    default:
      throw new Error(`error desconocido: ${e.clave}`);
  }
}

// Una pelea de lgFixture con el rótulo en texto (como la de la clásica).
/** @param {any} fx */
export const fixtureEn = (fx) => fx && { ...fx, label: rotuloEn(fx.label) };
