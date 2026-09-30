// @ts-check
// Lectura de la memoria del bot para el inspector (pestañas Sentidos y
// Memoria). El protocolo no tiene un volcado de memoria: se usa lo que ya
// existe, sin tocar la sim.
//   1. {t:'sysvar', id, name} → {t:'sysvar', id, v}: dirección del sysvar
//      (SysvarTok sin bot; 0 = no es un sysvar).
//   2. {t:'console-cmd', n, line:'? <dirección>'} → {t:'console-out', n,
//      text:' <dirección>-> <valor>'} (printmem de la consola del bot: solo
//      lee, y solo responde si 0 < dirección < 1000).
// La respuesta lleva la dirección, así que no importa el orden.
//
// Variables privadas del bot (`def nombre dirección` en su ADN): no son
// sysvars (el paso 1 da 0), son de cada bot y distinguen mayúsculas. Se
// consultan con `? .nombre` (printmem resuelve con el bot) seguido de una
// barrera {t:'sysvar', id:'inspector:tras:<k>'}: el worker atiende en orden,
// así que si la barrera vuelve antes que la salida, el bot no la tiene.
//
// Barrera al olvidar pendientes (cambio de pestaña): las respuestas de las
// consultas olvidadas siguen en camino y tienen la misma forma que un `? n`
// escrito en la consola. Se manda {t:'sysvar', id:'inspector:barrera:<k>'}
// y toda salida con forma de printmem que llegue antes de su respuesta es
// del inspector: no va a la consola. Puro: el envío se inyecta.

/** Prefijo de los ids de 'sysvar' del inspector (no chocan con otros). */
const PREFIJO_ID = 'inspector:';

/**
 * Sysvars de la pestaña Memoria, por grupo (clave i18n del grupo → nombres).
 * Los nombres no se traducen.
 */
export const GRUPOS_MEMORIA = Object.freeze([
  {
    grupo: 'cuerpo',
    sysvars: [
      '.nrg',
      '.body',
      '.robage',
      '.mass',
      '.waste',
      '.pwaste',
      '.shell',
      '.slime',
      '.venom',
      '.poison',
      '.chlr',
      '.light',
      '.paralyzed',
      '.poisoned',
      '.kills',
      '.dnalen',
      '.genes',
      '.fertilized',
      '.vtimer',
    ],
  },
  {
    grupo: 'movimiento',
    sysvars: [
      '.aim',
      '.xpos',
      '.ypos',
      '.velup',
      '.veldn',
      '.veldx',
      '.velsx',
      '.velscalar',
      '.maxvel',
      '.edge',
      '.fixed',
    ],
  },
  {
    grupo: 'acciones',
    sysvars: [
      '.up',
      '.dn',
      '.sx',
      '.dx',
      '.aimsx',
      '.aimdx',
      '.setaim',
      '.shoot',
      '.shootval',
      '.repro',
      '.mrepro',
      '.sexrepro',
      '.strbody',
      '.fdbody',
      '.mkshell',
      '.mkslime',
      '.strvenom',
      '.strpoison',
      '.tie',
      '.deltie',
    ],
  },
  {
    grupo: 'vision',
    sysvars: [
      '.eyef',
      '.focuseye',
      '.refeye',
      '.reftype',
      '.refnrg',
      '.refbody',
      '.refage',
      '.refshell',
      '.refkills',
      '.refaim',
      '.refxpos',
      '.refypos',
      '.refvelscalar',
    ],
  },
  {
    grupo: 'lazos',
    sysvars: [
      '.numties',
      '.tienum',
      '.tiepres',
      '.tieang',
      '.tielen',
      '.tieloc',
      '.tieval',
      '.multi',
    ],
  },
  {
    grupo: 'libre',
    sysvars: [
      '.timer',
      '.out1',
      '.out2',
      '.out3',
      '.out4',
      '.out5',
      '.in1',
      '.in2',
      '.in3',
      '.in4',
      '.in5',
    ],
  },
]);

/** Sentidos que no vienen en el bloque de foco (se leen de la memoria). */
export const SENTIDOS = Object.freeze({
  tacto: ['.hitup', '.hitdn', '.hitsx', '.hitdx', '.hit', '.hitang'],
  gusto: ['.shup', '.shdn', '.shsx', '.shdx', '.shflav', '.shang'],
  otros: ['.pain', '.pleas', '.daytime'],
});

/** Dirección de memoria válida para printmem. @param {number} d */
export const direccionValida = (d) => Number.isInteger(d) && d > 0 && d < 1000;

/**
 * Respuesta de printmem (` 310-> 1234`) → dirección y valor, o null.
 * @param {string} texto
 * @returns {{ dir: number, valor: number } | null}
 */
export function parsearPrintmem(texto) {
  const m = /^\s*(\d+)-> (-?\d+(?:\.\d+)?)\s*$/.exec(String(texto ?? ''));
  if (!m) return null;
  return { dir: Number(m[1]), valor: Number(m[2]) };
}

/**
 * Normaliza lo que escribe el usuario en «Consultar»: `nrg` → `.nrg`,
 * `*.nrg` → `.nrg`, `310` → `310`. '' si no sirve. Las mayúsculas se
 * respetan: los sysvars no las distinguen, las privadas del bot sí.
 * @param {string} entrada
 */
export function normalizarConsulta(entrada) {
  const s = String(entrada ?? '')
    .trim()
    .replace(/^\*/, '');
  if (/^\d+$/.test(s)) return direccionValida(Number(s)) ? String(Number(s)) : '';
  if (/^\.?[a-z_]\w*$/i.test(s)) return s.startsWith('.') ? s : `.${s}`;
  return '';
}

/** Id de las barreras del inspector. */
const PREFIJO_BARRERA = `${PREFIJO_ID}barrera:`;
/** Id de la barrera que sigue a la consulta de una privada. */
const PREFIJO_TRAS = `${PREFIJO_ID}tras:`;

export class LectorMemoria {
  /** @type {(msg: any) => void} */
  #enviar;
  /** sysvar → dirección (0 = no es un sysvar; ausente = pedida o sin pedir) */
  #direcciones = new Map();
  /** nombres cuya dirección se pidió y no llegó */
  #pedidas = new Set();
  /** direcciones consultadas sin respuesta todavía */
  #pendientes = new Set();
  /** privada del bot → dirección (0 = el bot no la tiene) */
  #privadas = new Map();
  /** @type {{ k: number, nombre: string }[]} privadas consultadas, en orden */
  #colaPrivadas = [];
  /** barreras en camino: la salida con forma de printmem previa se descarta */
  #barreras = new Set();
  #sigBarrera = 0;
  /** dirección → último valor leído */
  #valores = new Map();
  #bot = 0;

  /** @param {(msg: any) => void} enviar  mensaje crudo al worker */
  constructor(enviar) {
    this.#enviar = enviar;
  }

  /** Bot al que se le lee la memoria; al cambiar se olvidan valores y privadas. */
  get bot() {
    return this.#bot;
  }
  set bot(n) {
    if ((n | 0) === this.#bot) return;
    this.#bot = n | 0;
    this.#valores.clear();
    this.#pendientes.clear();
    this.#privadas.clear();
    this.#colaPrivadas = [];
  }

  /**
   * Pide los valores de estos sysvars, privadas (`.nombre`) o direcciones
   * en texto. Los que no tienen dirección todavía la piden primero y se
   * consultan al llegar. Lo que ya está en camino no se vuelve a pedir.
   * @param {readonly string[]} nombres
   */
  leer(nombres) {
    if (!this.#bot) return;
    for (const nombre of nombres) {
      const d = /^\d+$/.test(nombre) ? Number(nombre) : this.#direcciones.get(nombre);
      if (d === undefined) {
        if (!this.#pedidas.has(nombre)) {
          this.#pedidas.add(nombre);
          this.#enviar({ t: 'sysvar', id: PREFIJO_ID + nombre, name: nombre });
        }
      } else if (d === 0) {
        this.#leerPrivada(nombre);
      } else {
        this.#consultar(d);
      }
    }
  }

  /** @param {number} d */
  #consultar(d) {
    if (!direccionValida(d) || this.#pendientes.has(d)) return;
    this.#pendientes.add(d);
    this.#enviar({ t: 'console-cmd', n: this.#bot, line: `? ${d}` });
  }

  /** @param {string} nombre */
  #leerPrivada(nombre) {
    const d = this.#privadas.get(nombre);
    if (d !== undefined) {
      if (d) this.#consultar(d); // 0: el bot no la tiene
      return;
    }
    if (this.#colaPrivadas.some((p) => p.nombre === nombre)) return;
    const k = ++this.#sigBarrera;
    this.#colaPrivadas.push({ k, nombre });
    this.#enviar({ t: 'console-cmd', n: this.#bot, line: `? ${nombre}` });
    this.#enviar({ t: 'sysvar', id: `${PREFIJO_TRAS}${k}`, name: '' });
  }

  /**
   * Olvida las consultas sin respuesta (al salir de la pestaña, para que un
   * `? n` que escriba el usuario en la consola no se tome por una de ellas)
   * y manda una barrera: lo que llegue antes con forma de printmem es de
   * esas consultas y no se muestra.
   */
  olvidarPendientes() {
    if (!this.#pendientes.size && !this.#colaPrivadas.length) return;
    this.#pendientes.clear();
    this.#colaPrivadas = [];
    const k = ++this.#sigBarrera;
    this.#barreras.add(k);
    this.#enviar({ t: 'sysvar', id: `${PREFIJO_BARRERA}${k}`, name: '' });
  }

  /** Hay una barrera en camino. */
  get enBarrera() {
    return this.#barreras.size > 0;
  }

  /**
   * Respuesta {t:'sysvar', id, v}. Devuelve true si era del inspector (y
   * consulta el valor en seguida).
   * @param {any} msg
   */
  alSysvar(msg) {
    if (typeof msg?.id !== 'string' || !msg.id.startsWith(PREFIJO_ID)) return false;
    if (msg.id.startsWith(PREFIJO_BARRERA)) {
      this.#barreras.delete(Number(msg.id.slice(PREFIJO_BARRERA.length)));
      return true;
    }
    if (msg.id.startsWith(PREFIJO_TRAS)) {
      const k = Number(msg.id.slice(PREFIJO_TRAS.length));
      const i = this.#colaPrivadas.findIndex((p) => p.k === k);
      if (i >= 0) {
        // La barrera volvió antes que la salida: el bot no la tiene.
        const [p] = this.#colaPrivadas.splice(i, 1);
        this.#privadas.set(p.nombre, 0);
      }
      return true;
    }
    const nombre = msg.id.slice(PREFIJO_ID.length);
    this.#pedidas.delete(nombre);
    this.#direcciones.set(nombre, msg.v | 0);
    this.leer([nombre]);
    return true;
  }

  /**
   * Salida de la consola {t:'console-out', n, text}. Devuelve true si era la
   * respuesta a una consulta del inspector (no hay que mostrarla).
   * @param {any} msg
   */
  alConsola(msg) {
    if ((msg?.n | 0) !== this.#bot) return false;
    const r = parsearPrintmem(msg.text);
    if (!r) return false;
    if (this.#pendientes.has(r.dir)) {
      this.#pendientes.delete(r.dir);
      this.#valores.set(r.dir, r.valor);
      return true;
    }
    const p = this.#colaPrivadas.shift();
    if (p) {
      this.#privadas.set(p.nombre, r.dir);
      this.#valores.set(r.dir, r.valor);
      return true;
    }
    // Respuesta de una consulta olvidada, antes de que vuelva la barrera.
    return this.#barreras.size > 0;
  }

  /** Copia de los valores leídos (dirección → valor). */
  get valores() {
    return new Map(this.#valores);
  }

  /**
   * Dirección de un sysvar o de una privada del bot: número, 0 si no
   * existe, undefined si todavía no se sabe.
   * @param {string} nombre
   */
  direccion(nombre) {
    if (/^\d+$/.test(nombre)) return Number(nombre);
    const d = this.#direcciones.get(nombre);
    return d === 0 ? this.#privadas.get(nombre) : d;
  }

  /**
   * Último valor leído (undefined = sin dato).
   * @param {string} nombre
   * @returns {number | undefined}
   */
  valor(nombre) {
    const d = this.direccion(nombre);
    return d ? this.#valores.get(d) : undefined;
  }
}
