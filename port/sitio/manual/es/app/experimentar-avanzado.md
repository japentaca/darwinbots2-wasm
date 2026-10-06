---
titulo: "Experimentar: modo avanzado"
resumen: "Todos los parámetros de la simulación, en doce grupos: cómo buscarlos, cambiarlos, volverlos a la base y cuáles se aplican con la simulación en marcha."
etiquetas: [experimentar, parámetros, avanzado, base, en vivo]
estado: revisada
---
El modo **Avanzado** de [[app/experimentar]] muestra todos los parámetros de
la simulación, uno por uno: más de cien, repartidos en doce grupos. Los diez
controles del modo **Básico** son atajos sobre algunos de ellos. Acá tenés
todo lo demás: la física fina, los costos de cada instrucción, las reglas de
los torneos, la luz por profundidad.

Para entrar, tocá **Avanzado** arriba a la derecha de los controles. Los dos
modos editan el mismo borrador: lo que cambiás en uno se ve en el otro. Las
especies, la semilla, los objetos del mundo y la barra de cambios sin aplicar
siguen igual que en el modo básico.

## La pantalla {#pantalla}
<!-- opciones.js PARAMETROS: 108 en 12 grupos; Avanzado.svelte nav.side (`${cambiados}/${total}`), cabecera «grupo · total», «Base {base}»; web2/src/lib/experimentar/Avanzado.svelte (nav.side, section.tabla, prow); avanzado.js gruposAvanzado, resumenGrupos; i18n/es/experimentar.json experimentar.avanzado.* -->

A la izquierda, la lista de **Grupos de parámetros**: **Todos** y los doce
grupos. Al lado de cada uno, un número como `3/12` dice cuántos parámetros
del grupo cambiaste respecto de la base y cuántos tiene en total (si no
cambiaste ninguno, sale solo el total).

A la derecha, la tabla. Cada grupo empieza con una cabecera que tiene su
nombre, la columna **Valor** y la columna **Base** con el nombre de la base
(por ejemplo, **Base Clásica**). Cada fila es un parámetro y muestra:

- el nombre, y al lado el **nombre de la variable** en el programa original
  (como `MaxVelocity`), útil si venís del DarwinBots de escritorio o si leés
  el foro;
- una línea de ayuda y, a veces, una nota;
- el control para cambiarlo: una casilla para los de sí o no, una lista para
  los que tienen opciones fijas y un campo numérico para el resto;
- el valor que tiene en la base, y si se aplica **vivo** o necesita una
  simulación **nueva**.

Cada grupo y cada parámetro llevan un **?** que abre su página del manual
([[app/parametros-campo]], [[app/parametros-energia]]…, y la de cada
parámetro, directo a su ficha).

## Las dos marcas de cambio {#marcas}
<!-- Avanzado.svelte (marca ≠ base, class chg = sinAplicar); avanzado.js (cambiado vs sinAplicar) -->

En este modo hay dos ideas distintas de «cambiado», y conviene no
confundirlas:

| Marca | Quiere decir | Contra qué se compara |
|---|---|---|
| Etiqueta **≠ base** | El valor no es el de la base del escenario. | La base (Clásica o Liga F1). |
| Fondo amarillo | **Cambio sin aplicar**: el valor no es el de la simulación que corre. | La simulación en marcha o, si no hay, el escenario que elegiste. |

Si elegís el escenario de fábrica Día y noche sin ninguna simulación en
marcha, sus parámetros del día y la noche salen con **≠ base** (el escenario
los trae distintos de la base) pero sin fondo amarillo: todavía no tocaste
nada.

## Buscar un parámetro {#buscar}
<!-- avanzado.js coincideBusqueda (es, en, variable, clave; todas las palabras; sin tildes), plano; probado: t1.mjs ('veneno' → cost:26, 'maxvel' → opt:11, 'friction' → opt:16/17) -->

El campo **Buscar parámetro por nombre o variable** filtra la tabla mientras
escribís. Busca a la vez en:

- el nombre en español y en inglés (_friction_ encuentra los dos
  rozamientos);
- el nombre de la variable del original (_maxvel_ encuentra la velocidad
  máxima);
- la clave interna, como `opt:11`.

No importan las mayúsculas ni las tildes. Si escribís varias palabras, tienen
que estar todas. Mientras buscás, la tabla mira en todos los grupos, sin
importar cuál esté elegido a la izquierda.

La casilla **Solo cambiados** deja solo los parámetros con **≠ base**: es la
forma rápida de ver qué tiene de distinto un escenario.

## Cambiar un valor {#cambiar}
<!-- avanzado.js escribirParametro (normalizarValor: clave-derivada, valor-tipo, valor-rango, valor-saturado); opciones.js LIMITES, sugerido, fueraDeLoUsual, satura; probado: t1.mjs (opt:34 40000 → valor-rango; opt:36 1e12 → 2147483647 saturado; opt:12 2 → aviso; opt:34 12.5 → valor-tipo) -->

Escribí el número y salí del campo (o apretá Enter). Puede pasar una de
cuatro cosas:

1. **Se acepta**: el valor queda en el borrador y la fila se marca.
2. **Se acepta con un aviso**: el valor es poco habitual (una eficiencia
   del motor mayor que 1, un costo negativo). El aviso dice cuál es el rango usual, pero el
   valor queda: a veces lo raro es justo lo que querés probar.
3. **Se lleva al tope**: algunos parámetros enteros grandes, como los
   umbrales del sol, no admiten más que cierto máximo. Si te pasás, se guarda
   el máximo y un aviso lo dice.
4. **Se rechaza**: el valor no entra en lo que el motor puede guardar, o
   falta un entero y escribiste decimales. El campo vuelve al valor anterior
   y un mensaje en rojo explica por qué.

Se acepta la coma decimal (`0,5`). Algunos parámetros dependen de otros y no
se editan: llevan la marca **derivado**. El caso más visible es **Toroidal
(los dos ejes)** ([[param:opt:1]]), que vale 1 cuando los dos pares de bordes
están conectados: para cambiarlo, cambiá los ejes o el control **Bordes** del
modo básico.

## Volver a la base {#volver}
<!-- Avanzado.svelte botones reset (aBase, aBaseDe, baseGrupo); avanzado.js volverABase -->

Cada parámetro con **≠ base** tiene, a la derecha, un botón con una flecha
circular: **Volver al valor de la base**. En la cabecera de cada grupo con
algún cambio hay otro igual que vuelve todo el grupo a la vez.

Volver a la base no es lo mismo que **Descartar**. Descartar deja el
borrador como la simulación que corre; volver a la base deja el parámetro
como lo fija la base, aunque el escenario lo traía distinto.

## Qué se cambia en vivo {#en-vivo}
<!-- opciones.js (vivo: false solo base:fieldW/fieldH), mensajeVivo; escenarios/index.js diff; PLAN.md C12; Experimentar.svelte aplicarActual -->

Casi todo. De los más de cien parámetros, solo el ancho y el alto del campo
requieren una simulación nueva; el resto se manda a la simulación que corre
con **Aplicar a la actual**, igual que en el modo básico (ver
[[app/experimentar#aplicar]]). Eso incluye los costos, la física, la luz, la
economía de los vegetales y las mutaciones. Las especies y los objetos del
mundo tampoco se cambian en vivo, pero no son parámetros.

Que un parámetro se aplique en vivo no quiere decir que su efecto se vea
enseguida. Un ejemplo: encender el **Modo F1 (concurso de especies)**
([[param:opt:91]]) en una simulación que ya corre no arranca el concurso. La
nota de esa fila lo avisa: los concursos se arman desde [[app/competir]] o
con una simulación nueva.

## Los doce grupos {#grupos}
<!-- opciones.js GRUPOS y los parámetros de cada grupo; avanzado.js PRESETS_GRUPO (campo: tamano; fisica: medio); Avanzado.svelte (Ajustes F1 en el grupo modos) -->

Cada grupo tiene su página, con la ficha de cada parámetro: qué hace, su
valor por defecto, el rango y lo que hay que saber para usarlo bien.

### Campo y bordes {#campo}
El tamaño del mundo y si sus bordes son paredes o están conectados. Arriba
del grupo está el selector **Tamaño del campo**, con los quince tamaños
clásicos, para no escribir ancho y alto a mano. Ver
[[app/parametros-campo]].

### Energía y vegetales {#energia}
Cuánta energía da el sol, cuántos vegetales hay y cómo se reponen, cómo se
reparte lo que produce la fotosíntesis, cuánto roba un disparo, las mareas y
el interruptor general de las **Mutaciones**. Ver [[app/parametros-energia]].

### Luz y día/noche {#luz}
El ciclo de día y noche, el sol que se enciende o se apaga según la energía
total del mundo, el sol que se mueve al azar y el modo estanque, donde la
luz se apaga con la profundidad. Ver [[app/parametros-luz]].

### Física {#fisica}
Velocidad máxima, eficiencia del motor, rozamiento, densidad y viscosidad
del medio, gravedad, elasticidad de los choques, movimiento browniano y
opciones como **Sin inercia** o **Radio fijo**. Arriba está el selector
**Medio** (espacio, fluido o sólido), que pone de una vez los valores de
cada uno. Ver [[app/parametros-fisica]].

### Muerte y descomposición {#muerte}
Si los muertos quedan como cadáveres, cómo se descomponen y qué sueltan,
si los disparos de energía y de desechos se gastan, y desde cuántos desechos
acumulados un bot se intoxica ([[simulacion/energia#desechos]]). Ver
[[app/parametros-muerte]].

### Restricciones {#restricciones}
Tres prohibiciones para todos los bots: atarse, reproducirse solos (salvo
los vegetales repobladores) y fijarse en el lugar. Ver
[[app/parametros-restricciones]].

### Costos {#costos}
Lo que paga un bot por cada cosa que hace o tiene: cada tipo de instrucción,
moverse, girar, disparar, fabricar defensas, mantener el cuerpo y el ADN,
envejecer. Es el grupo más grande. Ver [[app/parametros-costos]].

### Costos dinámicos {#costos-dinamicos}
El multiplicador que escala todos los costos y el ajuste que lo mueve solo
para llevar la población a un objetivo. Ver
[[app/parametros-costos-dinamicos]].

### Formas (visión y deriva) {#formas}
Cómo se comportan los obstáculos: si los bots los ven, si son
transparentes, si frenan los disparos y si se desplazan solos por el campo.
Ver [[app/parametros-formas]].

### Modos de juego (F1 / rondas) {#modos}
Las reglas de los concursos del original: rondas, topes, descalificación y
el modo F1. Arriba está el botón **Ajustes F1** (ver abajo). Ver
[[app/parametros-modos]].

### Modo evolución {#evolucion}
Los parámetros del modo de evolución del original, con su depredador oculto.
Ver [[app/parametros-evolucion]].

### Registro {#registro}
Qué se anota mientras corre la simulación: el intervalo de los gráficos y
el registro de los bots que mueren. Ver [[app/parametros-registro]].

## Ajustes F1 {#ajustes-f1}
<!-- Avanzado.svelte (preset en grupo modos); borrador.js conAjustesF1; opciones.js ajustesF1 (F1_COSTOS, F1_OPTS, F1_NOMBRADAS); probado: t1.mjs (sobre Sopa primordial: 31 cambios, costos=f1, mutaciones no, bordes toroidal) -->

El botón **Ajustes F1**, en el grupo de modos de juego, hace lo mismo que el
botón del mismo nombre de la interfaz clásica: pone en el borrador los
costos de la liga F1 (todos los demás en 0), su física (suelo sólido,
velocidad máxima 180), el campo de 9237 × 6928 toroidal, la economía de
vegetales de la liga y las mutaciones apagadas. No toca las especies, los
objetos ni el resto de los parámetros. Como todo cambio, queda en el
borrador hasta que lo apliques o lances una simulación nueva.

Es distinto de cambiar la base a **Liga F1**: los Ajustes F1 escriben esos
valores como cambios sobre la base que tengas, y cambiar la base reemplaza
el punto de partida de todos los valores.

## Guardar y llevar tus ajustes {#guardar}
<!-- Experimentar.svelte (guardarComo, exportar, importar); lib/experimentar/archivo.js; búsqueda sin resultados de importadores de .set en web2/src, web2/engine y port/web -->

Los parámetros no se guardan sueltos: viajan dentro de un escenario. Para
conservar una configuración, usá **Guardar como escenario** en la columna
izquierda; para llevarla a otro navegador o pasársela a alguien, **Exportar**
la baja como .json e **Importar .json** la vuelve a cargar. Un escenario
guarda solo los parámetros que difieren de su base, así que el archivo queda
corto y se lee fácil. Todo está en [[app/escenarios]].

La app no lee los archivos de ajustes del DarwinBots de escritorio. Si tenés
una configuración vieja que querés reproducir, buscá cada valor por el nombre
de su variable (el buscador lo encuentra) y copialo a mano.
