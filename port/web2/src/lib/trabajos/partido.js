// @ts-check
// Corre UN partido de torneo en un worker de sim (engine/worker.js) sin
// dibujar y a máxima velocidad (decisión 23), y el ejecutor de la cola
// (engine/cola.js) para las rondas en segundo plano. Puro JS, sin DOM ni
// runes: el worker llega envuelto en un «canal» (src/lib/trabajos/replica.js)
// y los workers salen del pool (src/lib/trabajos/pool.js), los mismos que
// usan las réplicas.
//
// El partido: mensajesDelPlan(plan) de engine/rondas.js (el escenario
// efectivo con reset limpio, C15, + topes y f1start + correr), con
// {t:'speed', n: 0} antes (máxima velocidad; el worker se auto-agenda sin
// esperar 'ack'). Los frames no se devuelven: el worker publica uno y deja
// de armarlos. El resultado se lee como en «Jugar y mirar»
// (interpretarMensaje de engine/partido.js: f1-started, f1-note y f1-over,
// con el marcador final y los ciclos que trae el f1-over) y al terminar se
// pausa la sim. Una barrera ({t:'ciclo', req}) separa los mensajes de lo
// que el worker haya dicho antes (otro partido, otra réplica).
//
// Progreso: cada `cadaMs` un {t:'ciclo'} (solo lectura). Cuando el ciclo
// vuelve atrás empezó otra ronda del contest; la fracción es (rondas
// terminadas + ciclo/tope) / rondas esperadas (el tope de victorias o las
// rondas mínimas de la regla), sin pasar de 0,99 hasta el final.
//
// Cada unidad arma el plan de SU partido con planDeRonda(t.params, i) de
// engine/rondas.js (params compactos, formato 2: el ADN de cada participante
// y las reglas una sola vez; los de formato 1 traían el plan hecho). El
// ejecutor es `reintentable: false`: la cola rechaza reintentar una ronda
// cancelada o fallida (ErrorCola 'no-reintentable'); se pide otra ronda.
//
// Registro en la cola (NO está en src/lib/trabajos/ejecutores.js ni en
// trabajos.svelte.js, que edita la interfaz de Competir). La receta completa
// está en la cabecera de engine/rondas.js (punto 3); en corto:
//   ejecutores.js:        [TIPO_RONDA]: ejecutorRonda(d)
//   trabajos.svelte.js:   solo en la pestaña DUEÑA de la cola (C20)
//     alDuena                         → torneos.lgReconciliarRondas(cola)
//     alTerminar(t, propia) con propia y t.tipo === TIPO_RONDA
//                                     → torneos.lgReconciliarRondas(cola)
//     alTerminar(t, false) (otra pestaña la corrió)
//                                     → torneos.lgRefrescar(t.params.league)
//   y tras cancelar o borrar un trabajo de ronda (en la dueña; en otra
//   pestaña, lgRefrescar): torneos.lgReconciliarRondas(cola).

import {
  contestMinLength,
  interpretarMensaje,
  marcadorFinal,
  nuevoVivo,
} from '../../../engine/partido.js';
import {
  mensajesDelPlan,
  planDeRonda,
  resumenRonda,
  vistaParamsRonda,
} from '../../../engine/rondas.js';
import { ErrorReplica } from './replica.js';

/** @typedef {import('../../../engine/rondas.js').ResultadoPartido} ResultadoPartido */

let secuencia = 0;

/**
 * Juega el partido del plan y devuelve su resultado (lo que lgRecord
 * guardaría: ganador o '' con la nota del nulo, marcador final f1, ciclos,
 * rondas al tope y, para mirar, victorias por luchador).
 * @param {{
 *   canal: import('./replica.js').Canal,
 *   plan: import('../../../engine/partido.js').Plan,
 *   progreso?: (fr: number) => void,
 *   senal?: AbortSignal,
 *   cadaMs?: number,
 *   plazoMs?: number,
 * }} o  plazoMs: tope de tiempo del partido (0 o sin él = sin tope)
 * @returns {Promise<ResultadoPartido>}
 */
export function correrPartido(o) {
  const { canal, plan } = o;
  const req = `partido${++secuencia}`;
  const cadaMs = o.cadaMs ?? 250;
  const fighters = plan.species.map((sp) => ({ name: String(sp.name).replace(/\.txt$/, '') }));
  const vivo = nuevoVivo({ league: '', season: 0, fighters, label: null });
  const esperadas = Math.max(
    1,
    plan.f1.wins > 0 ? plan.f1.wins : contestMinLength(Math.max(1, plan.f1.rounds || 1)),
  );
  return new Promise((resolver, rechazar) => {
    let listo = false; // pasó la barrera
    let fin = false;
    let rondas = 0;
    let ultimoCiclo = -1;
    let nPedido = 0;
    /** @type {(() => void)[]} */
    const bajas = [];
    /** @type {any} */
    let reloj = null;
    /** @type {any} */
    let plazo = null;
    const cerrar = () => {
      fin = true;
      if (reloj) clearInterval(reloj);
      if (plazo) clearTimeout(plazo);
      o.senal?.removeEventListener('abort', abortar);
      for (const b of bajas) b();
    };
    /** @param {Error} e */
    const fallar = (e) => {
      if (fin) return;
      cerrar();
      rechazar(e);
    };
    const abortar = () => fallar(new ErrorReplica('abortada'));
    /** @param {string} winner @param {string | undefined} note */
    const terminar = (winner, note) => {
      if (fin) return;
      canal.enviar({ t: 'run', running: false });
      cerrar();
      const { wins, capWins } = marcadorFinal(vivo);
      o.progreso?.(1);
      resolver({
        winner: winner || '',
        note: note || '',
        f1: vivo.f1,
        cycles: vivo.cycles || 0,
        capRounds: vivo.capRounds,
        wins,
        capWins,
        fighters: fighters.map((f) => f.name),
        seed: plan.seed,
      });
    };
    /** @param {number} c */
    const avance = (c) => {
      if (c < ultimoCiclo) rondas++;
      ultimoCiclo = c;
      const tope = plan.f1.cap > 0 ? Math.min(1, Math.max(0, c) / plan.f1.cap) : 0;
      o.progreso?.(Math.min(0.99, (rondas + tope) / esperadas));
    };
    bajas.push(
      canal.on((m) => {
        if (fin || !m || typeof m !== 'object') return;
        if (m.t === 'ciclo' && typeof m.req === 'string' && m.req.startsWith(`${req}:`)) {
          if (m.req === `${req}:0`) listo = true;
          else avance(m.cycle);
          return;
        }
        if (m.t === 'error') {
          fallar(new ErrorReplica('carga', String(m.msg ?? m.clave)));
          return;
        }
        if (!listo) return;
        const r = interpretarMensaje(vivo, m);
        if (r?.t === 'registrar') terminar(r.winner, r.note);
      }),
    );
    if (canal.alError)
      bajas.push(canal.alError((e) => fallar(new ErrorReplica('worker', String(e?.message ?? e)))));
    if (o.senal?.aborted) {
      fallar(new ErrorReplica('abortada'));
      return;
    }
    o.senal?.addEventListener('abort', abortar);
    if (o.plazoMs) plazo = setTimeout(() => fallar(new ErrorReplica('tiempo')), o.plazoMs);
    try {
      canal.enviar({ t: 'ciclo', req: `${req}:0` });
      canal.enviar({ t: 'speed', n: 0 });
      for (const m of mensajesDelPlan(plan)) canal.enviar(m);
    } catch (e) {
      fallar(/** @type {Error} */ (e));
      return;
    }
    reloj = setInterval(() => canal.enviar({ t: 'ciclo', req: `${req}:${++nPedido}` }), cadaMs);
    reloj?.unref?.();
  });
}

/**
 * Ejecutor de la cola para las rondas de torneo (tipo TIPO_RONDA de
 * engine/rondas.js): una unidad = un partido de la ronda en un worker del
 * pool. El resumen es resumenRonda (ganador, victorias y ciclos de cada uno).
 * @param {{pool: import('./pool.js').PoolWorkers, cadaMs?: number, plazoMs?: number}} d
 * @returns {import('../../../engine/cola.js').Ejecutor}
 */
export function ejecutorRonda(d) {
  return {
    async unidad(t, i, ctx) {
      let plan;
      try {
        plan = planDeRonda(t.params, i);
      } catch (e) {
        throw new ErrorReplica('carga', `partido ${i}: ${/** @type {any} */ (e)?.message ?? e}`);
      }
      const w = await d.pool.tomar(ctx.senal);
      let sano = false;
      try {
        const r = await correrPartido({
          canal: w.canal,
          plan,
          progreso: ctx.progreso,
          senal: ctx.senal,
          cadaMs: d.cadaMs,
          plazoMs: d.plazoMs,
        });
        sano = true;
        return r;
      } finally {
        if (sano) d.pool.soltar(w);
        else d.pool.descartar(w);
      }
    },
    final(t, datos) {
      return resumenRonda(t.params, datos);
    },
    // La lista de la cola no copia el ADN ni las reglas.
    vista: vistaParamsRonda,
    // Una ronda cancelada o fallida no se reintenta: su marca en el torneo ya
    // se quitó (lgReconciliarRondas) y el torneo pudo cambiar.
    reintentable: false,
  };
}
