---
titulo: Diferencias con el 2.48.32 original
resumen: "Qué se corrigió del programa original, qué se dejó igual a propósito y con qué certeza se resolvieron las dudas que el original dejó abiertas."
etiquetas: [diferencias, original, correcciones, fidelidad, port]
estado: revisada
---
Esta es la página a la que remite el manual cada vez que dice «así era en el
original». El motor de esta versión es el del DarwinBots 2.48.32, traducido: los
mismos números, el mismo orden de ciclo y las mismas reglas. Lo que cambia son
los errores del programa original, corregidos a propósito, y nada más.

Acá está el criterio con el que se decidió cada corrección, las correcciones
agrupadas por tema (con un enlace a la página que las explica en detalle), lo
que se dejó igual a propósito y las dudas que el original dejó abiertas.

## El criterio {#criterio}
<!-- port/README.md §Bugs del original corregidos (párrafo intro: sin cambiar el lenguaje del ADN, un bot existente sigue cargando y ejecutando lo mismo; las estadísticas de la sim sí cambian) -->

La regla fue corregir sin cambiar el lenguaje: el cargador, la ejecución del
ADN, los operadores y el significado de cada sysvar quedaron como estaban, así
que un bot escrito para el original carga y corre lo mismo que siempre. Se
corrigieron 35 errores, que a grandes rasgos caen en tres familias:

- **de cálculo**: algo se calculaba mal o se destruía en vez de transformarse
  (la energía del _shock_, la potencia de un virus);
- **de límites**: un tope mal puesto o faltante (un valor que se congelaba,
  otro que se salía del rango de 32000);
- **de comparación y borde**: algo se comparaba contra la celda equivocada o
  en el borde del mundo no pasaba lo que debía (la protección del hijo recién
  nacido, un teleporter que no se movía).

Lo que no se tocó: el **balance** (los costos, la economía de la energía, la
fotosíntesis, los topes de población), las **reglas del mundo** (los sorteos y
su orden: el ciclo sigue siendo el ADN → se borran los sentidos → los
disparos → fuerzas y choques → movimiento → acciones → nacimientos y muertes
→ el sol) y las **funciones** del motor, que se portaron enteras aunque la
app no exponga alguna. Corregir un bug no es rediseñar: si una rareza formaba
parte del juego que conoció la comunidad, se quedó
(ver [[tecnico/diferencias#igual]]).

:::nota
**La única excepción, decidida a conciencia, es el `else` que sigue a un
`start`** ([[tecnico/diferencias#adn]]): en el original su cuerpo nunca corría, y varios bots
clásicos del Bestiario lo usan contando con que sí. Las demás correcciones
cambian las cifras de una simulación (energía, disparos, repoblación, azar
consumido); esta además cambia lo que hacen algunos bots viejos.
<!-- port/README A2-1 (else tras cond…start: la única excepción; 9 bots del Bestiario lo usan) -->
:::

Por eso una simulación acá no da exactamente los mismos números que en el
original con la misma semilla: cualquier corrección en el azar consumido
separa las dos corridas para siempre. Lo que sí se mantiene es la
repetibilidad dentro de esta versión: la misma semilla da la misma corrida,
siempre (ver [[tecnico/semillas]]).

Hubo además una revisión uno a uno contra el fuente original que corrigió
desvíos propios de la traducción — redondeos y promociones numéricas — para
que los números salgan como salían.
<!-- REVISION-PORT.md (pilotos 1-14: RV-01 a RV-45, divergencias del port corregidas) -->

### Lo que no es corrección del original {#host}

No todo lo que notás distinto viene del original: la app y el sitio tienen su
propia capa, y sus arreglos no cuentan como correcciones.

- **Las especies que siembra la app nacen con las mutaciones encendidas.** Era
  un defecto de la propia versión web, ya corregido; no existía en el programa
  de Windows.
  <!-- PLAN-SITIO.md §S-C cap. 3 (bug del host, corregido el 2026-10-04: las especies sembradas nacían con la tabla de mutaciones vacía) -->
- **El cargador acepta los finales de línea de los archivos del Bestiario.**
  El original solo leía los suyos; varios bots del foro, tal como están, ahí
  no cargaban. Es una decisión propia del port.
  <!-- REVISION-PORT.md RV-04 (el cargador tolera LF; los bots del Bestiario son solo-LF) -->
- **La interfaz es otra.** La app nueva no es el programa de Windows; la más
  parecida es la [[app/clasica]]. Ver [[empezar/preguntas#diferencias]].

Nada de esa capa escribe en la simulación: una corrida guarda y carga igual
con cualquier vista encendida o apagada.

## El ADN y su ejecución {#adn}

```adn
' En el original, el else nunca corria: la direccion 60 quedaba en 0
cond
 *50 0 >
start
 1 60 store
else
 2 60 store
stop
```

Con la 50 en 0, este bot escribe 2 en la 60: el `else` corre cuando las
condiciones del gen son falsas, como prometía la ayuda del original. Ahí
estaba el error más incómodo del 2.48.32: el cuerpo de un `else` tras un
`start` no se ejecutaba **nunca**, cierta o falsa la condición, aunque la
documentación decía lo contrario. Acá corre, y la numeración de los genes no
cambia. Los bots del Bestiario que lo usan — Lionfish, Zer0Bot, TRON_F1 y
varios de Moonfisher — se comportan como sus autores esperaban, no como el
programa los dejó comportarse. El detalle, en [[adn/genes#else]] y
[[operadores/else]].
<!-- port/README A2-1; probado con probar-adn: *50 en 0 escribe 2, en 5 escribe 1; re-corrido por el revisor: idéntico (60 = 2 con *50 en 0, 60 = 1 con *50 en 5) -->

Una más de la misma familia:

- Un archivo hecho solo de `def`, sin un solo gen, trababa una parte de cada
  ciclo de la simulación entera. Acá el bot simplemente vive sin hacer nada
  ([[adn/def#rarezas]]).
  <!-- 20-VM §2.3 y §14 (bomba de tick: error 9 cada ciclo); port: comportamiento definido -->

## Disparos y virus {#disparos}
<!-- port/README B3-1, B3-2, B3-5, B3-6, B3b-1, B3b-2, B3b-3 -->

- **La protección del hijo recién nacido funciona.** En el original se
  comparaban mal los números de los bots, así que un padre que estaba
  disparando le pegaba a la cría que acababa de tener, casi siempre. Acá el
  hijo es inmune a los disparos de su padre durante sus dos primeros ciclos
  de vida. Lo medimos: un padre que dispara de frente y se reproduce deja al
  hijo en la línea de fuego, y los disparos lo cruzan sin tocarlo; el primer
  golpe llega después, cuando la protección ya no vale.
  <!-- port/README B3-1; probado con probar-adn: el hijo no pierde energia los primeros ciclos; primer -1 en el ciclo 6 -->
- **Un disparo de un bot muerto pega igual.** Si el tirador muere y su lugar en
  la lista lo ocupa otro bot, en el original el disparo que seguía volando no
  podía golpear al nuevo ocupante de ese lugar. Acá golpea a quien sea, y las
  muertes que causa se acreditan al tirador real, no a quien haya quedado en
  su casillero.
  <!-- port/README B3-2 -->
- **Gana el golpe más temprano.** Si dos bots se cruzan en el mismo tramo del
  mismo disparo, gana el que el disparo alcanza primero; en el original ganaba
  el de índice más bajo o el último, según el caso.
  <!-- port/README B3-5 -->
- **Los desechos que llegan por disparo se tapan en 32000** al momento, sin
  dejar pasar un pico por arriba.
  <!-- port/README B3-6 -->

Los virus tenían tres: **dispararlos se cobraba dos veces** (acá una);
**la potencia dependía del número del gen copiado** (copiar el gen 7 contagiaba
siete veces más fuerte que el gen 1); y **atravesar la baba fortalecía al
virus** en vez de gastarlo. Las tres están corregidas, y por eso la baba
protege mucho más que en el original ([[simulacion/virus]]). El mecanismo de
disparos completo está en [[simulacion/disparos]].

## Energía, cuerpo y cloroplastos {#energia}
<!-- port/README A1-1, A3-7, A3-10, B6-2, B6-4 -->

- **El _shock_ convierte la energía en cuerpo.** Un bot que pierde de golpe
  más de la mitad de su energía, quedando todavía con más de 3000, debería
  volcar todo lo que le queda al cuerpo; el original la destruía en el camino.
  Medido: 10000 de energía y una compra de 6000 cloroplastos dejan un cadáver
  con 1400 de cuerpo; en el original el cadáver quedaba en 1000, sin la
  energía convertida ([[simulacion/energia#shock]]).
  <!-- port/README A1-1; probado con probar-adn: 10000 nrg, 6000 .mkchlr con costo 1 → cadaver con 1400 de cuerpo -->
- **El cuerpo del hijo es la parte exacta.** En el original se redondeaba a
  entero: con 501 de cuerpo y un parto al 50 %, el hijo quedaba con 250. Acá
  250,5, y el padre con 250,5 ([[simulacion/reproduccion#reparto]]).
  <!-- port/README B6-4; probado con probar-adn: 1000.5 de cuerpo → dos bots con 500.25 -->
- **Una orden negativa de engordar o adelgazar se ignora.** Escribir un
  número negativo en `.strbody` o `.fdbody` ya no hace nada raro: se borra sin
  efecto.
  <!-- port/README A3-7 -->
- **Quitar cloroplastos con un número negativo ya no los compra.** En el
  original, `rmchlr` con −100 agregaba 100 cloroplastos.
  <!-- port/README A3-10 -->
- **La lotería de los vegetales apretados es una en once también en la
  reproducción sexual.** En el original, la sexual usaba una en diez
  ([[simulacion/cloroplastos#tope]]).
  <!-- port/README B6-2 -->

## Sentidos y visión {#sentidos}
<!-- port/README A3-1, A3-2, A3-3, A3-4, A3-5, B2-1, B2-3, B2-4, B2-5 -->

Cinco de los sentidos de siempre:

- [[.refvelsx]] **valía siempre 0**; ahora es la velocidad lateral real de lo
  que se ve, con el signo cambiado, como se esperaba.
  <!-- port/README A3-1; simulacion/vision -->
- [[.trefshell]] **no se borraba nunca**: perdido el lazo, seguías leyendo el
  caparazón del último compañero. Ahora se borra con las demás sysvars del
  lazo.
  <!-- port/README A3-2; sysvars/trefshell -->
- [[.trefnrg]] **se congelaba en 32000 exactos**: un compañero con la energía
  al tope dejaba la lectura clavada en el valor anterior. Ahora se topa y
  listo.
  <!-- port/README A3-3; sysvars/trefnrg -->
- **El espionaje de ojos por lazo leía la dirección equivocada**, así que un
  multibot no podía ver qué miraba su compañero. Ahora lee la que corresponde.
  <!-- port/README A3-4 -->
- [[.kills]] **ya no se pasa de 32000**: el contador de muertes se topa también
  cuando la víctima muere por disparo, que era el camino sin tope.
  <!-- port/README A3-5 -->

Y la **visión de las formas** tenía cuatro errores de una: la sombra de una
forma no coincidía con la forma (estaba girada y tapaba de más), el ancho de
los ojos se calculaba distinto para formas que para bots, [[.eyef]] no subía a
32000 para un bot metido dentro de una forma, y la posición de la forma solo
era correcta si el ojo con foco era el frontal. Todo corregido
([[simulacion/vision]]).
<!-- port/README B2-1, B2-3, B2-4, B2-5 -->

## Lazos {#lazos}
<!-- port/README B4-1, B4-2, B1-1, B1-2 -->

- **Un lazo nuevo nace en blanco.** En el original heredaba el ángulo y el
  largo fijados por el ocupante anterior de ese casillero, y un multibot podía
  verse torcido sin haber pedido nada.
  <!-- port/README B4-1 -->
- **Repartir por lazo con los tanques llenos ya no destruye el exceso.**
  `sharenrg` y compañía pasan lo que sobra al otro extremo, hasta su propio
  tope; en el original se evaporaba ([[simulacion/lazos]]).
  <!-- port/README B4-2 -->
- **El giro que ordena un lazo endurecido empuja al compañero hacia el lado
  correcto**, y el ajuste se aplica al lazo que fijaste, no al primer hueco
  libre de la lista. Dos errores de la misma rutina del original.
  <!-- port/README B1-1, B1-2 -->

## Reproducción y mutaciones {#reproduccion}
<!-- port/README A1-5, B6-5, B6-7, B6-9 -->

- **Un bot se anota una sola vez para reproducirse por ciclo.** En el original
  podía quedar anotado dos veces, una para el parto asexual y otra para el
  sexual; acá, si procede la sexual, la asexual espera
  ([[simulacion/reproduccion]], [[simulacion/ciclo]]).
  <!-- port/README A1-5 -->
- **Los suelos de seguridad que frenan las mutaciones de un bot gigante ya no
  quedan escritos en su tabla de tasas.** En el original se heredaban, y los
  linajes de ADN largo iban derivando hacia ellos
  ([[simulacion/mutaciones#tasas]]).
  <!-- port/README B6-5 (los suelos anti-congelación ya no reescriben las tasas heredables) -->
- **Una inserción cuenta una mutación** por instrucción agregada; el original
  contaba dos, y el historial quedaba inflado.
  <!-- port/README B6-7; simulacion/mutaciones#efectos -->
- **Una mutación en vida refresca la firma del ADN.** En el original, lo que
  veían los demás con [[sysvars/ref|las sysvars `ref*`]] seguía siendo la
  firma vieja hasta el próximo parto; acá se rehace en el momento.
  <!-- port/README B6-9; simulacion/mutaciones#efectos -->

## El mundo {#mundo}
<!-- port/README A1-3, B7-1, B7-3, B7-4 -->

- **La matanza por presión de memoria ya no se dispara sin candidato.** Era
  el resto de un bucle del original: cuando se quedaba sin bots para matar,
  igual llamaba a la rutina de matar, con ningún bot adentro
  ([[simulacion/muerte#memoria]]).
  <!-- port/README A1-3; OPEN_QUESTIONS.md Q03 (KillRobot(0) alcanzable desde la matanza por presión de memoria) -->
- **La repoblación de vegetales no sortea coordenadas para descartarlas.**
  El original sorteaba un lugar, lo tiraba si caía en la zona de una especie,
  y volvía a empezar: consumía azar de más. Acá siembra directo.
  <!-- port/README B7-1 -->
- **Un teleporter con un solo eje de deriva se mueve.** En el original
  acumulaba velocidad que nunca aplicaba, y quedaba clavado.
  <!-- port/README B7-3 -->
- **La primera repoblación después de cargar una simulación guardada tarda lo
  que tiene que tardar.** En el original se pagaba el doble de espera la
  primera vez ([[simulacion/cloroplastos#repoblacion]]).
  <!-- port/README B7-4 -->

## Lo que quedó igual a propósito {#igual}
<!-- port/README §Conservados, y por qué -->

Corregir bugs no es rediseñar. Muchas rarezas del 2.48.32 se conservaron
porque **el ADN las ve**: cambiarlas cambiaría lo que significa un bot escrito
para esa versión, con los bots que la comunidad evolucionó encima. Otras se
conservaron porque son **mecánica, no error**: decisiones de diseño del
original que no rompen nada. Y las que no tienen **efecto observable** nadie
las va a notar. El reparto:

| Rareza conservada | Dónde se cuenta |
|---|---|
| Con `def` en el ADN, el primer token se pierde si no abre un gen | [[adn/estructura#cero-inicial]] |
| Las asimetrías de los operadores de pila | [[adn/pilas]] |
| Las comparaciones aproximadas son siempre falsas con referencia negativa | [[operadores/casi-igual]] |
| Fijar ángulo o largo de un lazo solo funciona con los stores de dos operandos | [[adn/stores]] |
| `mkvirus` no se borra solo: hay que limpiarlo a mano | [[simulacion/virus]] |
| Un ancho de ojo negativo lo hace panorámico | [[simulacion/vision]] |
| Un `.shoot` múltiplo exacto de 1000 sale como esperma | [[simulacion/disparos]] |
| El lazo de nacimiento usa el puerto 0 | [[simulacion/lazos]] |
| [[.fixang]] con 32000 suelta el ángulo en vez de fijarlo | [[adn/stores]] |
| [[.hitang]] tiene nombre pero nadie la escribe: es memoria libre | [[adn/memoria]] |
<!-- port/README §Conservados: «los ve el ADN» (A2-2/B6-1, A2-3 a A2-7 — la de las comparaciones aproximadas es A2-4, la de los stores de dos operandos en .tieang/.tielen es A2-6 —, B3b-4, B2-2, B3-3, B4-3, A3-8, A3-6); 70-CASOS-DORADOS §11 (tabla A2-4 = «%=~/~= con referencia negativa siempre falsos», A2-6 = «flags de tie solo en stores de 2 operandos») -->

De mecánica, no de error: un organismo entero respeta los bordes del mundo
toroidal como si fuera un solo bot; los cadáveres colisionan; un bot puede
reproducirse en el ciclo en que muere ([[simulacion/muerte]]); la mezcla de la
reproducción sexual pierde tramos de ADN, así salía en el original
([[simulacion/reproduccion]]); y las reglas de cambio de veneno y toxina y el
piso del costo de moverse son las que eran ([[simulacion/defensas]]). La regla
anti-gigantes del original tampoco se tocó: su umbral está por encima del
tope del cuerpo, así que no actúa nunca — en ninguna de las dos versiones
([[simulacion/muerte]]).

Y el **formato de archivo**: las simulaciones y los bots del original se leen
y se escriben con el mismo formato de siempre, rarezas incluidas, para que un
`.dbsim` o un `.txt` de esa época siga funcionando ([[tecnico/formatos]]).

## Las dudas que dejó el original {#preguntas}
<!-- OPEN_QUESTIONS.md (Q01-Q17, con sus estados); REVISION-PORT.md RV-31 (criterio de fuente secundaria) -->

Reconstruir el motor trajo preguntas que el fuente solo no responde: cómo se
comportaba el ejecutable en detalle. Y el ejecutable no corre en el Windows de
hoy, así que no se puede contrastar contra el binario. Esas dudas se cerraron
donde se pudo, y conviene saber con qué certeza:

- **El generador de azar se reconstruyó de una fuente secundaria**: la
  reimplementación del runtime que publicó el propio fabricante del lenguaje,
  que documenta el algoritmo exacto. Por construcción, el port sortea los
  mismos números en el mismo orden que el original; de ahí salen las
  semillas, las réplicas y las repeticiones de [[tecnico/semillas]].
  <!-- OPEN_QUESTIONS.md Q02 (RESUELTA con fuente externa: dotnet/runtime, VBMath.vb/ProjectData.vb, coherente con MS KB231847) -->
- **Qué hacía el ejecutable al desbordar un número** se cerró con la
  documentación del fabricante del procesador y del compilador: el binario
  compilaba con los chequeos activos, así que desbordar cortaba el ciclo con
  un error. El port define un comportamiento explícito en cada uno de esos
  sitios en vez de cortar.
  <!-- OPEN_QUESTIONS.md Q17 (RESUELTA con Intel SDM y la corrección de flags), Q08, Q07 -->
- **La aritmética de coma flotante** guarda una diferencia residual de
  redondeo, herencia del hardware de la época, que sin el binario no se puede
  medir. Los casos de física se definieron con tolerancia; el port es
  determinista consigo mismo, plataforma por plataforma, con la misma
  operación dando siempre el mismo número.
  <!-- OPEN_QUESTIONS.md Q07 (RESUELTA como decisión de port: IEEE 754 estricto por operación) -->
- El resto — qué consume azar y cuándo (Q01), la cola de partos y su doble
  encolado (Q13), la identidad absoluta de los bots (Q14) y qué escribe el
  motor en la memoria fuera del intérprete (Q15) — se cerró leyendo el fuente
  original hasta el detalle.
  <!-- OPEN_QUESTIONS.md Q01, Q13, Q14, Q15 (RESUELTAS por análisis del fuente) -->

## Si encontrás una diferencia nueva {#reportar}

Si una simulación se comporta distinto de lo que cuenta este manual, es un
error del manual o del port, y suma reportarlo. El repositorio del proyecto es
público ([github.com/japentaca/darwinbots2-wasm](https://github.com/japentaca/darwinbots2-wasm),
enlazado en la portada del sitio): abrí un issue con lo que
pasó, y si podés, el escenario exportado y la semilla, que con eso la corrida
se repite exacta ([[tecnico/semillas]]). Si es una rareza del **original** que
no aparece en esta página, probablemente quedó igual a propósito: decilo
igual, y se decide si es bug o carácter.
<!-- port/sitio/publico/index.html (botón «Código fuente» → https://github.com/japentaca/darwinbots2-wasm); verificado que el enlace existe en la portada -->

Cómo se hizo el port, capa por capa, está en [[tecnico/como-esta-hecho]]; de
dónde sale cada cosa, en [[tecnico/creditos]].
