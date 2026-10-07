---
titulo: Experimentar
resumen: "La pantalla donde armás una simulación: elegís un escenario, cambiás el mundo con los controles básicos, sumás especies y la lanzás, o aplicás los cambios a la que ya corre."
etiquetas: [experimentar, borrador, especies, semilla, en vivo]
estado: revisada
---
**Experimentar** es el banco de trabajo de la app. Ahí armás una simulación
antes de largarla: qué tan grande es el mundo, cuánta comida entra, si hay
mutaciones, qué especies se siembran y con cuántos bots. También es donde
cambiás las reglas de una simulación que ya está corriendo, sin empezar de
cero.

Se entra desde la barra superior, con **Experimentar**, o desde una tarjeta
de escenario de [[app/inicio]] con **Ajustar**, que abre esa pantalla con
el escenario ya cargado.

## La idea: un borrador {#borrador}
<!-- web2/src/screens/Experimentar.svelte (elegir, seguirCorrida); lib/experimentar/estado.svelte.js; PLAN.md decisiones 12 y 13 -->

Todo lo que cambiás en Experimentar va a un **borrador**: una copia de un
escenario que podés editar sin afectar la simulación que está en marcha.
Un _escenario_ es una configuración completa: los parámetros del mundo, las
especies que se siembran y los objetos (obstáculos y teleporters). Los
escenarios tienen su propia página: [[app/escenarios]].

Con el borrador listo tenés dos salidas:

- **Nueva simulación**: arranca un mundo nuevo con todo el borrador.
- **Aplicar a la actual**: manda a la simulación que corre solo los cambios
  que se pueden aplicar en vivo.

El borrador se conserva mientras cambiás de pantalla: podés ir a Observar,
mirar cómo va y volver a seguir editando. Si recargás la página, se pierde.
Si empieza otra simulación (por ejemplo, desde Inicio) y el borrador no
tenía cambios tuyos, pasa a mostrar la configuración de la nueva.

## La pantalla {#pantalla}
<!-- Experimentar.svelte (aside.lateral, section.centro, aside.derecha); i18n/es/experimentar.json -->

Tiene tres columnas (en una pantalla angosta quedan una debajo de la otra):

| Columna | Qué tiene |
|---|---|
| Izquierda | La lista de escenarios: **Escenarios de fábrica** y **Míos**, y los botones para guardar, duplicar, borrar, importar y exportar. |
| Centro | El nombre del borrador, su base, el selector **Básico** / **Avanzado** y los controles. |
| Derecha | **Especies a sembrar**, la **Semilla** y el botón **Nueva simulación**. |

Arriba de los controles, bajo el nombre del escenario, se lee de dónde salió
(**Escenario de fábrica**, **Escenario propio** o **Borrador**), su **base**
y cuántos cambios tiene respecto de esa base. La base es el punto de partida
de todos los valores: **Clásica** (los de la interfaz clásica: sin costos,
campo de 32000 × 32000) o **Liga F1** (costos, física y campo de los torneos
F1). Si cambiás la base, toman los valores que la nueva fija; las especies,
los objetos y los cambios en parámetros que la base no fija se quedan.

Esta página cuenta el modo **Básico**. El **Avanzado**, con todos los
parámetros, está en [[app/experimentar-avanzado]]. La app recuerda cuál
elegiste la última vez.

## Las marcas: en vivo, nueva, sin aplicar {#marcas}
<!-- Experimentar.svelte .live::before (punto lleno), .new::before (círculo con borde), .chg sobre --aviso-fondo; .leyenda; borrador.js controlVivo, controlCambiado; opciones.js (vivo: false solo en base:fieldW/fieldH); escenarios/index.js diff -->

Cada control lleva una marca:

- **vivo** (punto lleno): se puede aplicar a la simulación que corre.
- **nueva** (círculo vacío): necesita una simulación nueva.

Solo tres cosas requieren simulación nueva: el **Tamaño del campo**, las
especies y los objetos del mundo. Todo lo demás se aplica en vivo.

Además, un control con fondo amarillo es un **cambio sin aplicar**: su valor
en el borrador es distinto del de la simulación que corre. Si no hay ninguna
corriendo, la comparación es contra el escenario que elegiste.

## Los controles básicos {#controles}
<!-- borrador.js GRUPOS_BASICOS; opciones.js CONTROLES_BASICOS, MEDIOS, BORDES, dimensionesCampo; probado: scratchpad pruebas-c12-experimentar/t1.mjs -->

Son diez controles en cuatro tarjetas. Algunos cambian varios parámetros a la
vez: el modo avanzado muestra cada uno por separado.

| Tarjeta | Control | Qué hace | Parámetros |
|---|---|---|---|
| **Mundo** | **Tamaño del campo** | Los tamaños clásicos del original, del 1 (el campo F1, 9237 × 6928) al 15. | [[param:base:fieldW]], [[param:base:fieldH]] |
| | **Bordes** | **Paredes**, **Toroidal** o un cilindro (izquierda↔derecha o arriba↔abajo). | [[param:opt:2]], [[param:opt:3]] |
| | **Medio** | **Espacio** (nada frena), **Fluido** (agua) o **Sólido** (suelo con rozamiento). | [[param:opt:14]], [[param:opt:15]], [[param:opt:16]], [[param:opt:17]], [[param:opt:19]] |
| **Energía** | **Energía solar** | La energía que reciben los vegetales en cada ciclo: la comida que entra al mundo. | [[param:base:maxEnergy]] |
| | **Día y noche** | Cuántos ciclos dura el día (y la noche); 0 es siempre de día. | [[param:opt:33]], [[param:opt:34]] |
| | **Costos** | **F1** (los de la liga), **Sin costos** (todo gratis) o **Personalizados**. | todos los de [[app/parametros-costos]] |
| **Vegetales** | **Tope de vegetales** | Cuántos vegetales puede haber como máximo. | [[param:base:maxPopulation]] |
| | **Repoblación de vegetales** | Si los vegetales bajan de este nivel, se siembran más (0 = nunca). | [[param:base:minVegs]] |
| **Evolución y muerte** | **Mutaciones** | **Sí** / **No**: con mutaciones, los hijos cambian. | [[param:base:mutations]] |
| | **Cadáveres** | **Sí** / **No**: los muertos quedan como comida. | [[param:opt:50]] |

Algunas aclaraciones:

- **Personalizado** aparece en un selector solo cuando el valor no coincide
  con ninguna de las opciones: por ejemplo, en **Costos** después de cambiar
  un costo suelto en el modo avanzado. El campo de 32000 × 32000 de la base
  Clásica no es ninguno de los quince tamaños, así que con esa base el
  **Tamaño del campo** muestra **Personalizado**.
- Los números se corrigen al escribirlos: si el valor no entra en lo que el
  motor puede guardar, se lleva al tope. Si entra pero es raro, se acepta con
  un aviso que dice cuál es el rango habitual.
- Si un control vuelve a su valor original, deja de contar como cambio.

Qué hace cada cosa dentro de la simulación está en el capítulo 3: el campo y
los bordes en [[simulacion/mundo]], el medio en [[simulacion/fisica#fluido]],
la luz y los vegetales en [[simulacion/cloroplastos]], los costos en
[[simulacion/energia]], las mutaciones en [[simulacion/mutaciones]] y los
cadáveres en [[simulacion/muerte#cadaveres]].

## Las especies {#especies}
<!-- Experimentar.svelte aside.derecha; DialogoEspecie.svelte; borrador.js especieNueva (energia 3000), cambiarEspecie, CANTIDAD_MAX, validarAdn; lib/sim/prueba.js (presets) -->

La columna derecha, **Especies a sembrar**, lista lo que va a nacer cuando
arranque la simulación. Cada especie muestra su color, su nombre, si es
**vegetal** o **animal** y la **Cant.** de bots. Ahí mismo podés cambiar el
color (con el cuadrito), la cantidad (de 1 a 10000) o quitarla con **×**.
Sin especies, el mundo arranca vacío.

Para sumar una, hacé clic en **Agregar especie**. El diálogo pregunta **De dónde**:

1. **Un bot de la biblioteca (por nombre)**: escribís parte del nombre y
   elegís entre los bots del Bestiario y los tuyos (ver [[app/bots]]).
2. **Animal Minimalis (depredador simple)**: un animal de prueba, 5 bots.
3. **Alga Minimalis (vegetal simple)**: un vegetal de prueba, 15 bots.
4. **Pegar ADN**: le ponés un **Nombre** y pegás el texto del bot.

Después ajustás **Cantidad**, **Color** y la casilla **Es vegetal (hace
fotosíntesis)**, y confirmás con **Agregar**. Un ADN pegado tiene que tener
al menos un gen (un `cond` o un `start`); si no, el diálogo avisa.

Los bots del Bestiario van al escenario solo por su nombre. Los tuyos, los de
prueba y los pegados llevan el ADN adentro, y la lista lo marca con **ADN
incluido**: así el escenario sigue funcionando aunque después edites o
borres el bot.

Cada especie que agregás desde acá arranca con 3000 de energía. Esta
pantalla no la deja cambiar: un escenario creado desde la Biblioteca con
**Nuevo escenario con estos** sí puede traer otra (ver [[app/bots]]).

Las especies cuentan como siembra inicial: cambiarlas siempre requiere una
simulación nueva. Para meter bots en una simulación que ya corre, usá
**Sembrar** en Observar o **Sembrar en lote** en la Biblioteca.

## Los objetos del mundo {#objetos}
<!-- Experimentar.svelte snippet tarjetaObjetos; borrador.js resumenObjetos, quitarObjetos; i18n/es/mundoObj.json (barra Mundo de Observar); PLAN.md decisión 15 -->

La tarjeta **Objetos del mundo** resume los obstáculos, laberintos y
teleporters del escenario, como **laberinto espiral** o **2 teleporters**.
Acá solo se pueden quitar todos, con **Quitar todo**. Se ponen sobre el
mundo, con la barra **Mundo** de Observar (ver [[app/observar]]). Su
posición la sortea la simulación con la semilla. Cómo afectan a los bots
está en [[simulacion/mundo#obstaculos]].

## La semilla {#semilla}
<!-- Experimentar.svelte .semilla; borrador.js parsearSemilla, SEMILLA_MAX, semillaAleatoria; probado: probar-adn Animal Minimalis --semilla 7 dos veces (igual) y 8 (distinto) -->

La **Semilla** es el número que arranca el azar de la simulación: dónde nace
cada bot, qué mutaciones salen, dónde caen los obstáculos. Con el mismo
escenario y la misma semilla sale la misma simulación, ciclo por ciclo; con
otra semilla, el mismo mundo cuenta otra historia. El dado (🎲, **Otra
semilla al azar**) sortea una nueva. Tiene que ser un entero entre 1 y
2147483646. Más detalles en [[tecnico/semillas]].

## Lanzar una simulación nueva {#nueva}
<!-- Experimentar.svelte nuevaSim (normalizar, corrida.iniciar, correr(true), hash observar; sin confirm, a diferencia de puedeReemplazar de Inicio); errores = validar(b) -->

1. Elegí un escenario en la columna izquierda (o seguí con el borrador).
2. Ajustá los controles y las especies.
3. Revisá la semilla.
4. Hacé clic en **Nueva simulación**.

La app arma el mundo, lo pone a correr y te lleva a [[app/observar]]. La
simulación se llama como el escenario.

El botón queda apagado mientras la semilla no es válida, mientras el
borrador tiene errores (aparecen en rojo arriba del botón) o mientras la app
está ocupada armando otra.

:::cuidado
**Nueva simulación** reemplaza la que está corriendo sin preguntar. Si querés
conservarla, guardala antes desde Observar.
:::

Con un torneo en curso, **Nueva simulación** y **Aplicar a la actual** quedan
apagados (reemplazarían o cambiarían la pelea), y un aviso arriba lleva a la
franja del torneo. El borrador se puede editar y guardar igual (ver
[[app/competir#en-curso]]).

## Aplicar a la simulación que corre {#aplicar}
<!-- Experimentar.svelte .pendientes, aplicarActual (sesion.aplicarEnCiclo, registrarCambio), descartar; borrador.js pendientes, cambiosVivos; PLAN.md decisión 13 y C12 -->

Si hay una simulación corriendo y el borrador difiere de ella, abajo aparece
una barra con **_N_ cambios sin aplicar**. Cada cambio se lee como
«nombre: antes → después», y los que requieren simulación nueva llevan la
marca **nueva**. La barra tiene tres botones:

- **Aplicar a la actual (ciclo _N_)**: manda a la simulación los cambios en
  vivo. Se aplican todos juntos, en un ciclo exacto, y un aviso dice en cuál.
- **Nueva simulación**: aparece si algún cambio la necesita. Arranca de cero
  con el borrador completo.
- **Descartar**: devuelve el borrador a lo que tiene la simulación que corre.

Si mezclaste cambios en vivo con otros que no lo son, por ejemplo la energía
solar y una especie nueva, **Aplicar a la actual** manda solo la energía, y
la especie queda pendiente hasta una simulación nueva.

Cada cambio aplicado queda registrado en la simulación, con el ciclo en que
entró. Por eso se guarda con ella, y las réplicas de [[app/analizar]] (en
la pestaña **Comparar**), que
repiten la simulación con otras semillas, lo aplican en el mismo ciclo: así
podés ver si el efecto de tu cambio se sostiene o fue cosa del azar.

:::nota
En la interfaz clásica, la energía solar, la repoblación de vegetales y las
mutaciones solo cambian al reiniciar. En la app nueva se aplican en vivo como
los demás parámetros.
:::

Si la simulación que corre no salió de un escenario (la cargaste desde un
archivo .dbsim), no hay con qué comparar: la pantalla lo avisa, y los cambios
se usan recién al lanzar una nueva.

## Guardar lo que armaste {#guardar}
<!-- Experimentar.svelte acciones (guardarComo, duplicar, borrar, importar, exportar) -->

El borrador no se guarda solo. Para conservarlo, usá **Guardar como
escenario**: queda en **Míos** y lo podés volver a abrir, exportar como .json
o compartir. Un escenario de fábrica no se modifica: **Duplicar como propio**
crea una copia tuya para editar. Todo eso está en [[app/escenarios]].
