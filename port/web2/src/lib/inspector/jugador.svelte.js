// @ts-check
// Player Bot Mode de la página (paso N4.1, decisión 15): un estado único que
// comparten el inspector (pestaña Control: encender, teclas) y Observar
// (indicador, puntero sobre el mundo, Esc). El motor aplica el modo al bot
// con foco y a los resaltados (paso 13 del tick): el ángulo hacia el puntero
// pisa .setaim y cada tecla activa escribe su valor en su memloc.
//
// No reproducible: lo que se hace con el Player Bot no queda en la corrida
// (las réplicas y «Repetir» no lo repiten); la interfaz lo avisa.
//
// Se apaga solo al cambiar la sim (reset o carga: la sim nueva no lo tiene),
// con un contest F1 en curso (partidos de torneo) y al salir de Observar.
//
// El motor controla también a los resaltados: los hijos nacidos mientras se
// controla un bot heredan el resaltado, y si muere el bot con foco el motor
// pasa el foco al último resaltado vivo. El modo se enciende con el
// indicador opcional `seguirFoco` (engine/worker.js) para que la página siga
// a ese heredero en vez de quedarse sin bot; al salir se borran los
// resaltados (db_sim_clear_highlight, el mensaje clear-highlight), que si no
// quedarían marcados sin que se note.

import {
  leerMemloc,
  leerValor,
  mensajeTeclas,
  mismasTeclas,
  modificadorAjeno,
  preset,
  presetDe,
  TecladoPb,
} from './veterano.js';

const CLAVE_LS = 'darwinbots2.pb.teclas';

/** @returns {import('./veterano.js').TeclaPb[]} */
function teclasGuardadas() {
  try {
    const crudo = localStorage.getItem(CLAVE_LS);
    if (crudo) {
      const v = JSON.parse(crudo);
      if (
        Array.isArray(v) &&
        v.every(
          (k) =>
            k &&
            typeof k.codigo === 'string' &&
            leerMemloc(k.memloc) !== null &&
            leerValor(k.valor) !== null,
        )
      )
        return v.map((k) => ({
          codigo: k.codigo,
          memloc: k.memloc,
          valor: k.valor,
          invertir: !!k.invertir,
        }));
    }
  } catch {
    // sin almacenamiento: el preset por defecto
  }
  return preset('flechas');
}

/** @param {import('./veterano.js').TeclaPb[]} teclas */
function guardarTeclas(teclas) {
  try {
    localStorage.setItem(CLAVE_LS, JSON.stringify(teclas));
  } catch {
    // sin almacenamiento: dura lo que la página
  }
}

/** @param {EventTarget | null} el */
function esCampo(el) {
  const h = /** @type {HTMLElement | null} */ (el);
  if (!h?.tagName) return false;
  if (h.isContentEditable) return true;
  return h.tagName === 'INPUT' || h.tagName === 'TEXTAREA' || h.tagName === 'SELECT';
}

class JugadorBot {
  activo = $state(false);
  /** @type {import('./veterano.js').TeclaPb[]} */
  teclas = $state.raw(teclasGuardadas());
  /** @type {import('./veterano.js').NombrePreset | null} */
  presetActual = $derived(presetDe(this.teclas));

  /** @type {import('../sim/sesion.svelte.js').Sesion | null} */
  #sesion = null;
  #mundo = -1;
  #teclado = new TecladoPb((m) => this.#sesion?.c.enviar(m));
  /** @type {[number, number] | null} último puntero pedido */
  #puntero = null;
  #agendado = false;

  /** @param {KeyboardEvent} e */
  #alTecla = (e) => {
    const abajo = e.type === 'keydown';
    // Eligiendo la tecla de una fila (pestaña Control): la tecla es para ella.
    const el = /** @type {HTMLElement | null} */ (e.target);
    if (abajo && el?.closest?.('[data-captura-tecla]')) return;
    if (abajo && e.key === 'Escape') {
      // Un diálogo abierto se cierra con Esc: no salir del modo por eso.
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      e.stopPropagation();
      this.desactivar();
      return;
    }
    // Bajar una tecla escribiendo en un campo no la cuenta; soltarla, siempre.
    // Con un modificador que no es tecla del modo (Ctrl+S…), es del navegador.
    if (abajo && (esCampo(e.target) || modificadorAjeno(this.teclas, e))) return;
    if (this.#teclado.tecla(e.code, abajo)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  #alPerderFoco = () => this.#teclado.soltarTodas();

  /**
   * Enciende el modo sobre el bot con foco. false si no se puede (sin sim o
   * con un contest F1 en curso).
   * @param {import('../sim/sesion.svelte.js').Sesion} sesion
   */
  activar(sesion) {
    if (this.activo) return true;
    if (!sesion.hayMundo || sesion.stats.f1) return false;
    this.#sesion = sesion;
    this.#mundo = sesion.mundo;
    sesion.c.pb(true, true); // N4.1: seguir al heredero si muere el bot
    sesion.c.enviar(mensajeTeclas(this.teclas));
    // (0, 0) = sin puntero: el motor no pisa la puntería hasta que se mueva.
    sesion.c.pbMouse(0, 0);
    this.#teclado.ponerTeclas(this.teclas);
    window.addEventListener('keydown', this.#alTecla, true);
    window.addEventListener('keyup', this.#alTecla, true);
    window.addEventListener('blur', this.#alPerderFoco);
    this.activo = true;
    return true;
  }

  desactivar() {
    if (!this.activo) return;
    window.removeEventListener('keydown', this.#alTecla, true);
    window.removeEventListener('keyup', this.#alTecla, true);
    window.removeEventListener('blur', this.#alPerderFoco);
    const s = this.#sesion;
    this.#teclado.soltarTodas();
    this.#puntero = null;
    // Con la sim ya cambiada, el motor nuevo no lo tiene encendido: igual se
    // manda (inocuo) para que ningún estado quede colgado.
    s?.c.pbMouse(0, 0);
    s?.c.pb(false);
    // Los resaltados que dejó el modo (hijos nacidos bajo control) se borran;
    // en una sim nueva no hay nada que borrar.
    if (s && s.mundo === this.#mundo) s.quitarFamilia();
    this.#sesion = null;
    this.activo = false;
  }

  /** @param {import('../sim/sesion.svelte.js').Sesion} sesion */
  alternar(sesion) {
    if (this.activo) {
      this.desactivar();
      return true;
    }
    return this.activar(sesion);
  }

  /**
   * Teclas nuevas (se recuerdan en el navegador). Con el modo encendido se
   * mandan en el acto.
   * @param {import('./veterano.js').TeclaPb[]} teclas
   */
  ponerTeclas(teclas) {
    // Las mismas (p. ej. la pestaña Control al montarse): nada que reenviar;
    // un pb-keys soltaría en el motor las teclas que están apretadas.
    if (mismasTeclas(teclas, this.teclas)) return;
    this.teclas = teclas.map((k) => ({ ...k }));
    guardarTeclas(this.teclas);
    if (this.activo && this.#sesion) {
      this.#sesion.c.enviar(mensajeTeclas(this.teclas));
      this.#teclado.ponerTeclas(this.teclas);
    }
  }

  /**
   * Puntero sobre el mundo en coordenadas de mundo (null = salió del
   * mundo). A lo sumo un mensaje por cuadro.
   * @param {number | null} x @param {number | null} [y]
   */
  puntero(x, y) {
    if (!this.activo) return;
    this.#puntero = x === null || y === null || y === undefined ? [0, 0] : [x, y];
    if (this.#agendado) return;
    this.#agendado = true;
    requestAnimationFrame(() => {
      this.#agendado = false;
      const p = this.#puntero;
      if (this.activo && p) this.#sesion?.c.pbMouse(p[0], p[1]);
    });
  }

  /**
   * Lo llama Observar en cada cambio de la sesión: apaga el modo si cambió
   * la sim o empezó un contest F1.
   * @param {import('../sim/sesion.svelte.js').Sesion} sesion
   */
  vigilar(sesion) {
    if (!this.activo) return;
    if (sesion.mundo !== this.#mundo || sesion.stats.f1) this.desactivar();
  }
}

/** El Player Bot de la página. */
export const jugador = new JugadorBot();
