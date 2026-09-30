// @ts-check
// Cola de trabajos en segundo plano (decisiones 10, 23 y C20 de
// port/web2/PLAN.md), sin DOM. Genérica: un trabajo es un `tipo` con sus
// `params` y N unidades independientes (las réplicas de un trabajo de
// réplicas; más adelante, los partidos de una ronda de torneo). Quien corre
// cada unidad es un EJECUTOR por tipo, inyectado:
//
//   { unidad(trabajo, i, ctx) → Promise<datos>,   // corre la unidad i
//     final?(trabajo, datos[]) → resumen,          // al terminar todas
//     vista?(params) → params livianos,            // para lista()
//     reintentable?: false }                       // reintentar() lo rechaza
//   ctx = { progreso(fr ∈ [0,1]), senal: AbortSignal }
//
// El ejecutor tiene que poder correr una unidad desde cero en cualquier
// momento y dar lo mismo (réplicas: C15; partidos: cada uno lleva su
// semilla, decisión 23): así una unidad interrumpida se reinicia sin más.
//
// Persistencia (almacén 'trabajos' de engine/almacen.js, IndexedDB en la
// página): dos clases de registro en el mismo almacén.
//   trabajo    {id, clase:'trabajo', tipo, titulo, params, estado, creado,
//              actualizado, unidades:[{estado, progreso, error?, codigo?}],
//              resumen?, error?, codigo?, visto: 0|1}. Tiene `estado`, así
//              que el índice 'estado' lista los trabajos sin leer los
//              resultados.
//   resultado  {id:`${id}#${i}`, clase:'resultado', trabajo, i, datos}: lo
//              que devolvió la unidad i (sin `estado`: fuera del índice).
// Terminar una unidad escribe su resultado y el trabajo en una sola
// transacción; la copia del trabajo se arma DENTRO de la cola de
// escrituras (con las unidades terminadas antes ya marcadas), así dos
// unidades que terminan juntas no se pisan. Toda escritura del trabajo
// copia el estado de memoria en el momento de escribir, y un trabajo
// borrado no se vuelve a escribir. El progreso de una unidad en curso se
// escribe a lo sumo cada `guardarCadaMs` (y siempre al cambiar de estado).
//
// Estados de un trabajo: pendiente → corriendo → terminado | fallido |
// cancelado. De una unidad: pendiente → corriendo → hecha | fallida.
//   - reanudar() (al abrir la app): los trabajos pendientes o corriendo
//     vuelven a la cola; sus unidades hechas NO se repiten y las que
//     estaban corriendo vuelven a pendiente con progreso 0 (se reinician).
//   - cancelar(id): aborta sus unidades en curso (vuelven a pendiente) y el
//     trabajo queda cancelado; reintentar(id) lo devuelve a la cola sin
//     repetir las hechas (salvo que su ejecutor sea `reintentable: false`:
//     ErrorCola 'no-reintentable'; así las rondas de torneo, cuyo resultado
//     solo vale si el torneo no cambió desde que se armaron).
//   - una unidad que falla (o cuyo resultado no se pudo escribir: código
//     'escritura') deja el trabajo fallido y se abortan sus otras unidades
//     en curso; reintentar(id) repite las que no terminaron. El error se
//     guarda con su texto y, si lo trae, su `codigo` estable (la interfaz lo
//     traduce).
//   - borrar(id): aborta y borra el trabajo y sus resultados. Un id borrado
//     no vuelve (ni por adoptar() ni por una escritura en vuelo).
//   - se guardan como mucho `maxGuardados` trabajos terminados, fallidos o
//     cancelados (los más recientes) además de todos los activos.
// Orden: los trabajos por fecha de alta (FIFO) y, dentro de uno, sus
// unidades en orden; como mucho `paralelo` unidades a la vez en total.
// Avisos: alCambio() en cada cambio (también de progreso: quien escucha lee
// lista() cuando le conviene; lista() usa la `vista` del ejecutor, así no
// copia el ADN de cada trabajo en cada refresco) y alTerminar(trabajo)
// cuando uno termina o falla.
//
// Varias pestañas (C20): ColaCompartida (al final) hace que UNA sola
// pestaña ejecute la cola (la que tiene el lock 'darwinbots2-cola'); las
// demás ven su estado por un canal de difusión ('darwinbots2-trabajos') y
// le mandan sus acciones.

export const ST_TRABAJOS = 'trabajos';
export const ESTADOS = Object.freeze([
  'pendiente',
  'corriendo',
  'terminado',
  'fallido',
  'cancelado',
]);
/** Estados en los que el trabajo está en la cola (se corre o se reanuda). */
export const ACTIVOS = Object.freeze(['pendiente', 'corriendo']);
/** Trabajos cerrados (terminados, fallidos o cancelados) que se guardan. */
export const MAX_GUARDADOS = 20;

/**
 * @typedef {'pendiente' | 'corriendo' | 'terminado' | 'fallido' | 'cancelado'} EstadoTrabajo
 * @typedef {'pendiente' | 'corriendo' | 'hecha' | 'fallida'} EstadoUnidad
 * @typedef {{estado: EstadoUnidad, progreso: number, error?: string, codigo?: string}} Unidad
 * @typedef {{
 *   id: string, clase: 'trabajo', tipo: string, titulo: string, params: any,
 *   estado: EstadoTrabajo, creado: string, actualizado: string,
 *   unidades: Unidad[], resumen?: any, error?: string, codigo?: string, visto: 0 | 1,
 * }} Trabajo
 * @typedef {{progreso: (fr: number) => void, senal: AbortSignal}} ContextoUnidad
 * @typedef {{
 *   unidad: (t: Trabajo, i: number, ctx: ContextoUnidad) => Promise<any>,
 *   final?: (t: Trabajo, datos: any[]) => any,
 *   vista?: (params: any) => any,
 *   reintentable?: boolean,
 * }} Ejecutor
 */

/** Id del registro de resultado de la unidad i. @param {string} id @param {number} i */
export const idResultado = (id, i) => `${id}#${i}`;

/** Error al encolar o al operar con la cola, con código estable. */
export class ErrorCola extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.codigo = codigo;
  }
}

/** Mensaje de un error para guardarlo. @param {unknown} e */
const textoError = (e) =>
  e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);

/** Código estable de un error ('' si no trae). @param {unknown} e */
const codigoError = (e) =>
  e && typeof e === 'object' && 'codigo' in e && typeof e.codigo === 'string' ? e.codigo : '';

/** @param {Trabajo} a @param {Trabajo} b */
const porAlta = (a, b) => a.creado.localeCompare(b.creado) || a.id.localeCompare(b.id);

const idPorDefecto = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Registro de un trabajo nuevo (pendiente, sin guardar). Lanza ErrorCola
 * 'tipo' o 'unidades'.
 * @param {{tipo: string, params: any, unidades: number, titulo?: string}} o
 * @param {{ejecutores: Record<string, Ejecutor>, reloj?: () => Date, nuevoId?: () => string}} d
 * @returns {Trabajo}
 */
export function crearTrabajo(o, d) {
  if (!d.ejecutores[o.tipo]) throw new ErrorCola('tipo', o.tipo);
  const n = Math.trunc(o.unidades);
  if (!(n >= 1)) throw new ErrorCola('unidades', String(o.unidades));
  const ahora = (d.reloj ?? (() => new Date()))().toISOString();
  return {
    id: (d.nuevoId ?? idPorDefecto)(),
    clase: 'trabajo',
    tipo: o.tipo,
    titulo: o.titulo ?? '',
    params: structuredClone(o.params),
    estado: 'pendiente',
    creado: ahora,
    actualizado: ahora,
    unidades: Array.from({ length: n }, () => ({ estado: 'pendiente', progreso: 0 })),
    visto: 0,
  };
}

/**
 * Copia de un trabajo para listarlo: los params pasan por la `vista` del
 * ejecutor (si la tiene), el resto se copia.
 * @param {Trabajo} t @param {Record<string, Ejecutor>} ejecutores
 * @returns {Trabajo}
 */
export function vistaTrabajo(t, ejecutores) {
  const { params, ...resto } = t;
  const vista = ejecutores[t.tipo]?.vista;
  return { ...structuredClone(resto), params: vista ? vista(params) : structuredClone(params) };
}

/**
 * Los datos de cada unidad hecha de un trabajo (null si no terminó), leídos
 * del almacén.
 * @param {import('./almacen.js').OperacionesAlmacen} almacen
 * @param {{id: string, unidades: Unidad[]}} t
 * @returns {Promise<any[]>}
 */
export function leerResultados(almacen, t) {
  return Promise.all(
    t.unidades.map(async (u, i) => {
      if (u.estado !== 'hecha') return null;
      const r = await almacen.get(ST_TRABAJOS, idResultado(t.id, i));
      return r ? r.datos : null;
    }),
  );
}

export class Cola {
  #almacen;
  /** @type {Record<string, Ejecutor>} */
  #ejecutores;
  #paralelo;
  #reloj;
  #nuevoId;
  #guardarCadaMs;
  #maxGuardados;
  #alCambio;
  #alTerminar;
  /** @type {Map<string, Trabajo>} */
  #trabajos = new Map();
  /** @type {Set<string>} ids borrados (no vuelven) */
  #borrados = new Set();
  /** @type {Map<string, AbortController>} clave `${id}#${i}` → unidad en curso */
  #activas = new Map();
  /** @type {Map<string, number>} id → última escritura de progreso (ms) */
  #escrito = new Map();
  /** @type {Promise<unknown>} escrituras en orden */
  #escrituras = Promise.resolve();
  /** @type {Promise<void> | null} */
  #reanudando = null;
  /** @type {Map<string, Array<(t: Trabajo | undefined) => void>>} */
  #esperas = new Map();
  /** @type {Set<string>} trabajos que se están cerrando (un solo cierre) */
  #cerrando = new Set();
  #detenida = false;

  /**
   * @param {{
   *   almacen: import('./almacen.js').Almacen,
   *   ejecutores: Record<string, Ejecutor>,
   *   paralelo?: number,
   *   reloj?: () => Date,
   *   nuevoId?: () => string,
   *   guardarCadaMs?: number,
   *   maxGuardados?: number,
   *   alCambio?: () => void,
   *   alTerminar?: (t: Trabajo) => void,
   * }} o
   */
  constructor(o) {
    this.#almacen = o.almacen;
    this.#ejecutores = o.ejecutores;
    this.#paralelo = Math.max(1, Math.trunc(o.paralelo ?? 1));
    this.#reloj = o.reloj ?? (() => new Date());
    this.#nuevoId = o.nuevoId ?? idPorDefecto;
    this.#guardarCadaMs = o.guardarCadaMs ?? 1000;
    this.#maxGuardados = Math.max(0, o.maxGuardados ?? MAX_GUARDADOS);
    this.#alCambio = o.alCambio ?? (() => {});
    this.#alTerminar = o.alTerminar ?? (() => {});
  }

  /** Unidades a la vez (en total). */
  get paralelo() {
    return this.#paralelo;
  }

  set paralelo(n) {
    this.#paralelo = Math.max(1, Math.trunc(n) || 1);
    this.#bombear();
  }

  /** Unidades corriendo ahora. */
  get enCurso() {
    return this.#activas.size;
  }

  /**
   * Los trabajos conocidos, por fecha de alta, para listarlos (params por
   * la `vista` del ejecutor: sin el ADN). @returns {Trabajo[]}
   */
  lista() {
    return [...this.#trabajos.values()].sort(porAlta).map((t) => vistaTrabajo(t, this.#ejecutores));
  }

  /** Copia completa de un trabajo. @param {string} id @returns {Trabajo | undefined} */
  trabajo(id) {
    const t = this.#trabajos.get(id);
    return t ? structuredClone(t) : undefined;
  }

  /**
   * Lee los trabajos guardados (una vez) y devuelve a la cola los pendientes
   * o a medias: sus unidades hechas se conservan y las que estaban
   * corriendo se reinician. Idempotente.
   */
  reanudar() {
    this.#reanudando ??= (async () => {
      /** @type {Trabajo[]} */
      const todos = [];
      for (const e of ESTADOS)
        for (const r of await this.#almacen.porIndice(ST_TRABAJOS, 'estado', e))
          if (r.clase === 'trabajo') todos.push(r);
      for (const t of todos) {
        if (this.#trabajos.has(t.id) || this.#borrados.has(t.id)) continue;
        this.#trabajos.set(t.id, t);
        if (ACTIVOS.includes(t.estado)) {
          this.#normalizar(t);
          await this.#guardar(t);
        }
      }
      this.#avisar();
      // Uno que terminó todas sus unidades pero no llegó a cerrarse.
      for (const t of [...this.#trabajos.values()])
        if (ACTIVOS.includes(t.estado) && t.unidades.every((u) => u.estado === 'hecha'))
          await this.#cerrar(t);
      await this.#podar();
      this.#bombear();
    })();
    return this.#reanudando;
  }

  /**
   * Toma un trabajo que otra pestaña escribió en el almacén (C20: una
   * pestaña que no ejecuta la cola encola así). No hace nada si ya lo
   * conoce, si fue borrado o si no está.
   * @param {string} id
   */
  async adoptar(id) {
    await this.reanudar();
    if (this.#detenida || this.#trabajos.has(id) || this.#borrados.has(id)) return false;
    const r = await this.#almacen.get(ST_TRABAJOS, id);
    if (r?.clase !== 'trabajo' || this.#trabajos.has(id) || this.#borrados.has(id)) return false;
    this.#trabajos.set(id, r);
    if (ACTIVOS.includes(r.estado)) {
      this.#normalizar(r);
      await this.#guardar(r);
    }
    this.#avisar();
    if (
      ACTIVOS.includes(r.estado) &&
      r.unidades.every((/** @type {Unidad} */ u) => u.estado === 'hecha')
    )
      await this.#cerrar(r);
    this.#bombear();
    return true;
  }

  /**
   * Agrega un trabajo y lo pone en la cola. Devuelve su id.
   * @param {{tipo: string, params: any, unidades: number, titulo?: string}} o
   */
  async encolar(o) {
    const t = crearTrabajo(o, {
      ejecutores: this.#ejecutores,
      reloj: this.#reloj,
      nuevoId: this.#nuevoId,
    });
    await this.reanudar();
    this.#trabajos.set(t.id, t);
    await this.#guardar(t);
    this.#avisar();
    this.#bombear();
    return t.id;
  }

  /** Cancela un trabajo pendiente o en curso. @param {string} id */
  async cancelar(id) {
    const t = this.#trabajos.get(id);
    if (!t || !ACTIVOS.includes(t.estado)) return false;
    this.#abortar(t);
    t.estado = 'cancelado';
    await this.#guardar(t);
    this.#avisar();
    this.#despertar(t);
    await this.#podar();
    this.#bombear();
    return true;
  }

  /**
   * Vuelve a la cola un trabajo fallido o cancelado (sin repetir sus
   * unidades hechas). Lanza ErrorCola 'no-reintentable' si su ejecutor es
   * `reintentable: false`. @param {string} id
   */
  async reintentar(id) {
    const t = this.#trabajos.get(id);
    if (!t || !['fallido', 'cancelado'].includes(t.estado)) return false;
    if (this.#ejecutores[t.tipo]?.reintentable === false)
      throw new ErrorCola('no-reintentable', t.tipo);
    for (const u of t.unidades)
      if (u.estado !== 'hecha') {
        u.estado = 'pendiente';
        u.progreso = 0;
        delete u.error;
        delete u.codigo;
      }
    delete t.error;
    delete t.codigo;
    t.estado = 'pendiente';
    t.visto = 0;
    await this.#guardar(t);
    this.#avisar();
    if (t.unidades.every((u) => u.estado === 'hecha')) await this.#cerrar(t);
    this.#bombear();
    return true;
  }

  /** Borra un trabajo y sus resultados (lo aborta si corre). @param {string} id */
  async borrar(id) {
    await this.reanudar();
    await this.#borrarRegistro(id);
    this.#avisar();
    this.#bombear();
    return true;
  }

  /** Marca un trabajo terminado como visto (la interfaz deja de avisarlo). @param {string} id */
  async marcarVisto(id) {
    const t = this.#trabajos.get(id);
    if (!t || t.visto) return false;
    t.visto = 1;
    await this.#guardar(t);
    this.#avisar();
    return true;
  }

  /**
   * Los datos de cada unidad (null si no terminó), leídos del almacén.
   * @param {string} id
   * @returns {Promise<any[]>}
   */
  async resultados(id) {
    const t = this.#trabajos.get(id);
    if (!t) return [];
    return leerResultados(this.#almacen, t);
  }

  /**
   * Espera a que el trabajo salga de la cola (terminado, fallido, cancelado
   * o borrado: undefined) y lo devuelve.
   * @param {string} id
   * @returns {Promise<Trabajo | undefined>}
   */
  esperar(id) {
    const t = this.#trabajos.get(id);
    if (!t || !ACTIVOS.includes(t.estado)) return Promise.resolve(t && structuredClone(t));
    return new Promise((res) => {
      const l = this.#esperas.get(id) ?? [];
      l.push(res);
      this.#esperas.set(id, l);
    });
  }

  /**
   * Deja la cola quieta para siempre (cerrar la página, tests): aborta lo
   * que corre y no arranca nada más ni escribe (las escrituras que estaban
   * en la cola se descartan). Los trabajos quedan guardados como estaban
   * (otra cola los reanuda).
   */
  detener() {
    this.#detenida = true;
    for (const c of this.#activas.values()) c.abort();
  }

  /** Espera a que se escriba todo lo pendiente en el almacén. */
  async sincronizar() {
    await this.#escrituras;
  }

  // ---- Interno ------------------------------------------------------------------

  /** Un trabajo activo leído del almacén: lo que corría vuelve a pendiente. @param {Trabajo} t */
  #normalizar(t) {
    for (const u of t.unidades)
      if (u.estado === 'corriendo') {
        u.estado = 'pendiente';
        u.progreso = 0;
      }
    t.estado = 'pendiente';
  }

  /**
   * Despierta a quien espera el trabajo con su copia (o undefined si se
   * borró).
   * @param {Trabajo} t @param {boolean} [borrado]
   */
  #despertar(t, borrado = false) {
    const l = this.#esperas.get(t.id);
    if (!l) return;
    this.#esperas.delete(t.id);
    for (const res of l) res(borrado ? undefined : structuredClone(t));
  }

  #avisar() {
    this.#alCambio();
  }

  /**
   * Encola una escritura (en orden). Con la cola detenida no se escribe
   * nada más.
   * @template T @param {() => Promise<T>} fn @returns {Promise<T | undefined>}
   */
  #escribir(fn) {
    const correr = () => (this.#detenida ? undefined : fn());
    const p = this.#escrituras.then(correr, correr);
    this.#escrituras = p.catch(() => {});
    return p;
  }

  /**
   * Guarda el trabajo tal como esté en memoria AL ESCRIBIRSE (no al
   * pedirlo): una escritura vieja no pisa un estado más nuevo, y uno
   * borrado mientras tanto no se escribe.
   * @param {Trabajo} t
   */
  #guardar(t) {
    this.#escrito.set(t.id, Date.now());
    return this.#escribir(async () => {
      if (this.#trabajos.get(t.id) !== t) return;
      t.actualizado = this.#reloj().toISOString();
      await this.#almacen.put(ST_TRABAJOS, structuredClone(t));
    });
  }

  /** #guardar sin esperar ni propagar el error (progreso, arranque). @param {Trabajo} t */
  #guardarLuego(t) {
    this.#guardar(t).catch(() => {});
  }

  /** Aborta las unidades en curso de un trabajo (vuelven a pendiente). @param {Trabajo} t */
  #abortar(t) {
    for (let i = 0; i < t.unidades.length; i++) {
      const c = this.#activas.get(idResultado(t.id, i));
      if (!c) continue;
      c.abort();
      this.#activas.delete(idResultado(t.id, i));
      const u = t.unidades[i];
      if (u.estado === 'corriendo') {
        u.estado = 'pendiente';
        u.progreso = 0;
      }
    }
  }

  /** Borra un trabajo (memoria y almacén) y sus resultados. @param {string} id */
  async #borrarRegistro(id) {
    const t = this.#trabajos.get(id);
    this.#borrados.add(id);
    if (t) {
      this.#abortar(t);
      this.#trabajos.delete(id);
      this.#despertar(t, true);
    }
    const n0 = t ? t.unidades.length : 0;
    await this.#escribir(() =>
      this.#almacen.tx([ST_TRABAJOS], async (x) => {
        const r = t ? null : await x.get(ST_TRABAJOS, id);
        const n = Math.max(n0, r?.unidades?.length ?? 0);
        await x.delete(ST_TRABAJOS, id);
        for (let i = 0; i < n; i++) await x.delete(ST_TRABAJOS, idResultado(id, i));
      }),
    );
  }

  /** Borra los trabajos cerrados que pasan de `maxGuardados` (los más viejos). */
  async #podar() {
    const cerrados = [...this.#trabajos.values()]
      .filter((t) => !ACTIVOS.includes(t.estado) && !this.#cerrando.has(t.id))
      .sort((a, b) => b.actualizado.localeCompare(a.actualizado) || porAlta(b, a));
    const sobran = cerrados.slice(this.#maxGuardados);
    if (!sobran.length) return;
    for (const t of sobran) await this.#borrarRegistro(t.id);
    this.#avisar();
  }

  /** La próxima unidad pendiente de la cola, o null. */
  #siguiente() {
    for (const t of [...this.#trabajos.values()].sort(porAlta)) {
      if (!ACTIVOS.includes(t.estado)) continue;
      const i = t.unidades.findIndex((u) => u.estado === 'pendiente');
      if (i >= 0) return { t, i };
    }
    return null;
  }

  #bombear() {
    while (!this.#detenida && this.#activas.size < this.#paralelo) {
      const s = this.#siguiente();
      if (!s) return;
      this.#correr(s.t, s.i);
    }
  }

  /**
   * Una unidad falló (o no se pudo escribir su resultado): el trabajo queda
   * fallido y se abortan sus otras unidades en curso.
   * @param {Trabajo} t @param {number} i @param {unknown} err
   */
  async #fallarUnidad(t, i, err) {
    if (this.#trabajos.get(t.id) !== t) return;
    const u = t.unidades[i];
    const codigo = codigoError(err);
    u.estado = 'fallida';
    u.error = textoError(err);
    if (codigo) u.codigo = codigo;
    else delete u.codigo;
    this.#abortar(t);
    const cierra = ACTIVOS.includes(t.estado);
    if (cierra) {
      t.estado = 'fallido';
      t.error = u.error;
      if (codigo) t.codigo = codigo;
      else delete t.codigo;
    }
    try {
      await this.#guardar(t);
    } catch {
      // sin almacén: queda fallido en memoria
    }
    this.#avisar();
    if (!cierra) return;
    this.#alTerminar(structuredClone(t));
    this.#despertar(t);
    await this.#podar().catch(() => {});
  }

  /** @param {Trabajo} t @param {number} i */
  #correr(t, i) {
    const ej = this.#ejecutores[t.tipo];
    const clave = idResultado(t.id, i);
    const ctl = new AbortController();
    this.#activas.set(clave, ctl);
    const u = t.unidades[i];
    u.estado = 'corriendo';
    u.progreso = 0;
    t.estado = 'corriendo';
    this.#guardarLuego(t);
    this.#avisar();
    /** ¿Sigue siendo esta la ejecución vigente de la unidad? */
    const vigente = () =>
      !this.#detenida &&
      !ctl.signal.aborted &&
      this.#activas.get(clave) === ctl &&
      this.#trabajos.get(t.id) === t;
    /** @type {ContextoUnidad} */
    const ctx = {
      senal: ctl.signal,
      progreso: (fr) => {
        if (!vigente()) return;
        u.progreso = Math.min(1, Math.max(0, Number(fr) || 0));
        const ult = this.#escrito.get(t.id) ?? 0;
        if (Date.now() - ult >= this.#guardarCadaMs) this.#guardarLuego(t);
        this.#avisar();
      },
    };
    Promise.resolve()
      .then(() => {
        if (!ej) throw new ErrorCola('tipo', t.tipo);
        return ej.unidad(structuredClone(t), i, ctx);
      })
      .then(
        async (datos) => {
          if (!vigente()) return;
          this.#activas.delete(clave);
          try {
            await this.#escribir(async () => {
              if (this.#trabajos.get(t.id) !== t) return; // borrado
              // La copia se arma acá, en la cola de escrituras: las unidades
              // que terminaron antes ya están marcadas en memoria.
              t.actualizado = this.#reloj().toISOString();
              const copia = structuredClone(t);
              copia.unidades[i] = { estado: 'hecha', progreso: 1 };
              await this.#almacen.tx([ST_TRABAJOS], async (x) => {
                await x.put(ST_TRABAJOS, {
                  id: clave,
                  clase: 'resultado',
                  trabajo: t.id,
                  i,
                  datos,
                });
                await x.put(ST_TRABAJOS, copia);
              });
              // En memoria pasa a hecha DESPUÉS de escribir el resultado: si
              // otra unidad cierra el trabajo, no lee un resultado que
              // todavía no está. Cancelado mientras tanto: el resultado queda
              // (no se repite).
              u.estado = 'hecha';
              u.progreso = 1;
              delete u.error;
              delete u.codigo;
            });
          } catch (err) {
            await this.#fallarUnidad(t, i, new ErrorCola('escritura', textoError(err)));
            return;
          }
          if (this.#trabajos.get(t.id) !== t || u.estado !== 'hecha') return;
          this.#avisar();
          if (t.unidades.every((x) => x.estado === 'hecha')) await this.#cerrar(t);
        },
        async (err) => {
          if (!vigente()) return;
          this.#activas.delete(clave);
          await this.#fallarUnidad(t, i, err);
        },
      )
      .catch(() => {})
      .finally(() => {
        if (this.#activas.get(clave) === ctl) this.#activas.delete(clave);
        this.#bombear();
      });
  }

  /** Todas las unidades hechas: resumen del ejecutor y trabajo terminado. @param {Trabajo} t */
  async #cerrar(t) {
    if (!ACTIVOS.includes(t.estado) || this.#cerrando.has(t.id)) return;
    this.#cerrando.add(t.id);
    const ej = this.#ejecutores[t.tipo];
    try {
      if (ej?.final) t.resumen = await ej.final(structuredClone(t), await this.resultados(t.id));
      t.estado = 'terminado';
    } catch (err) {
      t.estado = 'fallido';
      t.error = textoError(err);
      const c = codigoError(err);
      if (c) t.codigo = c;
    } finally {
      this.#cerrando.delete(t.id);
    }
    if (this.#trabajos.get(t.id) !== t) return;
    try {
      await this.#guardar(t);
    } catch {
      // queda cerrado en memoria; la próxima escritura lo lleva
    }
    this.#avisar();
    this.#alTerminar(structuredClone(t));
    this.#despertar(t);
    await this.#podar().catch(() => {});
  }
}

// ---- Varias pestañas (C20) --------------------------------------------------------

export const NOMBRE_LOCK = 'darwinbots2-cola';
export const NOMBRE_CANAL = 'darwinbots2-trabajos';
/** Acciones que una pestaña sin la cola le pide a la dueña. */
const ACCIONES = Object.freeze(['cancelar', 'reintentar', 'borrar', 'marcarVisto']);

/**
 * @typedef {{
 *   postMessage: (m: any) => void,
 *   addEventListener: (tipo: 'message', h: (e: {data: any}) => void) => void,
 *   close: () => void,
 * }} CanalDifusion   la forma de BroadcastChannel
 * @typedef {{
 *   request: (nombre: string, fn: (lock: any) => Promise<any>) => Promise<any>,
 * }} Cerraduras      la forma de navigator.locks
 */

/**
 * La cola de la página con varias pestañas (C20). UNA sola pestaña la
 * ejecuta: la que tiene el lock `darwinbots2-cola` (navigator.locks; lo
 * pide al iniciar y lo retiene mientras vive). Sin `locks` (navegadores sin
 * la API o el pedido falla) ejecuta igual.
 *
 * La dueña publica en el canal `darwinbots2-trabajos` la lista liviana
 * (lista() de la cola, a lo sumo cada `refrescoMs`) y el aviso de cada
 * trabajo que termina. Las demás pestañas:
 *   - muestran esa lista (al abrir, la leen del almacén y la piden);
 *   - encolan escribiendo el trabajo nuevo en el almacén (un registro
 *     nuevo no pisa nada) y avisando {t:'nuevo', id}: la dueña lo adopta
 *     (y si no hay dueña en ese momento, lo toma la próxima al reanudar);
 *   - cancelar, reintentar, borrar y marcarVisto se los PIDEN a la dueña
 *     ({t:'accion'} → {t:'respuesta'}; ErrorCola 'sin-duena' si nadie
 *     contesta en `plazoMs`). Solo la dueña escribe trabajos existentes,
 *     así un borrado no puede resucitar por una escritura de otra pestaña.
 * Si la dueña se cierra (o detener()), suelta el lock después de terminar
 * sus escrituras y la siguiente pestaña en espera pasa a ser la dueña:
 * reanuda la cola desde el almacén (y resuelve ella misma los pedidos que
 * tenía en vuelo).
 */
export class ColaCompartida {
  #o;
  /** @type {Cola | null} */
  #cola = null;
  /** @type {CanalDifusion | null} */
  #canal = null;
  /** @type {(() => void) | null} */
  #soltar = null;
  /** @type {Trabajo[]} */
  #lista = [];
  /** @type {Map<string, {accion: string, id: string, res: (v: any) => void, rej: (e: Error) => void, plazo: any}>} */
  #pedidos = new Map();
  #seq = 0;
  #pestana = Math.random().toString(36).slice(2, 10);
  #detenida = false;
  /** @type {any} */
  #timer = null;
  #paralelo;
  /** @type {Promise<void>} */
  #tomada;
  /** @type {() => void} */
  #alTomar = () => {};

  /**
   * @param {{
   *   almacen: import('./almacen.js').Almacen,
   *   ejecutores: Record<string, Ejecutor>,
   *   locks?: Cerraduras | null,
   *   canal?: (() => CanalDifusion | null) | null,
   *   paralelo?: number,
   *   reloj?: () => Date,
   *   nuevoId?: () => string,
   *   guardarCadaMs?: number,
   *   maxGuardados?: number,
   *   plazoMs?: number,
   *   refrescoMs?: number,
   *   alCambio?: () => void,
   *   alTerminar?: (t: Trabajo, propia: boolean) => void,
   *   alDuena?: () => void,
   * }} o
   */
  constructor(o) {
    this.#o = o;
    this.#paralelo = o.paralelo ?? 1;
    this.#tomada = new Promise((res) => {
      this.#alTomar = res;
    });
  }

  /** ¿Esta pestaña ejecuta la cola? */
  get duena() {
    return !!this.#cola;
  }

  /** La cola local (solo en la dueña). */
  get cola() {
    return this.#cola;
  }

  /** Se resuelve cuando esta pestaña pasa a ejecutar la cola. */
  esperarDuena() {
    return this.#tomada;
  }

  get paralelo() {
    return this.#paralelo;
  }

  set paralelo(n) {
    this.#paralelo = n;
    if (this.#cola) this.#cola.paralelo = n;
  }

  /**
   * Arranca: abre el canal, lee la lista guardada y pide el lock (o toma la
   * cola directamente si no hay locks). Devuelve cuando hay una lista para
   * mostrar.
   */
  async iniciar() {
    const o = this.#o;
    try {
      this.#canal = o.canal?.() ?? null;
    } catch {
      this.#canal = null;
    }
    this.#canal?.addEventListener('message', (e) => this.#recibir(e.data));
    if (!o.locks) {
      await this.#tomar();
      return;
    }
    const pedido = (async () => {
      try {
        await /** @type {Cerraduras} */ (o.locks).request(NOMBRE_LOCK, async () => {
          if (this.#detenida) return;
          await this.#tomar();
          await new Promise((res) => {
            this.#soltar = () => res(undefined);
            if (this.#detenida) res(undefined);
          });
        });
      } catch {
        // la API está pero no deja (p. ej. contexto sin permiso): ejecutar igual
        if (!this.#detenida && !this.#cola) await this.#tomar();
      }
    })();
    void pedido;
    // Mientras tanto (o para siempre, si otra pestaña es la dueña): la
    // lista guardada y la de la dueña.
    if (!this.#cola) {
      await this.#leerGuardados();
      this.#post({ t: 'pedir-lista' });
    }
  }

  /** La lista para mostrar (liviana: params por la vista del ejecutor). */
  lista() {
    return this.#lista;
  }

  /**
   * Agrega un trabajo. En la dueña, a su cola; en otra pestaña, al almacén
   * (y avisa a la dueña). Devuelve su id.
   * @param {{tipo: string, params: any, unidades: number, titulo?: string}} o
   */
  async encolar(o) {
    if (this.#cola) return this.#cola.encolar(o);
    const t = crearTrabajo(o, {
      ejecutores: this.#o.ejecutores,
      reloj: this.#o.reloj,
      nuevoId: this.#o.nuevoId,
    });
    await this.#o.almacen.put(ST_TRABAJOS, t);
    if (this.#cola) {
      // pasó a ser la dueña mientras escribía
      await /** @type {Cola} */ (this.#cola).adoptar(t.id);
      return t.id;
    }
    this.#lista = [...this.#lista, vistaTrabajo(t, this.#o.ejecutores)];
    this.#o.alCambio?.();
    this.#post({ t: 'nuevo', id: t.id });
    return t.id;
  }

  /** @param {string} id */
  cancelar(id) {
    return this.#accion('cancelar', id);
  }

  /** @param {string} id */
  reintentar(id) {
    return this.#accion('reintentar', id);
  }

  /** @param {string} id */
  borrar(id) {
    return this.#accion('borrar', id);
  }

  /** @param {string} id */
  marcarVisto(id) {
    return this.#accion('marcarVisto', id);
  }

  /**
   * Los datos de cada unidad de un trabajo (null si no terminó): los
   * resultados escritos no cambian, así que cualquier pestaña los lee del
   * almacén.
   * @param {string} id
   */
  async resultados(id) {
    if (this.#cola) return this.#cola.resultados(id);
    const t = this.#lista.find((x) => x.id === id);
    return t ? leerResultados(this.#o.almacen, t) : [];
  }

  /**
   * Cierra todo: la cola local se detiene y, cuando terminaron sus
   * escrituras, se suelta el lock (otra pestaña pasa a ser la dueña).
   */
  detener() {
    if (this.#detenida) return;
    this.#detenida = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const cola = this.#cola;
    cola?.detener();
    for (const p of this.#pedidos.values()) {
      clearTimeout(p.plazo);
      p.rej(new ErrorCola('detenida'));
    }
    this.#pedidos.clear();
    try {
      this.#canal?.close();
    } catch {
      // ya cerrado
    }
    this.#canal = null;
    const soltar = () => this.#soltar?.();
    if (cola) cola.sincronizar().then(soltar, soltar);
    else soltar();
  }

  // ---- Interno ------------------------------------------------------------------

  /** Pasa a ejecutar la cola (tiene el lock o no hay locks). */
  async #tomar() {
    if (this.#detenida || this.#cola) return;
    const o = this.#o;
    const cola = new Cola({
      almacen: o.almacen,
      ejecutores: o.ejecutores,
      paralelo: this.#paralelo,
      reloj: o.reloj,
      nuevoId: o.nuevoId,
      guardarCadaMs: o.guardarCadaMs,
      maxGuardados: o.maxGuardados,
      alCambio: () => this.#cambio(),
      alTerminar: (t) => {
        this.#refrescar();
        o.alTerminar?.(t, true);
        this.#post({ t: 'terminado', trabajo: vistaTrabajo(t, o.ejecutores) });
      },
    });
    this.#cola = cola;
    await cola.reanudar();
    this.#refrescar();
    // Los pedidos que esta pestaña tenía en vuelo los resuelve ella.
    for (const [req, p] of [...this.#pedidos]) {
      this.#pedidos.delete(req);
      clearTimeout(p.plazo);
      this.#ejecutarLocal(p.accion, p.id).then(p.res, p.rej);
    }
    o.alDuena?.();
    this.#alTomar();
  }

  /** Lee los trabajos del almacén (una pestaña que no es la dueña). */
  async #leerGuardados() {
    try {
      /** @type {Trabajo[]} */
      const todos = [];
      for (const e of ESTADOS)
        for (const r of await this.#o.almacen.porIndice(ST_TRABAJOS, 'estado', e))
          if (r.clase === 'trabajo') todos.push(r);
      if (this.#cola) return; // ya es la dueña: manda su lista
      this.#lista = todos.sort(porAlta).map((t) => vistaTrabajo(t, this.#o.ejecutores));
      this.#o.alCambio?.();
    } catch {
      // sin almacén: queda la lista que mande la dueña
    }
  }

  /** Cambio en la cola local: refresca y publica, a lo sumo cada refrescoMs. */
  #cambio() {
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#refrescar();
    }, this.#o.refrescoMs ?? 200);
  }

  /** Lista de la cola local → vista propia, aviso y difusión. */
  #refrescar() {
    if (!this.#cola || this.#detenida) return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#lista = this.#cola.lista();
    this.#o.alCambio?.();
    this.#post({ t: 'lista', lista: this.#lista });
  }

  /** @param {any} m */
  #post(m) {
    try {
      this.#canal?.postMessage(m);
    } catch {
      // canal cerrado
    }
  }

  /** @param {string} accion @param {string} id */
  #ejecutarLocal(accion, id) {
    const cola = /** @type {any} */ (this.#cola);
    return Promise.resolve(cola[accion](id));
  }

  /**
   * @param {string} accion @param {string} id
   * @returns {Promise<any>}
   */
  #accion(accion, id) {
    if (this.#cola) return this.#ejecutarLocal(accion, id);
    if (this.#detenida) return Promise.reject(new ErrorCola('detenida'));
    const req = `${this.#pestana}:${++this.#seq}`;
    return new Promise((res, rej) => {
      const plazo = setTimeout(() => {
        this.#pedidos.delete(req);
        rej(new ErrorCola('sin-duena'));
      }, this.#o.plazoMs ?? 5000);
      this.#pedidos.set(req, { accion, id, res, rej, plazo });
      this.#post({ t: 'accion', req, accion, id });
    });
  }

  /** Mensaje de otra pestaña. @param {any} m */
  #recibir(m) {
    if (!m || typeof m !== 'object' || this.#detenida) return;
    if (this.#cola) {
      // la dueña
      if (m.t === 'pedir-lista') this.#post({ t: 'lista', lista: this.#lista });
      else if (m.t === 'nuevo' && typeof m.id === 'string')
        this.#cola.adoptar(m.id).catch(() => {});
      else if (m.t === 'accion' && ACCIONES.includes(m.accion) && typeof m.id === 'string')
        this.#ejecutarLocal(m.accion, m.id).then(
          (valor) => this.#post({ t: 'respuesta', req: m.req, ok: true, valor }),
          (e) =>
            this.#post({
              t: 'respuesta',
              req: m.req,
              ok: false,
              codigo: codigoError(e),
              error: textoError(e),
            }),
        );
      return;
    }
    if (m.t === 'lista' && Array.isArray(m.lista)) {
      this.#lista = m.lista;
      this.#o.alCambio?.();
    } else if (m.t === 'terminado' && m.trabajo) this.#o.alTerminar?.(m.trabajo, false);
    else if (m.t === 'respuesta') {
      const p = this.#pedidos.get(m.req);
      if (!p) return;
      this.#pedidos.delete(m.req);
      clearTimeout(p.plazo);
      if (m.ok) p.res(m.valor);
      else p.rej(new ErrorCola(m.codigo || 'accion', m.error));
    }
  }
}
