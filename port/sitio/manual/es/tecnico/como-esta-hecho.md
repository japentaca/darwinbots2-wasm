---
titulo: Cómo está hecho el port
resumen: "La historia técnica del port: la spec que describió al original, el motor reescrito en C++ y compilado a WebAssembly, las dos interfaces web y cómo se prueba y se publica todo."
etiquetas: [arquitectura, webassembly, spec, tests, despliegue]
estado: revisada
---
Esta página es para quien se pregunta qué hay detrás de la app: de dónde
salió el motor, cómo se lo reescribió para el navegador y cómo se arma
este sitio. No necesitás nada de esto para usar DarwinBots (arrancá por
[[empezar/que-es]]), pero si tenés curiosidad, acá va el mapa completo.

## El original {#original}

DarwinBots nació como un programa de escritorio para Windows, escrito en
Visual Basic 6: un único ejecutable con la simulación, el editor y los
gráficos, de más de 53 000 líneas de código. Carlo Comis lo creó en Italia
en 2002 y 2003, y durante más de una década lo mantuvo su comunidad:
Purple Youko y Numsgil, Eric Lockard (EricL), los miembros del foro y
Botsareus. La versión que corre acá es la **2.48.32**, la última de esa
línea. Quiénes son todos estos, con nombres y fechas, está en
[[tecnico/creditos]].
<!-- README.md §Historia, §Qué hay en este repositorio -->

Visual Basic 6 es tecnología de otra época: sus programas ya no corren
en Windows moderno. Este repositorio existe para que el trabajo de esa
comunidad no quede inaccesible.
<!-- README.md §Qué hay en este repositorio -->

## El port, paso a paso {#el-port}

El port se hizo en tres pasos, y en este orden:

1. **Entender y escribir la spec.** Antes de escribir una línea del
   motor nuevo, el fuente original se leyó línea por línea y se lo
   describió por completo: el orden exacto del ciclo, la máquina que
   ejecuta el ADN, las 247 direcciones de memoria con nombre, la física,
   la visión, los disparos, los lazos, los virus, la reproducción, las
   mutaciones, el mundo y los formatos de archivo — y también el
   catálogo de los bugs del original. Esa descripción vive en la carpeta
   `spec/` del repositorio.
   <!-- README.md §Qué hay en este repositorio; spec/PLAN.md §Principio rector -->
2. **Reescribir el motor en C++.** Con la spec escrita, el motor se
   reescribió en C++20, subsistema por subsistema, y se compiló a
   WebAssembly para que corra en el navegador.
   <!-- port/README.md §Estado (M1..M9); README.md §Qué hay en este repositorio -->
3. **La web.** Sobre el motor compilado se armó primero la interfaz
   clásica; después, la app nueva que describe este manual; y por último
   este sitio, con el manual generado.
   <!-- port/README.md §Estado (M10); port/web2/PLAN-SITIO.md §Despliegue -->

El orden no es casual. Reescribir un motor de 53 000 líneas «a ojo»
habría dado un simulador _parecido_, no el mismo. La spec convirtió la
pregunta «¿qué hace esto?» en una respuesta verificable antes de que
existiera el port, y cada pieza del motor nuevo se escribió contra ella.
<!-- spec/PLAN.md §Principio rector -->

## La arquitectura de hoy {#arquitectura}

La pieza central es el motor: una biblioteca en C++ sin interfaz, que no
sabe dibujar ni tocar el disco. Se compila con Emscripten a un archivo
WebAssembly (`dbcore.wasm`), un formato que el navegador ejecuta en tu
propia máquina. Para vos eso significa tres cosas: no instalás nada, la
simulación corre en tu equipo (no en un servidor) y las dos interfaces
usan exactamente el mismo motor.
<!-- README.md §Estado (la física y el RNG viven en dbcore.wasm); port/README.md §Build -->

```
   Darwinbots2/  el fuente original (VB6, solo lectura)
         │    se leyó y se describió en
   spec/       la especificación + los casos dorados
         │    se reescribió en C++ y se compiló
   port/core ─── Emscripten ──▶ dbcore.wasm (un solo archivo)
                                    │ corre dentro de un Web Worker
                ┌──────────────────┴──────────────────┐
         la app nueva (/app/)               la clásica (/classic/)
                └── comparten el wasm y el Bestiario ───┘
```

Hacia afuera, el motor expone una API chica y explícita: crear una
simulación y avanzarla ciclo a ciclo, fijar los parámetros, sembrar
especies, pedir el estado de todo para dibujar, guardar y cargar. Los
archivos (ver [[tecnico/formatos]]) viajan por memoria, no por disco:
el motor empaqueta y desempaqueta los bytes, y quien lo llama decide
dónde guardarlos.
<!-- port/README.md §Estado (M10: la API completa hacia JS) -->

La simulación corre en un _Web Worker_, un hilo aparte del navegador:
por más pesado que sea el ciclo, la página nunca se congela, y cada
cuadro pasa a la interfaz como un único búfer listo para dibujar. La
regla del proyecto es terminante: la capa de presentación nunca
recalcula física ni azar, solo muestra lo que el motor vuelca. Por eso
la app nueva y la clásica, siendo tan distintas, dan corridas idénticas.
<!-- port/README.md §Página web (worker, ArrayBuffer transferible); README.md §Reglas (4) -->

Encima del motor hay dos interfaces. La **clásica** fue la primera
versión web: más parecida al programa original y en inglés; hoy está
congelada y se publica en `/classic/` (ver [[app/clasica]]). La **app
nueva** es la que describe este manual: en español e inglés, con
corridas, análisis, editor y torneos (ver [[empezar/recorrido]]). Las
dos comparten el mismo wasm y el mismo **Bestiario**: los bots de la
comunidad, indexados con su perfil y sus genes, que la biblioteca
ofrece para sembrar (ver [[app/bots]]).
<!-- port/web2/PLAN.md decisiones 1 y 5; port/README.md §Bestiary; .github/workflows/sitio.yml (/build-wasm/ compartido) -->

El **manual** que estás leyendo también se genera. Las páginas están
escritas a mano, pero las fichas de cada sysvar, cada operador y cada
parámetro salen de los datos de la spec, y un generador en Node produce
HTML estático: cada página es un archivo que se lee sin JavaScript. Solo
el buscador y el selector de tema usan unas pocas decenas de líneas. Los
bloques de ADN del manual se colorean con el resaltador del editor, pasan
el mismo lint que tus bots y llevan su botón «Copiar», para pegarlos en el
editor de la app.
<!-- port/web2/PLAN-SITIO.md S5, S6, S9; port/sitio/plantilla/manual.js (botón «Copiar» de los bloques adn; la ruta «Abrir en la app» queda para más adelante, S-D) -->

## La spec, árbitro del port {#la-spec}

La spec no es documentación de cortesía: es el contrato. Se escribió
_del_ fuente original y _antes_ del motor nuevo, con una regla de oro:
**el fuente es la spec**. Nada de interpretar de memoria ni recurrir al
wiki; ante la duda, se volvía al fuente. Y el fuente original es de
solo lectura: sigue intacto en el repositorio, como autoridad última
para cualquier desempate.
<!-- spec/PLAN.md §Principio rector; README.md §Qué hay en este repositorio, §Reglas (1) -->

Su herramienta principal son los **casos dorados**: tests con el
resultado esperado exacto, escritos _antes_ de la implementación de
cada subsistema. El ciclo de trabajo era siempre el mismo: el caso
dorado en rojo → la implementación, transcripta del fuente citando las
líneas → el caso en verde → recién ahí, commit. Los casos cubren desde
el redondeo bancario de Visual Basic hasta el orden global de los
sorteos dentro de un ciclo, y la suite entera se corre en tres
compilaciones distintas del motor. Y cuando la spec misma tenía una
errata, no ganaba la spec: ganaba el fuente, y la spec se corregía.
<!-- README.md §Reglas (2); port/README.md §Estado; spec/PROGRESO.md -->

## Cómo se comprueba que está bien {#como-se-prueba}

- **La suite del motor.** 272 casos y 4126 aserciones en verde en tres
  modos: dos compiladores nativos y WebAssembly bajo Node, sin una sola
  divergencia numérica. Que la suite dé idéntico en el navegador y
  nativo es la garantía de que lo que corre en tu equipo es el motor
  que se verificó.
  <!-- README.md §Estado; port/README.md §Estado (2026-09-29) -->
- **El CI en cada push.** En cada push y cada PR, GitHub Actions corre
  la suite entera, los tests de la app, el lint y el build, y comprueba
  además que el fuente original siga intacto, byte a byte.
  <!-- .github/workflows/ci.yml -->
- **La regla de fidelidad.** Los bugs del original solo se corrigen si
  el lenguaje del ADN no cambia: un bot existente tiene que seguir
  significando lo mismo. Las 35 correcciones, con su única excepción,
  están documentadas una por una en [[tecnico/diferencias]].
  <!-- README.md §Reglas (3), §Estado -->
- **El azar determinista.** La misma semilla da la misma corrida, ciclo
  a ciclo; cómo funciona está en [[tecnico/semillas]].
- **Hasta el Bestiario sirvió de prueba.** Cada bot de la colección se
  validó con el propio motor portado: cargarlo, sembrarlo y correrlo 50
  ciclos.
  <!-- README.md §De dónde salen los bots de la demo; re-corrido con uno al azar (Animal_Minimalis_mod_stress: carga, siembra y corre 50 ciclos sin avisos) -->
- **Y el manual mismo.** Al generarse, el build falla si hay un enlace
  roto, si la referencia no cubre todas las sysvars y todos los
  operadores que el editor conoce, o si un bloque de ADN del manual
  tiene avisos del lint.
  <!-- port/web2/PLAN-SITIO.md S-B y S12; port/web2/test/manual.test.js -->

## Cómo se construye y se publica {#el-sitio}

El sitio `darwinbots-wasm.org` se arma y se publica solo, en cada push a
la rama principal:
<!-- README.md (nota inicial); .github/workflows/sitio.yml -->

1. Se compila el motor a WebAssembly — una sola vez: las dos interfaces
   comparten el mismo archivo.
2. Se construye la app nueva y se genera el manual. Si algo falla — un
   enlace roto, un bloque de ADN con avisos —, no hay sitio.
3. Se arma el paquete completo: la portada, `/manual/`, `/app/`,
   `/classic/` y el wasm en `/build-wasm/`.
4. Se publica en Cloudflare Pages, que sirve el dominio.
   <!-- .github/workflows/sitio.yml (build + deploy con wrangler, proyecto darwinbots-wasm) -->

Los secretos de publicación viven en GitHub, en un entorno que solo
acepta despliegues de la rama principal; nadie sube nada a mano. Los
cambios llegan por PR: el repositorio es público, cualquiera puede
proponer el suyo desde su copia, y el CI lo prueba entero antes de que
se integre.
<!-- port/web2/PLAN-SITIO.md §Despliegue y §Quién puede desplegar; .github/workflows/ci.yml (pull_request) -->

Si querés mirar el trabajo de cerca, el repositorio conserva las tres
capas en orden de derivación: el fuente original sin tocar, la spec que
lo describe y el port que la implementa. Este manual, la app y el motor
que descargás al abrir el sitio salen todos del mismo árbol.
<!-- README.md §Qué hay en este repositorio -->
