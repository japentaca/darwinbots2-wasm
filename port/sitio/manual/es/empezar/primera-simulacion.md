---
titulo: Tu primera simulación
resumen: "Paso a paso: elegir un escenario en Inicio, mirarlo correr en Observar, pausar, cambiar la velocidad, inspeccionar un bot, sembrar uno tuyo y guardar la corrida."
etiquetas: [primeros pasos, escenario, observar, sembrar, guardar]
estado: revisada
---
En esta página vas a abrir la app, poner un mundo a correr, mirar a un bot de
cerca, sembrar un bot escrito por vos y guardar todo para seguir otro día. No
hace falta saber programar: el ADN del paso 6 se copia y se pega.

## 1. Elegí un escenario {#escenario}
<!-- web2/src/screens/Inicio.svelte (iniciar: semillaNueva, correr(true), ir a observar; destino 'competir'); i18n/es/inicio.json; engine/escenarios/fabrica.js (orden) -->

Abrí la app. La primera pantalla es **Inicio**. Si todavía no corriste nada,
arriba dice «Todavía no hay corridas» y el botón **Elegir un escenario** te
baja a la galería.

Un _escenario_ es un mundo listo para usar: el tamaño del campo, la física, la
luz, los costos y las especies que se siembran al empezar. La app trae siete:

| Escenario | Qué tiene |
|---|---|
| Sopa primordial | Algas y un animal mínimo, con mutaciones. El punto de partida para ver evolucionar a una especie. |
| Depredador y presa | Zebedee V2.1 cazando sobre un campo de algas. |
| Partido F1 | Dos bots de liga frente a frente, con las reglas de la liga F1. |
| Día y noche | El sol se pone cada 1000 ciclos y la población oscila. |
| Laberinto | Un laberinto en espiral que los bots pueden ver. |
| Océano | Física de agua en un mundo sin bordes. |
| Archipiélago | Islas de roca y dos teleporters. |

Para empezar, buscá **Sopa primordial** y pulsá **Iniciar**. La app arma el
mundo con una semilla nueva al azar, lo pone a correr y te lleva a
**Observar**.

El otro botón de cada tarjeta, **Ajustar**, abre el escenario en Experimentar
para cambiarlo antes de empezar (ver [[app/escenarios]]). En la tarjeta de
Partido F1 el botón principal no dice Iniciar sino **Elegir bots**, y te lleva
a Competir, porque un partido se arma eligiendo contrincantes.

:::nota
Si entrás directo a Observar sin haber iniciado nada, la app arranca sola la
Sopa primordial con una semilla nueva y la pone a correr.
:::

## 2. Qué estás viendo {#pantalla}
<!-- web2/src/screens/Observar.svelte (barra, lateral, Mundo); lib/observar/PanelVivo.svelte; i18n/es/observar.json, mundo.json; lib/sim/sesion.svelte.js (velocidad 10 y vista enriquecida por defecto) -->

Observar tiene tres partes:

- **El mundo**, a la izquierda. Cada círculo es un bot, del color de su
  especie: en la Sopa primordial, las algas son verdes y los animales, rojos.
- **El panel «En vivo»**, a la derecha: cuántos bots hay vivos, cuántas
  especies, la energía media por bot y la generación más alta. Debajo, el
  gráfico **Población por especie** y la lista de **Eventos** (picos de
  población, extinciones, generaciones récord). **Ver análisis completo** te
  lleva a Analizar.
- **La barra de abajo**, con los controles. A la derecha de la barra se ven
  los ciclos por segundo y los cuadros por segundo.

Arriba de todo, en la barra de secciones, un indicador dice si la simulación
está corriendo (con su nombre) o en pausa (con el ciclo en que quedó). Desde cualquier sección, un clic
ahí te trae de vuelta a Observar.

Al principio no va a pasar mucho: los animales recorren el campo buscando
algas, y cuando ven una se acercan y le disparan para sacarle energía. Con el
tiempo nacen hijos, el gráfico sube y aparecen los primeros eventos. Qué hace
cada bot en cada ciclo lo cuenta [[simulacion/ciclo]].

## 3. Pausar y cambiar la velocidad {#velocidad}
<!-- revisado: lib/sim/corrida-nucleo.js arrancarPorDefecto termina con correr(true) -->
<!-- Observar.svelte (barra: mundo.iniciar/pausar, mundo.unCiclo, VELOCIDADES); lib/sim/sesion.svelte.js VELOCIDADES = [1, 10, 100, 0]; lib/mundo/Mundo.svelte (rueda, arrastre solo con zoom, teclas + - 0 flechas) -->

| Control | Qué hace |
|---|---|
| **Pausar** / **Iniciar** | Detiene y retoma la simulación. |
| **Un ciclo** | Avanza exactamente un ciclo. Sirve para seguir a un bot paso a paso. |
| **× 1**, **× 10**, **× 100** | Cuántos ciclos se calculan por cada cuadro dibujado. Arranca en × 10. |
| **Máx.** | Tan rápido como pueda tu equipo; dibuja cuando le da el tiempo. |
| **Vista** | **Enriquecida** (la de siempre), **Clásica** (como el programa original) o **Contorno**. |
| **Color por** | En la vista enriquecida, pinta a los bots por especie, energía, cuerpo, generación, mutaciones, edad, largo del ADN o distancia genética. |

Para moverte por el mundo: la rueda del mouse acerca y aleja, y con el mundo
acercado podés arrastrarlo. Los botones de la esquina del mundo hacen lo mismo
(**Acercar**, **Alejar**, **Encuadrar todo**). Con el foco en el mundo, `+` y
`−` acercan y alejan, las flechas desplazan y `0` vuelve a encuadrar todo el
campo.

Con × 100 o **Máx.**, la Sopa primordial pasa los primeros miles de ciclos
enseguida. Es la forma de ver la evolución: pasa en decenas de miles de
ciclos, no en cientos.

## 4. Mirá a un bot de cerca {#inspeccionar}
<!-- lib/inspector/Inspector.svelte (PESTANAS); i18n/es/inspector.json; mundo.json (mundo.ayuda.clic, seguir); observar.json (observar.mejor) -->

Hacé clic en un bot. El panel de la derecha pasa a ser el **inspector**: el
nombre de su especie, su generación, sus mutaciones y su edad, y sus recursos
(energía, cuerpo, veneno, caparazón, desechos). En la pestaña **Resumen** ves
además la curva de su energía, lo que ven sus ojos y qué genes de su ADN se
ejecutaron en este ciclo.

Algunas cosas para probar:

1. Pulsá **Seguir**: la cámara acompaña al bot por el mundo.
2. Pausá y avanzá con **Un ciclo**, mirando en **Genes activos este ciclo**
   cuál gen se enciende cuando el bot ve un alga.
3. Abrí la pestaña **ADN** para leer su programa, o **Sentidos** para ver el
   abanico de sus nueve ojos.
4. Pulsá **Familia** para resaltar a sus descendientes en el mundo.

Si no sabés a quién mirar, **Buscar el mejor** selecciona al bot más apto de la
simulación (los vegetales no cuentan). Para volver al panel «En vivo», cerrá el
inspector con la ✕. Las demás pestañas (**Memoria**, **Consola**, **Control**)
están en [[app/inspector]].

## 5. Un bot del Bestiario {#bestiario}
<!-- lib/observar/DialogoSembrar.svelte (preset biblioteca: 5 bots, 15 si es vegetal, 3000 de energía, color libre); i18n/es/bots.json (bots.selector.*, bots.ficha.sembrar, bots.lote.*) -->

El _Bestiario_ es la colección de bots de la comunidad que trae la app. Para
agregar uno al mundo que está corriendo:

1. Pulsá **Sembrar** en la barra de abajo.
2. En **Bot**, elegí **Un bot de la biblioteca…** y buscalo por su nombre
   (probá con «Zebedee» o «Hunter»).
3. Revisá la **Cantidad** (5, o 15 si es un vegetal), la **Energía inicial**
   (3000) y el **Color**.
4. Pulsá **Sembrar**.

La especie nueva aparece en el mundo y en el gráfico, y queda anotada en los
eventos. También se siembra desde la sección **Bots**: abrí la ficha de un bot
y pulsá **Sembrar** (ver [[app/bots]]).

## 6. Sembrá un bot tuyo {#tu-bot}
<!-- probado: Sopa primordial (Alga minimalis 3.0 ×15 vegetal, Animal Minimalis ×5) + este ADN ×5, base clásica (costos 0, MaxEnergy 10, minVegs 15, repop 10/10, mutaciones encendidas), campo 32000×32000, semillas 1-3: entre 46 y 58 bots en el ciclo 4000 y entre 166 y 534 en el 10000; revisor, semillas 2 y 4-7: 21-66 en el 4000 y 194-1198 en el 10000; sin el Animal Minimalis y sin mutaciones, semillas 1-5: 25-39 en el 4000. Scratch pruebas-c12-empezar/sopa2.mjs. Gen 1 mueve y gira: sin avance, con la semilla 3 no comieron en 10000 ciclos. -->

Este ADN es un cazador mínimo: si no ve nada, avanza y gira al azar; si ve a
un bot de otra especie, va hacia él; si lo tiene cerca, le dispara para
sacarle energía; y cuando junta energía de sobra, se reproduce.

```adn
' Mi primer bot: busca comida, come y se reproduce
' Gen 1: si no ve nada (o ve a uno de los suyos), avanza y gira al azar
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 10 .up store
 200 rnd .aimdx store
stop
' Gen 2: si ve a otro, va hacia él
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 20 .up store
stop
' Gen 3: si lo tiene cerca, le dispara para sacarle energía
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 -1 .shoot store
stop
' Gen 4: con energía de sobra, se reproduce
cond
 *.nrg 10000 >
start
 50 .repro store
stop
end
```

Para sembrarlo:

1. Hacé clic en **Abrir en la app** en el bloque: la app abre el diálogo de bot
   nuevo con este ADN ya cargado. (El botón **Copiar** te lo lleva al
   portapapeles, por si preferís pegarlo a mano.)
2. Poné un **Nombre** (por ejemplo, «Mi primer bot») y pulsá **Crear**: se
   abre el editor con el ADN.
3. En la ficha del bot, pulsá **Sembrar**, elegí un **Color** que se
   distinga, dejá la **Cantidad de bots** en 5 y la **Energía inicial** en 3000, y
   pulsá **Sembrar en la corrida actual**.

Seguilo con el inspector. En las pruebas que hicimos con el motor, sembrando
estos cinco bots junto a los de la Sopa primordial, a los 4000 ciclos ya eran
entre 20 y 70, y a los 10.000, de unos 200 a más de mil, según la semilla. Como la Sopa
primordial tiene las mutaciones encendidas, con el tiempo vas a ver hijos con
el ADN cambiado: el inspector muestra cuántas mutaciones acumula cada uno.

Cada línea de este bot está explicada en el capítulo del ADN: los genes en
[[adn/genes]], los ojos en [[simulacion/vision]], el disparo en
[[simulacion/disparos]] y la reproducción en [[simulacion/reproduccion]]. Para
escribir uno desde cero, seguí [[tutoriales/se-mueve]]. Si lo querés conservar
y mejorar, crealo en **Bots** con **+ Nuevo bot**: el [[app/editor|editor de ADN]] te avisa
de los errores mientras escribís.

:::nota
Si el ADN tiene palabras que el motor no reconoce, la app avisa al sembrarlo
cuántas son: esas palabras valen 0. La causa más común es una sysvar mal
escrita (ver [[adn/errores#nombre]]).
:::

## 7. Guardá la corrida {#guardar}
<!-- lib/observar/DialogoGuardar.svelte; i18n/es/observar.json (observar.guardar.*, observar.corridas.*, observar.aviso.cargada); i18n/es/inicio.json (inicio.corridas.*); web2/PLAN.md decisión 8 y C17 -->

Una _corrida_ es una simulación con su historia: el escenario del que salió,
su semilla, los cambios que le hiciste y sus eventos. Para guardarla:

1. Pulsá **Guardar** en la barra de abajo.
2. Escribí un **Nombre**.
3. Pulsá **Guardar en el navegador**.

Queda guardada en este navegador. La app conserva las últimas 20 corridas. Si
la corrida ya estaba guardada, el botón dice **Actualizar la guardada**, y al
lado aparece **Guardar como nueva** para guardar una copia aparte. **Descargar .dbsim** baja, en cambio, un
archivo con la simulación, para llevarla a otro equipo.

Para seguir otro día, abrí Inicio y buscá la corrida en **Corridas guardadas**,
o usá **Corridas** en la barra de Observar. Al retomarla queda en pausa:
pulsá **Iniciar**. El mundo sigue desde donde lo dejaste, aunque el azar no
continúa exactamente igual que si no la hubieras guardado (ver
[[tecnico/semillas]]). Dónde vive todo lo que guardás y cómo exportarlo está
en [[app/tus-datos]].

## Y ahora {#ahora}

- Cambiá la luz, los costos o la física de este mundo en
  [[app/experimentar]].
- Mirá cómo cambió la población y el árbol de especies en [[app/analizar]].
- Hacé que tu bot evolucione con [[tutoriales/evolucion]].
- Si algo no anduvo como esperabas, buscá en [[empezar/preguntas]].
