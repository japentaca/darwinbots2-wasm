# Frontend nuevo (web2): progreso de la construcción

> **Archivado.** Diario de la construcción de la app nueva (2026-09-29/30);
> no se actualiza. Las decisiones vigentes están en `../PLAN.md`.

Registro del orquestador. Fuente de verdad del alcance: `PLAN.md` (23
decisiones + «Decisiones tomadas durante la construcción»). Fuera de `spec/`.

## Entorno (2026-09-29)

- `main` limpio al empezar (1 commit adelante de `origin/main`: el del plan).
- node v24.11.1 · npm 11.6.2 · cmake 4.0.1 · ninja 1.13.2.
- EMSDK: instalado en `~/emsdk` (emcc disponible) pero sin variable de
  entorno: las verificaciones exportan `EMSDK=C:/Users/jntac/emsdk`.
  `cmake --build --preset wasm` + `node build-wasm/dbtests.js`: 272/272.
- Línea base de smokes (todos en verde): liga 25 · torneos 48 · sorteo en
  cada pelea 31 · copa 55 · suizo 73 · e8 30 · im 44 · formas 21.
- Bocetos del artifact copiados a la carpeta temporal de la sesión
  (`…/scratchpad/bocetos/*.dc.html`), fuera del repo.

## Pasos

| Etapa | Paso | Estado | Archivos | Verificaciones | Pendientes |
|-------|------|--------|----------|----------------|------------|
| E0 | E0.1 andamiaje | cerrado | package.json/lock, vite.config.js, vite-plugin-sitio.js, biome.json, jsconfig.json, index.html, src/ (App, router, i18n, lib, screens), test/ (i18n, claves, router, sitio), .gitignore | npm test 14/14 · biome 0 errores · vite build ok · preview: /, /build-wasm/*, /classic/ 200 | desvío: script test = `node --test "test/**/*.test.js"` (Node 24 no acepta la carpeta) |
| E0 | E0.2 Pages y CI | cerrado | .github/workflows/pages.yml, ci.yml (job web2), web2/scripts/armar-sitio.sh | sitio simulado con el dist real (DB_BUILD_ID=abc1234): nueva en la raíz sin errores de consola, ES/EN ok; /classic/ carga scripts y worker con ?v=abc1234, bots.json y el wasm desde /build-wasm/ | CI real solo al hacer push |
| E0 | E0.3 correcciones de la revisión | cerrado | src/build.js (+test), BarraSuperior (versión en el title del logo), App (document.title), router (hashCorregido + replaceState), vite-plugin-sitio.js (405, Content-Length, error del stream), index.html (aviso bilingüe de carga fallida), armar-sitio.sh (web/ → classic/, limpia destino), ci.yml (paso DB_BUILD_ID=ci-check + grep), caché npm | npm test 18/18 · biome limpio en archivos de E0 · build ok · armar-sitio.sh bajo dash · preview: HEAD wasm con Content-Length, POST 405 | revisión: 0 bloqueantes, 2 importantes (C4 sin uso, /web/ desaparecía) corregidos; desvío: aviso de carga bilingüe fijo (no puede usar t(), corre antes de la app) |
| E2 | exports de solo lectura | cerrado (revisión: 1 bloqueante + 2 importantes, corregidos en E2.1) | port/wasm/dbcore_api.cpp (+622/−8), port/tests/wasm/solo_lectura.mjs | wasm 272/272 · nativo 272/272 · solo_lectura 17/17 (bytes + LCG iguales en 499/1499/2499/2999) · smokes e8 30, im 44, formas 21 | incidente: el agente corrió `taskkill //F //IM node.exe` (mató todos los node); avisado a E1.1/E1.2 |
| E1 | E1.1 worker → engine | cerrado (revisión: 1 importante + 2 menores, corregidos en E1.3) | engine/{worker,sim,imnet,protocolo}.js, test/util/{dbcore-node,arnes-worker}.js, test/paridad_worker.test.js, test/smokes/smoke_{e8,im,formas}.mjs | paridad web/↔engine/: .dbsim byte a byte + frames completos + carga cruzada y 500 ciclos más (45 s) · smokes engine e8 30, formas 21, im 44 | desvíos: cola de mensajes antes del init (la clásica no la tiene); Date/Math.random fijos en la paridad (la clásica mete la fecha en el .dbsim); IM por instancia |
| E1 | E1.2 torneos → engine | cerrado; revisión: 0 bloqueantes; comparación AST 48 funciones idénticas + 27 revisadas a mano; 5 importantes (alga por defecto en mensajesPartido, reglas→opciones sin extraer ni probar, defaults inyectados, base IndexedDB única [→ N1.2], migración que borraba claves de la clásica) → en corrección (E1.3) | engine/{league,torneos,partido,torneos-db}.js, test/paridad_torneos.test.js (19 casos web/ vs engine/ con deepStrictEqual), test/smokes/{rotulos_en,smoke_liga,smoke_torneos,smoke_sorteo_pelea,smoke_copa,smoke_suizo}.mjs | smokes engine = originales: liga 25, torneos 48, sorteo 31, copa 55, suizo 73; salida idéntica con Math.random sembrado igual | engine/ devuelve {clave,params} en vez de texto; textos guardados en archivos quedan como la clásica (compatibilidad de export) |
| E2 | E2.1 correcciones | cerrado | dbcore_api.cpp (VisSnap al encender el acumulador, take por tandas sin perder filas, histogram bins<1 → −1, origin ciclo ≥ 0, madre cadáver = sin dato, sin fila Corpse en origin), solo_lectura.mjs (+carga de .dbsim y seguir, foto vieja, tandas, centinela, sim vacía, apagar/encender), ci.yml job wasm (+solo_lectura) | orquestador: wasm 272/272 · nativo 272/272 · solo_lectura 37/37 (66 s) · `git diff --stat -- core` vacío | CI real al hacer push |
| E1 | verificación conjunta | ok | — | npm test 39/39 · biome 50 archivos limpio · vite build ok · 8 smokes engine + 8 originales en verde | — |
| E1 | E1.3 correcciones de E1.1 y E1.2 | cerrado | engine/worker.js (cola con try/catch por mensaje, base absoluta validada), partido.js (reglasAOpciones, opciones obligatorias, alga por defecto = siembraArranque), torneos.js (deps obligatorias, migración sin borrar claves de la clásica, prefijo darwinbots2.), league.js (LG_NOMBRES configurables, tabla de claves de error), test/paridad_reglas.test.js (lgPlay real de la clásica en vm con DOM mínimo, 8 casos × 2 formatos × 2 semillas), test/util/torneos-deps.js, smoke_liga (sale 2 sin wasm), ci.yml job wasm (+paridad worker y 8 smokes) | orquestador: npm test 102/102 · biome 83 · build ok · 8 smokes engine = originales (torneos 49 vs 48: +1 chequeo de que la nueva no borra claves de la clásica, decisión 17) | — |
| N1 | N1.1 infraestructura de interfaz (sesión, mundo, i18n por área) | revisado: 0 bloqueantes, 3 importantes (promesas de save sin resolver, error de ejecución bloquea el mundo, pointercancel = clic) + menores → en corrección (N1.1b); decodificación y ack verificados en 276 frames reales | src/i18n/{es,en}/{app,mundo}.json (C9), src/lib/sim/{frame,conexion,sesion.svelte,prueba}.js, src/lib/mundo/{camara,color,render-clasico,render-enriquecido}.js + Mundo.svelte, Observar mínima, test/{frame,camara,conexion,render,claves} | npm test 98/98 · biome 82 · build ok · orquestador en Chrome: Observar corre sin errores de consola, a «Máx.» 437 ciclos/s con la pestaña oculta | a velocidad fija la sim se frena con la pestaña oculta (rAF), igual que la clásica; draw 2000 bots ≈ 2 ms (enriquecida) |
| N1 | N1.2b correcciones + setbase (C12) + reset limpio (C15) | cerrado | engine/{sim,worker,opciones,almacen,corridas,torneos,torneos-db}.js, escenarios/{index,fabrica}.js, partido-f1.json; tests nuevos setbase, reproducible, paridad_base, util/clasica-vm.js | orquestador: npm test 184/184 · biome 122 · build ok · 8+8 smokes verdes · reproducible: mismo .dbsim en worker nuevo y usado (control sin limpio difiere) · paridad_base: base clásica = collectOptions completo y mismo .dbsim que la clásica | correlación de getopt va en `req` (id ya es la opción); .dbsim idéntico solo con la misma fecha de inicio (strSimStart); Partido F1 fiel a btnSetF1 (Toroidal y 5 por especie) |
| N1 | N1.1b correcciones de N1.1 | cerrado | src/lib/sim/{conexion,sesion.svelte,frame}.js, src/lib/mundo/** (+claves.js), mundo.json, tests | promesas con plazo y correlación (id/req) + barrera; errorCarga vs avisoError; pointercancel; DPR; centro al redimensionar; teclado; sesion.siguiendo/seguir; conexion.activ/eyeRead/saveConCiclo · npm test 181/181 | claves de la barra quedan en mundo.json (moverlas a observar.json chocaría con N1.3) |
| N1 | N1.3 Observar (paneles, eventos, corrida) | cerrado (correcciones en N1.7); revisión: 2 BLOQUEANTES (corrida-nucleo pierde `limpio:true` del reset; guardar con la sim corriendo desalinea ciclo/historia) + 3 importantes (dna-missing sin atender → corrida retomada diverge; vista clásica inventa especies/extinciones; iniciar y arrancarPorDefecto concurrentes) + menores (errores IndexedDB tragados, textos técnicos sin t(), aria de diálogos, Enter con ocupado) | Observar.svelte, src/lib/observar/** (PanelVivo, GraficoPoblacion, FeedEventos, diálogos Sembrar/Guardar/Corridas, metricas/eventos/bestiario/descargas), src/lib/sim/{corrida-nucleo.js,corrida.svelte.js}, BarraSuperior (chip de estado), observar.json, 3 tests | tests propios 40/40 · build ok · navegador (del agente): guardar en ciclo 25.756 → recargar → retomar → siguió; .dbsim 2,3 MB descargado y recargado; PNG; ES/EN; sin errores de consola | pedidos: mensajes metrics/species_stats en el worker (N2); siembra en caliente como evento de corrida (engine/corridas.js); save con cycle (→ N1.1b); Seguir (→ N1.1b) |
| N1 | N1.7 integración + correcciones de N1.3/N1.4 (+ vite dev, CI) | cerrado | engine/{corridas,sim,worker}.js; src/lib/sim/{conexion,sesion.svelte,corrida-nucleo,corrida.svelte,almacen.svelte}.js; src/lib/observar/{errores.js,…}; src/lib/inspector/**; Observar.svelte; observar.json; tests corrida_worker, worker_modulo, util/sesion-node; ci.yml (job wasm: npm ci + npm test de web2) | npm test 255/255 (con wasm: paridad_worker, reproducible, setbase, paridad_base, corrida_worker, worker_modulo) · biome 147 · build ok · 8+8 smokes · vite dev sirve el worker como módulo | APIs nuevas: sesion.setbase, almacen() único, ciclo()/aplicarEnCiclo(), registrarCambio(diff, ciclo), guardar(nombre,{comoNueva}), sinGuardar(); C17 |
| N1 | N1.5 Experimentar básico (relanzado) | cerrado (N1.5b: aplicarEnCiclo + registrarCambio con ciclo exacto, foto del efectivo, sin «Editar en el mundo», almacen() único, ADN validado, plurales, a11y; test/experimentar_vivo.test.js 371 casos en 5,5 s; npm test 262/262, biome 148, build ok; C18); revisión: 0 bloqueantes; «Aplicar a la actual» = sim nueva con el borrador en 371 casos (opts, 71 costos, base, .dbsim byte a byte) y con worker real; 5 importantes (ciclo del evento inexacto con la sim corriendo; borrador no se actualiza al cambiar de corrida; «Editar en el mundo» sin destino; 2.ª conexión IndexedDB; ADN pegado sin validar) + 9 menores → corrección tras N1.7 (necesita mensaje `ciclo`) | Experimentar.svelte, src/lib/experimentar/{borrador,archivo,propios,estado.svelte}.js + DialogoEspecie/DialogoEscenario, experimentar.json, test/experimentar.test.js (26) | propios 26/26 · biome limpio en sus 10 archivos · build ok | sin toggle Avanzado ni tarjeta Conexión (Nivel 3); lee #/experimentar/<id>; pedidos: sesion.setbase, almacén compartido (→ N1.7) |
| N1 | N1.6 Inicio | cerrado (revisión: 3 importantes + menores, corregidos en N1.6b: await de iniciar/importar, errores por clave, especies solo con vista rica, sinGuardar(), plurales Intl.PluralRules, miniatura vacía vs sin frame, h1/role=alert; tests 27/27, biome limpio, build ok) | Inicio.svelte, src/lib/inicio/** (tiempo, recientes, vista, desde-txt, datos, claves, VistaEscenario, MiniaturaMundo), inicio.json, test/inicio.test.js (15) | propios 15/15 · biome limpio en sus archivos · build ok | contrato: Ajustar → #/experimentar/<id>; bots → #/bots/<nombre>; confirma antes de reemplazar una corrida con ≥1.000 ciclos sin guardar |
| N1 | N1.8 prueba en navegador del orquestador (sitio armado con armar-sitio.sh, :8791) | hecho | — | Inicio: galería y estado vacío ok · Iniciar «Depredador y presa» y «Sopa primordial» → Observar corre, panel/gráfico/eventos vivos, sin errores de consola · selección de bot + Inspector con sus 5 pestañas (agente de diagnóstico, capturas) · Guardar «Prueba orquestador» (ciclo 89) → recargar → EN → Continue → corrida cargada y corriendo (ciclo 159), eventos restaurados · textos en inglés ok | la «falla» de selección era de la herramienta (clic con DPR 0,9 cae a 0,9× la posición); se corrigió un chip que tapaba bots y se pasaron a funciones puras cssAMundo/tolMundo/botEn con 10 tests; hallado: 3 textos visibles mencionan «the original» (catálogo y Partido F1) → N1.9 |
| N1 | N1.9 cierre: textos «original», test de textos visibles, ciclo −1 visible como 0, bucles de ángulos | cerrado | engine/opciones.js, partido-f1.json, experimentar.json, src/lib/sim/ciclo.js (cicloVisible), BarraSuperior/Experimentar/Inicio/Observar, render-clasico.js (normalizarAngulo), inspector/{datos.js,Sentidos.svelte}, test/{textos_visibles,angulos_ciclo}.test.js | tests nuevos verdes; build ok; los 2 fallos de corrida.test.js y el biome de engine/{history,lineage,metricas,sim}.js son del trabajo en curso de N2.1 | PanelVivo → N2.1 |
| N2 | N2.1 métricas en el worker + historia con presupuesto + linaje | cerrado (N2.1b); revisión: 0 bloqueantes, 2 importantes (fundir por bytes agranda → 400–550 puntos con 30 especies; pedido suelto de dominante pierde fotos) + 5 menores → en corrección (N2.1b); layouts de exports y solo lectura verificados; costo +4 % con 4.700 bots | engine/{metricas,history,lineage}.js (nuevos), engine/{sim,worker}.js (mensajes opcionales muestreo/muestra/linaje/dominante), src/lib/sim/{metricas.js,corrida-nucleo.js,corrida.svelte.js}, src/lib/observar/{metricas.js,PanelVivo.svelte}, tests history(12)/lineage(8)/muestreo_worker(4)/corrida_muestras(4) | orquestador: npm test 311/311 · biome 159 · build ok · 8+8 smokes · 50.000 ciclos × 20 especies = 1,43 MB (≤ 5 MB) · motor real extrapolado 0,71 MB · .dbsim igual con y sin muestreo | tope doble: 2.000 puntos y 5 MB; costo del muestreo +5–25 % por tick |
| N2 | N2.1b correcciones de historia/muestreo | cerrado | engine/{history (formato v2),sim,worker,lineage,corridas}.js, corrida-nucleo.js (feed único + migración, ciclo −1), observar/metricas.js, 6 tests | 418/422 (los 4 fallos eran de N2.4b en obra) · biome limpio en sus 13 archivos · build ok · 8 smokes · fusión nunca agranda; resolución pareja (máx ≤ 2× mín); 20 esp.: 501 pts/2,19 MB a 50k | C21 |
| N2 | N2.2 detectores + informe «Corrida» + export CSV/JSON | cerrado (N2.2b: impresión solo-pantalla una columna, A4, paleta sin repetidos, colapso sobre no vegetales robusto a historia fundida, ADN por especie, agruparHallazgos con tope 4 por tipo, plurales Intl, CSV anti-fórmulas, JSON sin ruido float32; npm test 457/457, build ok); revisión: 0 bloqueantes, 6 importantes (impresión a una columna; colores repetidos; colapso ciego con historia fundida; falsos colapsos por algas y resumen sin tope; falso crecimiento del ADN por composición; portada vs configuración) + menores → en corrección (N2.2b); XSS y sin conexión verificados | engine/detectors.js, engine/report/{index,corrida,plantilla,svg,textos}.js + textos.{es,en}.json, engine/export.js, test/{detectores(19),informe(11),exportar(5)}.test.js, util/historia-sintetica.js | informe 50.000 ciclos × 20 especies: 468 KiB, 66 ms; orquestador lo abrió en el navegador: sin URLs externas, resumen enlazado a figuras, gráficos ok | incoherencia vista: «+ 2 cambios» en portada vs «1 parámetro cambiado» |
| N2 | N2.3 Analizar (Panel, Especies, Filogenia, Genética, Eventos) | cerrado (N2.3b: huecos cortan el trazo, ejes alineados, tope 400 real, diff de Myers memorizado 7.200 palabras < 20 ms, tarjeta Hallazgos con detectores, a11y; analizar 21/21 + grafico 17/17, build ok); revisión: 0 bloqueantes, 4 importantes (huecos unidos; ejes desalineados en «Todo»; tope de Filogenia no se cumple; LCS n×m en Genética, 323 ms/207 MB con 7.200 palabras) + menores → en corrección (N2.3b, + tarjeta Hallazgos con detectores) | Analizar.svelte, src/lib/analizar/{Panel,Especies,Filogenia,Genetica,Eventos}.svelte + {catalogo,especies,filogenia,genetica,eventos,fuente}.js + grafico/{Grafico.svelte,escala.js,geometria.js}, analizar.json, test/{analizar,analizar_grafico} (24) | 4 gráficos × 2.000 puntos × 20 especies: 57.643 vértices, 66 ms | pedidos: cargarExtra(id) sin .dbsim; contador de versión de la historia |
| N2 | N2.4 Comparar (dos corridas + réplicas con cola persistente) | cerrado (N2.4b: estadoSemilla = motor en 3.017/3.017 semillas, sin mundos repetidos; valor final crudo; ColaCompartida con navigator.locks + BroadcastChannel; cola arranca en main.js + chip; tope 8 workers; eventos ciclo < 0 al arranque; reinicio de ronda defensivo); orquestador: npm test 460/460 · biome 216 · build ok · 8+8 smokes · port/web, core, spec sin cambios; revisión: 0 bloqueantes, 4 importantes (semillas con el mismo mundo → C19; valor final fundido; dos pestañas corren el mismo trabajo → C20; cola solo se reanuda al abrir Comparar) + menores → en corrección (N2.4b) | engine/{replicas,cola}.js, src/lib/trabajos/{replica,pool,ejecutores,trabajos.svelte}.js + ListaTrabajos.svelte, src/lib/analizar/comparar/**, comparar.json, test/{cola(7),replicas(10),comparar(9),replicas_worker(2)} | npm test 396/396 · biome 213 · build ok · réplica en cola = misma semilla sola; paralelas sin contaminarse; abortada y reiniciada = igual | pedidos: iniciarTrabajos() al arrancar + chip de avisos; evento en ciclo −1 vs 0 |
| N2 | N2.5 Informes (pestaña, plantillas Comparación y Réplicas, export, hallazgos agrupados, ruta a pestaña) | cerrado (N2.5b: defaults tras cargar guardadas, Comparar/Informes sin corrida, vista previa por blob URL, diferencias iguales a la pestaña, nota de mismo mundo, parciales, hash por pestaña, errores por código; informes 32/32, UI 9/9, build ok); revisión: 0 bloqueantes, 2 importantes (arranca con la corrida equivocada; Comparar/Informes no abren sin corrida actual) + 1 probable (enlaces en la vista previa srcdoc) + menores → en corrección (N2.5b); XSS, percentiles, C19 e impresión verificados | engine/report/{comun,comparacion,replicas}.js (+index,corrida,plantilla,svg,textos), src/lib/analizar/informes/{Informes.svelte,datos,guardados,png}.js, src/lib/analizar/ruta.js, informes.json, tests (10 + UI) | npm test 519/519 · biome 244 · build ok · orquestador abrió informe-comparacion.html (167 KB) e informe-replicas.html (114 KB): se ven bien, sin URLs externas | pendiente: DosCorridas.svelte muestra eventos 'objetos' sin texto |
| N3 | N3.1 datos de Bots (biblioteca, versiones, migración del inventario, import/export, historial) | cerrado (N3.1b: clave propia 'p:'+16 hex; porLg/porNombre/adnDeEspecie usados por lanzar.js, corrida.svelte.js y dna-missing; nombres libres vs Bestiary; híbridos iguales con distinto nombre; import agrega versiones o registra conflictos; biblioteca 14/14, migracion 10/10, corrida 28/28; API en la cabecera de engine/bots.js); implementado | engine/{adn,bots,biblioteca,migracion}.js, test/{biblioteca(12),migracion_bots(8)} | npm test 511/511 · build ok · paridad con inventory.js/lab.js/analyze_bots.js en vm (571 hashes, filtros, agrupaciones, híbridos) | pendiente: lanzar.js y corrida.svelte.js buscan propios por lgHash en 'bots' |
| N3 | N3.2 Bots: biblioteca y ficha + migración al arranque | cerrado (N3.2b: foro y almacén por separado, «To the form» con SelectorBot en Observar y Experimentar, homónimos renombrados, a11y; npm test 599/599, biome 296 limpio, build ok); revisión: 0 bloqueantes, 3 importantes (sin almacén no se ve el foro; falta «To the form»: color/vegetal/nombre al sembrar y elegir bot desde Observar/Experimentar; homónimos chocan al sembrar) + 7 menores → en corrección (N3.2b) | Bots.svelte, src/lib/bots/{ruta,estado,lote,textos,adn,etiquetas,datos}.js, biblioteca.svelte.js, migracion.svelte.js, Biblioteca/Ficha/Resumen/Historial + 5 diálogos, bots.json, main.js (migración), test/bots_biblioteca_ui (11) | 556/557 (falta claves editor.* de N3.3 en obra) · build ok · biome limpio en sus 23 archivos | falta «Inscribir en torneo» (espera Competir) |
| N3 | N3.3 editor de ADN, versiones, Probar, laboratorio | cerrado (N3.3b: exacta primero en autocompletar y Enter no reemplaza lo completo, cambios por texto exacto, borrador por bot + beforeunload, Probar con base F1 por defecto y semilla elegible, hijos directos, comentarios '/', CRLF, a11y, resaltado 12,5→2 ms; editor_* 76/76, build ok); revisión: 0 bloqueantes, 3 importantes (autocompletar cambia .aim→.aimdx con Enter; cambios en comentarios no se guardan; se pierde lo editado al salir) + Probar con base clásica no distingue bots (→ F1 por defecto) + menores → en corrección (N3.3b) | engine/lab.js, src/lib/bots/editor/** (14 archivos), src/lib/trabajos/prueba.js + registro, lint-dna en sim.js, editor.json, tests editor_* (24) | npm test 581/581 · biome 0 errores · build ok · 8 smokes · vocabulario (255 sysvars) verificado contra el worker · paridad de laboratorio con lab.js en 600 híbridos · .dbsim igual con y sin lint | «Renumerar» es agregado; Duplicar repetido en la ficha → N3.2b |
| N3 | N3.4 motor de Competir (migración de ligas, rondas en la cola con test de igualdad, repetir y analizar) | cerrado (N3.4b: registro transaccional sobre lo guardado e idempotente por partido, rondas no reintentables, lgReconciliarRondas/lgRefrescar, bloqueos con ronda en curso y con partidos jugados como la clásica, params compactos 5,9→0,2 MB; rondas_cola 10 tests; paridad + 8+5 smokes verdes); revisión: 3 importantes que corrompen datos (ronda reintentada duplica partidos; registro duplicado entre pestañas; S.ronda huérfano bloquea la temporada) + acciones no bloqueadas con ronda en curso + params grandes → en corrección (N3.4b); paridad y escenario del partido = clásica (6/6 reglas) verificados; crash de V8 no reproducido | engine/rondas.js (API), engine/{partido,torneos,migracion,torneos-db}.js, src/lib/trabajos/partido.js, test/rondas (14) + rondas_worker (3) | 594/595 (claves bots.* de N3.2b en obra) · paridad torneos + 8+5 smokes · decisión 23: suizo de 5 y copa de 8 en la cola (3 workers) = secuencia con lgPlayNext | un crash de V8 al terminar workers con wasm en paralelo (test serializado); reglas bloqueadas ahora también en el motor |
| N3 | N3.5 pantalla Competir + informe de Torneo + migración de ligas | cerrado (N3.5b); revisión: 0 bloqueantes, 6 importantes (cancelar ronda desde otra pestaña no libera; «Jugar y mirar» registra partidos alterados en caliente; camino de respaldo no detecta otra sim; migración del roster antes que la de Bots y sin preset; avisos de ronda sin lista; falta pasar las reglas a Experimentar) + menores → corrección tras N3.6 (comparten componentes); informe de Torneo sin XSS verificado; «clásica» en textos = la interfaz /classic/, permitido | Competir.svelte, src/lib/competir/** (estado, migración, asistente, vistas, textos + 15 componentes), competir.json, engine/report/torneo.js, ejecutores/trabajos/ListaTrabajos (receta de rondas), main.js, informes | npm test 635/636 (I4 de tiempo) · biome 324 limpio · build ok · 5 smokes de torneos | marcador flotante (integrar en Observar con el TV) |
| N3 | N3.6 modo TV + Inscribir en torneo + textos pendientes + umbral I4 + filtro de objetos en Eventos | cerrado (N3.6b: reanuda sim en pausa, fin de partido por registros de su liga, región viva única, inert/foco, marcador final en el respiro, I4 con guardas deterministas; npm test 650/650 ×3); revisión: 0 bloqueantes, 3 importantes (colgado en EN VIVO con sim en pausa; fin de partido frágil; anuncios de accesibilidad) + menores → en corrección (N3.6b); paridad del TV con la clásica verificada | src/lib/observar/tv/{maquina,rotulo,tv.svelte}.js + RotuloTv.svelte, Observar.svelte (#/observar/tv), Marcador (integrado), PanelJuego (botón), Ficha (Inscribir), i18n, test/observar_tv (6) | npm test 642/642 · biome 329 limpio · build ok · 5 smokes de torneos | marcador integrado solo en TV |
| N3 | N3.5b correcciones de Competir | cerrado | src/lib/competir/{juego.js (nuevo),torneos.svelte.js,textos,vistas,asistente,Reglas,PanelJuego,Temporadas,Participantes,Estructura,Tabla,EditorFormato}, Competir.svelte, competir.json (+25), ListaTrabajos (ver=false), bots/migracion.svelte.js (promesa), test/competir_juego (8) | 649/650 (I4 de tiempo) · 5 smokes · build ok | pendiente: chip de BarraSuperior a #/competir si los avisos son de rondas |
| N3 | N3.9 Internet Mode (tarjeta Conexión + indicador) | POSPUESTO por el autor (C22); borrador retirado, recuperable de 4b05e1c | src/lib/internet/**, internet.json, montaje en Experimentar.svelte y BarraSuperior | — | — |
| N3 | N3.7 Experimentar avanzado | cerrado (N3.7b: «Ajustes F1» = applyF1Settings de la clásica en paridad, «Cambiar base», rangos por tipo del core con aviso (C23), tarjeta Objetos en ambos modos, a11y; 91/91 tests propios, build ok); revisión: 0 bloqueantes, 3 importantes (sin «Ajustes F1»/cambiar base sobre el escenario actual; rangos del catálogo más estrictos que la clásica; tarjeta Objetos oculta en avanzado) + 7 menores → corrección tras N3.9 (comparten Experimentar.svelte); los 108 parámetros del panel de la clásica están en el catálogo | src/lib/experimentar/{avanzado.js,Avanzado.svelte}, Experimentar.svelte (toggle), experimentar.json (+21 claves), test/experimentar_avanzado.test.js (9) | npm test 479/479 · biome limpio en sus archivos · build ok | aviso: biome --write rompe {@const} en Svelte |
| N3 | N3.8 barra Mundo en Observar | cerrado (N3.8b: deriva del polar en escenario efectivo y aplicar(), CopiaObjetos compacta tras borrar, rama 'objetos' en Comparar, feed, sinGuardar, validez por tipo; mundo_deriva_worker 2/2, mundo_objetos 16/16; los 4 fallos de npm test eran de N3.7b en obra); pendiente menor: filtro de eventos 'objetos' en Analizar; implementado | src/lib/observar/objetos/{ordenes.js,BarraMundo.svelte}, mundoObj.json, engine/corridas.js (evento 'objetos'), corrida-nucleo.js (+3 métodos), Mundo.svelte (modo borrar), Observar.svelte, test/mundo_objetos (11) + mundo_objetos_worker | npm test 503/503 · build ok · réplica con 9 órdenes (incl. azar del motor) = .dbsim de la corrida interactiva byte a byte | pendientes → N2.5: texto de eventos 'objetos' en informes y resumenEvento de Comparar |
| N4 | N4.1 inspector veterano (Player Bot, ojos, findbest, .snp y muertos) | cerrado (N4.1b: indicador opcional pb seguirFoco + pb-focus, heredero seguido, resaltados limpiados al salir, menores; npm test 733/733, paridad_worker 4/4, 8 smokes); revisión: 0 bloqueantes, 1 importante (Player Bot sigue controlando descendientes tras morir el bot y la interfaz dice «ninguno») + menores → en corrección (N4.1b); .snp y registro de muertos idénticos a la clásica (317 y 216 registros) | inspector/{veterano.js,jugador.svelte.js,Abanico,ControlJugador,DisenadorOjos,Inspector,Sentidos}, observar/{IndicadorJugador,MenuInstantanea}, Observar.svelte, conexion/sesion (métodos), Mundo (onPunteroMundo), i18n, test/veterano (13) | npm test 713/713 · biome 350 · build ok · smoke_e8 30 | Player Bot / setmem de ojos no reproducibles (individuales; avisado); Ease of Access como eventos; nota de opts 111/112 desactualizada en opciones.js |
| N4 | N4.2 barrido de parámetros | cerrado (N4.2b: eventos reescritos con fusionarCambios, reiniciadas excluidas y listadas, LectorBarrido con caché incremental, rótulos bool/enum, textos propios; npm test 725/725, biome 351, build ok) — pendiente de ajuste final: código falta-barrido en CODIGOS_ERROR/informes.json; aviso de chunk > 500 kB volvió; revisión: 0 bloqueantes, 3 importantes (eventos en caliente descartados enteros; unidades reiniciadas mezcladas sin aviso; relectura cuadrática de resultados) + menores → en corrección (N4.2b); agregación, reproducibilidad, XSS y compatibilidad verificados | engine/barrido.js, engine/report/barrido.js (+index, textos barrido.*), comparar/{Barrido.svelte,Comparar,lanzar,GraficoBandas,grafico}, ejecutores (barrido = réplicas), comparar.json, tests barrido (8) + worker + informe | npm test 713/713 · biome 349 · build ok | cambios en caliente que tocan el parámetro barrido se filtran; plantilla no ofrecida en Informes (se baja desde Barrido) |
| N4 | N4.3 detectores: sustitución y oscilaciones | cerrado (N4.3b: sin cascada A→C, alias 0,5→1 con 0/930 falsos y 12/12 lentas fundidas detectadas, prefiltro de sustitución 423→9 ms, marcas en el cruce, tope por magnitud, sin doble frase; falta-barrido registrado; npm test 745/745); revisión: 0 bloqueantes, 3 importantes (sustitución en cascada inventada; alias descarta oscilaciones reales fundidas con ruido; costo O(E²·G)) + menores → en corrección (N4.3b, + código falta-barrido); motor real: sin falsos positivos, sustitución Zebedee→Animal detectada |
| N4 | N4.5 chunk principal < 500 kB sin avisos | cerrado (correcciones en N4.6); revisión: 0 bloqueantes, 1 importante (falla silenciosa al cambiar de idioma sin red) + menores → N4.6; detector idéntico, carrera de setIdioma y cache busting verificados; suite 745/745 |
| N4 | N4.6 ajustes finales (aviso de idioma, aviso inmediato, test inestable jugador_pb) | cerrado | i18n/index.svelte.js, BarraSuperior (aviso de idioma), index.html (window.__avisoCarga), app.json, test/{pulido,jugador_pb} | npm test 746/746 ×3 · biome 354 · build sin avisos | jugador_pb esperaba el n-ésimo frame; ahora espera condiciones (dos barreras) | src/i18n/{index.svelte.js,idioma-es.js,idioma-en.js}, observar/{detector-eventos.js,eventos.js}, corrida-nucleo.js (import), test/pulido (+3 guardas) | index 502 → 32 kB; arranque 630 → 241 kB + idioma activo (~145 kB); build sin avisos; npm test 736/736 | test inestable jugador_pb «sin seguirFoco» (pasa solo) → arreglar | engine/detectors.js, report/textos.{es,en}.json, report/corrida.js (marcas), analizar/hallazgos.js, analizar.json, test/detectores_n4 (27) | npm test 713/713 · biome 350 limpio · build ok · calibración: 0 falsos en 2.100 series de ruido, 113/120 ciclos detectados | período mínimo informable = 8× el paso más grueso de la historia |
| N4 | N4.4 pulido: marcador minimizable, chip a Competir, bundle por pantalla | cerrado (N4.4b: chip sigue al texto, recarga única ante vite:preloadError sin corrida en memoria, aviso de versión nueva, marcador con posición real y foco, aria-live por ronda; pulido 20/20, npm test 721/721, build sin avisos, chunk principal 494 kB); revisión: 0 bloqueantes, 2 importantes (chip mixto se contradice; fallos de import() tras deploy silenciosos) + menores → en corrección (N4.4b); estado único de sesión y rutas relativas verificados | App.svelte (pantallas perezosas), main.js, BarraSuperior + trabajos/destino.js, Marcador + competir/marcador.js, app/competir.json, test/pulido (12) | chunk principal 1.216 → 468 kB (carga inicial 596 kB); sin avisos de Vite | fallos ajenos de N4.2/N4.3 en obra |
| N1 | N1.4 Inspector | cerrado (correcciones en N1.7); revisión: 0 bloqueantes, 2 importantes (lecturas de memoria que se cuelan en la consola; trabado en «murió» si el slot se reutiliza) + 6 menores; `? dir` sin efectos (349.200 lecturas → .dbsim idéntico) | src/lib/inspector/** (Inspector + 6 partes + datos/serie/adn/memoria/consola/estado), inspector.json, test/inspector.test.js (14) | tests propios 24/24 · biome limpio en sus archivos · build ok · sin prueba en navegador (pestañas pisadas por otros agentes → C16) | pedidos: montar con inspectorVisible (→ N1.3), exponer Seguir (→ N1.1b); memoria leída con console-cmd '? dir' (a revisar: efectos en la sim) |
| N1 | N1.2 datos del motor (opciones, escenarios, almacén, corridas) | revisado: 0 bloqueantes, 4 importantes (semilla no reproducible en worker usado → C15; C12 vs catálogo; corrida recién guardada podable; stores no atómicos) → en corrección (N1.2b); verificado por el revisor: base clásica = mismo .dbsim que la clásica (300 ciclos) | engine/{opciones,almacen,corridas}.js, engine/escenarios/{index,fabrica}.js + fabrica/*.json (7), torneos-db.js (usa almacen.js), test/{opciones,escenarios,almacen,corridas}.test.js | npm test 98/98 (ida y vuelta de cada opción y costo contra el wasm; Laberinto aplicado en engine/worker.js) · biome 82 archivos · build ok · smokes torneos ok | decisiones C11–C14; pendiente: mensaje `setbase` en el worker (C12) tras E1.3 |

## Cierre de E0

Criterio: «el CI publica en la raíz una cáscara con la navegación de 6
secciones y el aviso, y `/classic/` funciona igual que hoy». Comprobado con
la simulación local de `pages.yml` (`armar-sitio.sh` sobre el `dist/` real,
servido con `python -m http.server`): la raíz muestra las 6 secciones, el
aviso y ES/EN sin errores de consola; `/classic/` carga sus 5 scripts y el
worker con `?v=`, `bots.json` y el wasm de `/build-wasm/` («dbcore.wasm
loaded (in worker)», 571 bots). Pendiente: la corrida real del CI, que solo
ocurre al hacer push (sin commits por mandato).

## Cierre de E1

Criterio: «los smokes de suizo y copa pasan contra `engine/` con los mismos
cruces y resultados que contra `web/`, y una corrida con semilla fija da el
mismo `.dbsim` desde las dos orquestaciones». Comprobado: suizo 73 y copa 55
(y liga, torneos, sorteo, e8, im, formas) con salida idéntica a los
originales salvo la migración de claves (decisión 17); `paridad_torneos`
(19) y `paridad_reglas` comparan con `deepStrictEqual` contra la clásica
cargada en vm; `paridad_worker`: `.dbsim` byte a byte y frames completos
desde `web/worker.js` y `engine/worker.js`, también tras carga cruzada. En CI
(job `wasm`) desde E1.3; corrida real pendiente del push.

## Cierre del Nivel 4 (2026-09-30)

Criterio (definido al cerrar el Nivel 3): los cuatro pedidos hechos, revisados
y verificados. 1) Inspector veterano: Player Bot Mode (con seguimiento del
heredero), diseñador de ojos, «Buscar el mejor», .snp de vivos y registro de
muertos idénticos a la clásica. 2) Barrido de parámetros en Comparar, con
cola, bandas p10–p90, CSV e informe. 3) Detectores de sustitución y
oscilaciones (0 falsos positivos en calibración y con el motor real). 4)
Pulido: marcador plegable, chip de trabajos coherente, carga perezosa,
chunk principal 502 → 32 kB, recarga única ante chunks viejos.
Verificación final del orquestador: npm test 746/746, biome 354 limpio,
vite build sin avisos, 8 smokes contra engine + 8 originales, wasm 272/272,
nativo 272/272, solo_lectura 37/37; port/web, core, spec y Darwinbots2 sin
cambios. Navegador (sitio armado, :8794): Comparar sin corrida, Barrido con
corrida en vivo, /classic/ carga el wasm y 571 bots.

## Cierre del Nivel 3

Criterio: «todo lo que hace la clásica en estas áreas se puede hacer en la
nueva, salvo lo excluido en la decisión 5» (y Internet Mode, pospuesto por el
autor, C22). Áreas: Bots (biblioteca, ficha, editor, Probar, versiones,
laboratorio, migración, import/export), Competir (todos los formatos, Elo,
asistente, rondas en segundo plano, TV, informe de Torneo, migración de
ligas), Experimentar avanzado, barra Mundo. Cada paso revisado contra la
clásica función por función y corregido. Prueba del orquestador en el
navegador (sitio armado con armar-sitio.sh, :8793): Bots (571 bots, ficha de
Zebedee con editor, lint con sugerencia, Probar con base F1), Competir
(sorteo de 8 → Jugar y mirar → Observar con marcador de torneo), Experimentar
avanzado (grupos, base Liga F1, escenario efectivo del partido), Analizar con
datos vivos (Panel, Hallazgos, Especies); sin errores de consola.
Suite al cierre: npm test 650/650, biome 331, build ok, 8+8 smokes, wasm
272/272, solo_lectura 37/37; port/web, core y spec sin cambios.

### Lista de pedidos para el Nivel 4 (define su cierre)
1. Inspector veterano (decisión 15): Player Bot Mode (pb, pb-mouse, pb-keys),
   diseñador de ojos (eye-read/setmem, E8), «Buscar el mejor» (findbest),
   instantáneas .snp de vivos y registro de muertos (snapshot/dead-take).
2. Barrido de parámetros (decisión 10): un parámetro de a a b en k pasos × N
   semillas con la cola de réplicas; gráfico métrica vs. parámetro con banda.
3. Más detectores (decisión 11): sustitución de especie y oscilaciones, con
   textos, informe y tarjeta Hallazgos.
4. Pulido: marcador de torneo minimizable (hoy tapa contenido fuera de
   Competir); chip de la barra a Competir cuando los avisos son de rondas;
   dividir el bundle por pantalla (hoy > 500 kB).
Cierre del Nivel 4: estos cuatro puntos hechos, revisados y verificados.

## Cierre del Nivel 2

Criterio: «en una corrida de 50.000 ciclos, la historia ocupa ≤ 5 MB, el
informe se abre sin conexión y se imprime bien, y los detectores tienen tests
con series armadas a mano (incluido el caso en que no escriben nada)».
- Historia: test de 50.000 ciclos × 20 especies = 501 puntos, 2,19 MB; motor
  real extrapolado 0,71 MB (C21).
- Informe: un solo .html sin recursos externos (tests: ninguna URL http, ids
  enlazados; abierto por el orquestador sin servidor de datos); impresión: CSS
  @media print A4, columna única solo en pantalla, figuras sin cortes (revisado
  en código por dos revisores; no se imprimió físicamente en esta sesión).
- Detectores: 19+ tests con series a mano, incluidos historia vacía, una
  muestra, corrida estable (no escriben nada), algas oscilantes, ruido.
Suite: 542/543 (I4 de tiempo, pasa solo: flaky bajo carga → relajar umbral).
Pendiente: prueba en navegador de Analizar/Comparar/Informes junto con el
cierre del Nivel 3.

## Cierre del Nivel 1

Criterio: «alguien sin experiencia elige un escenario, lo corre, inspecciona
un bot, guarda la corrida y la retoma, todo en español e inglés». Comprobado
en el navegador sobre el sitio armado (N1.8): Inicio → Iniciar escenario →
Observar corriendo sin errores de consola → selección de bot e Inspector con
sus pestañas → Guardar → recargar → EN → Continue → la corrida guardada se
carga y sigue, con sus eventos. Experimentar: «Aplicar a la actual» deja la
sim idéntica a una nueva con el borrador (371 casos contra el motor).
Suite al cierre: npm test 311/311, biome 159 archivos, build ok, 8 smokes
contra engine y 8 originales en verde. Limitación de la herramienta: con
DPR 0,9 los clics por coordenadas caen desplazados; se usó clic por JS.

## Cierre de E2

Criterio: «el test byte a byte del `.dbsim` (con los exports y sin ellos)
pasa en CI y los 143 dorados siguen iguales». En local: `solo_lectura.mjs`
37/37 (bytes y RNG iguales en la corrida principal y tras cargar un `.dbsim`),
272/272 en wasm y nativo, `core/` sin cambios; el paso está en el job `wasm`
de `ci.yml`. La corrida en CI queda pendiente del push.

## Notas para el Nivel 2 (de E2)

Exports (índice de especie = tabla de la vista, `db_sim_vis_species_*`):
- `db_sim_dump_lineage(h,int*,max)` 12 int32/bot: AbsNum, parent, especie, generation, Mutations, BirthCycle, DnaLen, flags(veg,corpse,fixed,multibot), SonNumber, age, genenum, LastMut.
- `db_sim_species_stats(h,float*,max)` 27 floats/especie viva (vivos, vegetales, nrg, body, gen media/mín/máx, mut media/máx, DnaLen media/mín/máx, edad media/máx, hijos, genes, Kills, waste, shell, slime, venom, poison, chloroplasts, color, índice en Specie, multibots).
- `db_sim_species_origin(h,int*,max)` 5 int32: índice, ciclo de registro, primer AbsNum, AbsNum madre, especie madre.
- `db_sim_species_dominant(h,int*,max)` 6 int32: índice, slot, AbsNum, copias, DnaLen, hash FNV-1a.
- `db_sim_metrics(h,float*,max)` 56 floats: Población 0-9, Evolución 10-20, Energía 21-34, Comportamiento 35-43, Entorno 44-55 (tabla en la cabecera del export).
- `db_sim_histogram(h,kind,species,vegMode,bins,float*)` bins+2 floats [mín,máx,bins…]; kind 0 DnaLen,1 gen,2 mut,3 edad,4 nrg,5 body,6 genes,7 hijos,8 Kills.
- `db_sim_behavior_enable(h,on)` / `db_sim_behavior_take(h,float*,max)` 26 floats/especie (disparos por tipo, reproducciones, nacimientos, lazos, shell/slime/venom/poison, muertes, Kills, ticks observados). Requiere `db_sim_vis_observe` tras CADA tick.

Cuidados: tras `load` la tabla de especies se reinicia (guardar la historia por nombre, no por índice); la fila «Corpse» puede aparecer y hay que filtrarla; las réplicas sin dibujar pagan `observe` por tick si quieren el grupo Comportamiento; sin autoespeciación (C7).

## Pendientes detectados

- 19:50: había 4 volcados de depuración `port/web/d_*.bin` (creados 14:17 por un agente, ningún test los genera): borrados; `git status port/web` limpio. Chequear `port/web` al cierre de cada nivel.

- `vite dev` no carga el motor: el worker se sirve como módulo en desarrollo y `engine/worker.js` usa `importScripts` (solo anda con `vite build` + `vite preview`). Arreglar después de N1.1b/N1.2b.

## Reanudación (2026-09-30 06:31)

Verificación: npm test 635/636 (claves que N3.6 dejó sin texto), biome 326 limpio, build ok, 16 smokes verdes. N3.6 había dejado src/lib/observar/tv/{maquina,rotulo}.js. Relanzados: N3.6 (continuación) y la revisión de N3.5.

## Pausa pedida por el usuario (2026-09-30 02:30; retomar a las 06:30)

Cerrados desde el commit 4b05e1c: Nivel 2 completo; N3.1, N3.2, N3.3, N3.4, N3.7, N3.8 (con sus correcciones). Internet Mode pospuesto (C22). Todo sin commit.
Detenidos a mitad (pueden haber dejado cambios parciales):
- Revisión de N3.5 (Competir): sin resultado; iba a reproducir «cancelar en la dueña» con ColaCompartida.
- N3.6 (modo TV, Inscribir en torneo, textos falta-torneo/no-reintentable, umbral I4, filtro de objetos en Eventos): su último paso era «textos y código del punto 3»; revisar qué dejó en Observar.svelte, src/lib/observar/tv/**, Ficha.svelte, Marcador y los json.

Orden al retomar:
1. `verify.sh web2 engine smokes` y mirar qué dejó N3.6.
2. Relanzar la revisión de N3.5 y completar N3.6; corregir lo que salga.
3. Prueba en navegador del orquestador (C16) de todo el Nivel 3 (Bots, editor, Competir con TV, Experimentar avanzado, barra Mundo) y de Analizar/Comparar/Informes; cierre del Nivel 3 (criterio: todo lo de la clásica salvo decisión 5 y C22).
4. Nivel 4 (herramientas avanzadas del inspector incl. Player Bot Mode, barrido de parámetros, más detectores); su cierre lo define la lista de pedidos al terminar el Nivel 3.
5. Entrega final (informe, instrucciones locales, git status).

## Commit y reanudación (2026-09-30)

El usuario pidió commit del estado detenido: `4b05e1c` en main (sin push). Al retomar, verificación igual a la del commit (518/519 por src/lib/internet/ a medio hacer; 16 smokes verdes). Relanzados: N3.1b, N3.8b, N3.9 y la revisión de N2.5.

## Detención pedida por el usuario (2026-09-30 00:45)

Estado del árbol antes de lanzar lo último: npm test 518/519 (falla «claves literales» por src/lib/internet/ a medio hacer), biome 2 errores (formato de src/lib/internet/{TarjetaConexion.svelte,tarjeta.js}), build ok.

Detenidos a mitad (pueden haber dejado cambios parciales; verificar al retomar):
- N3.1b identidad de bots propios (engine/{adn,bots,biblioteca,migracion}.js, lanzar.js, corrida.svelte.js, resolución de ADN en corrida-nucleo.js).
- N3.8b correcciones barra Mundo (último paso visto: «escenarios index y corrida-nucleo»; tocó src/lib/observar/objetos/**, Mundo.svelte, quizá DosCorridas.svelte).
- N3.9 Internet Mode (src/lib/internet/** sin i18n ni montaje).
- Revisión de N2.5 (sin resultado).
Antes, por límite de uso de la API (2026-09-29 ~23 h), se cortaron: N3.2 (dejó solo src/lib/bots/ruta.js), N3.3 (dejó `lint-dna` en engine/sim.js y su doc en engine/worker.js; sin editor ni engine/lab.js).

Orden al retomar:
1. `verify.sh web2 engine smokes`; revisar qué dejaron N3.1b, N3.8b y N3.9 (rehacer o completar).
2. N3.1b completo → luego N3.2 (biblioteca y ficha) y N3.3 (editor, Probar, laboratorio) sobre la API nueva.
3. N3.8b y N3.9 completos; después N3.7b (correcciones de Experimentar avanzado: Ajustes F1/cambiar base, rangos, tarjeta Objetos en avanzado).
4. Revisión de N2.5 y cierre del Nivel 2 (criterio: historia ≤ 5 MB en 50.000 ciclos — test pasa; informe sin conexión e imprimible; detectores con tests incl. silencio).
5. Resto del Nivel 3: torneos (migración de darwinbots-ligas, ejecutor de partidos en la cola con test de igualdad, pantallas de Competir, TV, informe de Torneo), y Nivel 4.

## Reanudación (2026-09-29 18:07)

Verificación al retomar: npm test 184/184 · biome 122 · build ok · 8 smokes engine + 8 originales verdes. N1.5 no había dejado archivos. Lanzados en paralelo: N1.7 (integración y correcciones de N1.3/N1.4), N1.5 (Experimentar básico) y N1.6 (Inicio), con archivos disjuntos.

## Siguiente (pausa pedida por el usuario el 2026-09-29 14:48; retomar después de las 18 h)

Estado al pausar: E0, E1, E2 cerrados; N1.1, N1.1b, N1.2, N1.2b cerrados;
N1.3 y N1.4 implementados y revisados, con correcciones pendientes. N1.5
(Experimentar básico) se lanzó y se DETUVO a mitad: sus archivos parciales
(src/screens/Experimentar.svelte, src/lib/experimentar/**, experimentar.json,
tests suyos) hay que revisarlos o rehacerlos antes de seguir.

Orden al retomar:
1. Verificar el árbol (`verify.sh web2 engine smokes`), mirar qué dejó N1.5.
2. Encargo de integración y corrección (un agente, archivos de src/lib/sim/corrida*,
   src/screens/Observar.svelte, src/lib/observar/**, src/lib/inspector/**):
   - N1.3 bloqueantes 1 y 2, importantes 3–5 y menores (ver fila N1.3).
   - N1.4 importantes (barrera en lecturas de memoria; slot reutilizado) y menores.
   - Integrar: Seguir (sesion.siguiendo/seguir → Inspector), saveConCiclo en
     guardar/exportar, c.activ/c.eyeRead en el Inspector, fusionarCambios en
     escenarioEfectivo, siembra en caliente como evento de corrida.
   - `vite dev` no carga el worker (importScripts en worker módulo).
   - CI: sumar al job `wasm` los tests de web2 que necesitan wasm (npm ci + npm test).
3. Retomar N1.5 (Experimentar básico) y N1.6 (Inicio) en paralelo.
4. Prueba en navegador del orquestador (C16) y cierre del Nivel 1 en ES y EN.
5. Nivel 2 → 3 → 4.
