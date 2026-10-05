---
titulo: Un bot que se mueve
resumen: "Tu primer bot desde cero, paso a paso: el gen mínimo que avanza, cómo apuntar y girar, y un bot completo que recorre el mundo virando cada tanto."
etiquetas: [tutorial, primer bot, movimiento, giro, rnd]
estado: revisada
---
Vamos a escribir tu primer bot de punta a punta. Empezamos con el ADN más
chico que hace algo, le agregamos giro, y terminamos con un bot que recorre
el mundo: avanza siempre y cada tanto vira a un rumbo nuevo. Cada paso
agrega una pieza al ADN y te dice qué deberías ver. La teoría completa del
lenguaje está en [[adn/estructura]] y [[adn/genes]]; acá escribimos.

## Paso 1: abrí un bot nuevo {#paso-1}
<!-- i18n/es/bots.json (bots.nuevo «+ Nuevo bot»); i18n/es/editor.json (editor.guardar.*, editor.borrador.*); app/bots.md #nuevo -->

1. Andá a la sección **Bots**, en la barra de arriba.
2. Tocá **+ Nuevo bot** y ponle nombre (por ejemplo, «Caminante»).
3. Se abre la ficha, en la pestaña **ADN**: ese es el editor. Mientras
   escribís, colorea cada clase de palabra, te autocompleta los nombres de
   las sysvars y avisa enseguida de las palabras que el motor leería
   distinto de lo que parecen (ver [[app/editor]]).

No hace falta guardar a cada rato: el editor conserva un borrador de lo que
escribís. Para dejarlo anotado como versión, usá el botón **Guardar v…** de
arriba, con su **Nota de la versión** si querés.

## Paso 2: el gen que avanza {#avanza}
<!-- 20-VM §5.1-5.3 (cond vacía = verdadero; los stores solo corren en el cuerpo), §7 (store: dirección del tope, valor debajo) -->

Todo bot que hace algo tiene al menos un _gen_, un trozo de ADN con esta
forma. Escribí:

```adn
' Mi primer bot: avanza siempre
cond
start
 10 .up store
stop
```

- [[op:cond]] abre el gen y empieza la zona de condiciones. Entre `cond` y
  `start` no pusimos nada, y un gen sin condiciones se ejecuta siempre.
- [[op:start]] abre el cuerpo: lo que el gen _hace_.
- `10 .up store` es una orden. Los números se apilan como platos: primero
  el 10, después la dirección [[.up]] (que vale 1). [[op:store]] saca los
  dos de arriba y escribe el valor de abajo en la dirección del tope: deja
  10 en `.up`. Por eso se escribe `valor dirección store`, nunca al revés
  (las reglas de la pila están en [[adn/pilas]] y [[adn/stores]]).
- [[op:stop]] cierra el gen.

Y `.up` es la sysvar que pide un empujón hacia adelante, hacia donde apunta
el bot. Escribir en su memoria es la única forma que tiene un bot de
actuar: moverse, girar, disparar y reproducirse son siempre stores.

Fijate que `.up` va sin asterisco: es la dirección, un número. Para leer lo
que hay en esa celda hace falta el asterisco, `*.up` (la confusión es
clásica: [[adn/errores#direccion]]).

## Paso 3: sembralo y miralo {#sembralo}
<!-- app/bots.md #sembrar (ficha → Sembrar; nombre, color, cantidad 5, energía 3000; «Sembrar en la corrida actual» / «Nuevo escenario con estos») -->

1. En la ficha del bot, tocá **Sembrar**: se abre el diálogo de siembra.
2. Dejá la **Cantidad de bots** en 5 y la **Energía inicial** en 3000, y
   elegí un **Color** que se distinga.
3. Elegí **Sembrar en la corrida actual** si tenés un mundo corriendo (si no
   hay ninguno, el botón está apagado), o **Nuevo escenario con estos**,
   que lo abre en Experimentar para que lo largues de ahí.

Qué deberías ver: los cinco bots salen hacia adelante, cada vez más rápido.
Cuando corrimos este ADN con el motor, la rapidez de uno de ellos, ciclo a
ciclo, fue esta:

| Ciclo | 1 | 2 | 3 | 4 | 5 | 6 | 7 en adelante |
|---|---|---|---|---|---|---|---|
| Rapidez | 7 | 13 | 20 | 26 | 33 | 40 | 40 |

<!-- probado con probar-adn (costos 0): «cond start 10 .up store stop» da velscalar 7, 13, 20, 26, 33 y 40, y la posición cambia en cada ciclo; cada 10 .up suma ~6,6 de velocidad (30-FISICA §2.1, eficiencia opt:12 = 0,66; tope opt:11 = 40) -->

Dos cosas para entender lo que viste:

- **`.up` no es una velocidad: es un empujón.** Cada uno se suma a la
  velocidad que el bot ya traía, así que empujando en cada ciclo acelera
  hasta el tope de la simulación (40 de fábrica; el bot lo lee en
  [[.maxvel]]). Y como este mundo no frena, si dejara de empujar seguiría
  deslizándose igual ([[simulacion/fisica#fuerzas]]).
- **La orden se cumple en el mismo ciclo y no se guarda.** Primero corre el
  ADN de todos los bots; después, en la fase _fuerzas y choques_, el motor
  junta el empujón que pediste, y en _movimiento_ lo aplica y deja la
  celda en 0. Por eso el gen corre en cada ciclo y vuelve a pedir el
  empujón. El orden entero del ciclo está en [[simulacion/ciclo]].

<!-- 10-CICLO §2 (el ADN → se borran los sentidos → los disparos → fuerzas y choques → movimiento → acciones → nacimientos y muertes → el sol); sysvars.yaml .up -->

Si un bot no se mueve, son casi siempre tres tropiezos de tipeo, y los tres
están contados en [[empezar/preguntas#no-se-mueve]]: el `store` escrito al
revés, una sysvar mal tipeada o el `start` que falta.

Para mirarlo de cerca, hacé clic en un bot. En el inspector, el **Resumen**
trae **Genes activos este ciclo** (acá, el gen 1 en todos) y la pestaña
**Memoria** deja consultar cualquier celda: en [[.up]] vas a ver siempre 0,
porque el motor ya la usó; [[.aim]] te dice el rumbo (ver
[[app/inspector]]).

## Paso 4: apuntar y girar {#girar}
<!-- sysvars.yaml .aim .setaim .aimsx .aimdx (rumbo al nacer: al azar); 30-FISICA §7 -->

Un bot también tiene un _rumbo_: hacia dónde apunta y hacia dónde empuja
`.up`. Se lee en [[.aim]], en una escala donde una vuelta completa son 1256
unidades: 0 es la derecha de la pantalla, 314 arriba, 628 a la izquierda y
942 abajo. Cada bot nace apuntando para cualquier lado.

Hay dos formas de girarlo, y vas a verlas en todos los bots del Bestiario:

- [[.setaim]] gira _hasta_ un rumbo absoluto: escribís adónde querés que
  apunte y queda ahí. Acepta cualquier número (usa su resto de dividir por
  1256) y solo actúa si el rumbo pedido es distinto del actual.
- [[.aimsx]] y [[.aimdx]] giran _tanto_: 50 por ciclo hacia la izquierda o
  la derecha, respectivamente.

Probá cambiar el cuerpo del gen así:

```adn
' Apunta siempre hacia arriba y avanza
cond
start
 314 .setaim store
 10 .up store
stop
```

En nuestra corrida, giró a 314 en el primer ciclo y de ahí en más sube;
escribir 314 una y otra vez no lo hace temblar. Eso sí: el empujón se
calcula con el rumbo de _antes_ del giro, así que el primer empujón sale
para el lado viejo y recién al ciclo siguiente avanza hacia donde pidió. Y
como nada lo frena, la velocidad que traía del arranque lo sigue arrastrando
un poco de costado mientras sube.

<!-- probado con probar-adn: aim 314 desde el ciclo 1 y no oscila; el empujón sale con el rumbo previo (30-FISICA §2.1: VoluntaryForces usa el rumbo de antes del giro, y §7: el giro va después, en movimiento); con 628 .aimsx + 10 .up por ciclo, velup sale −7 respecto del rumbo nuevo -->

Ahora, virar al azar. [[op:rnd]] cambia el número de arriba de la pila por
uno sorteado entre 0 y ese número, los dos incluidos: `1256 rnd` da
cualquier rumbo posible.

```adn
' Rumbo nuevo al azar en cada ciclo
cond
start
 1256 rnd .setaim store
stop
```

Corrido, camina como borracho: cada ciclo sale para otro lado y apenas
levanta velocidad. Sirve para ver que girar es un store más; para explorar
de verdad conviene virar cada tanto, no siempre.

<!-- 20-VM §6.1 (rnd); probado: el rumbo cambia en cada ciclo -->

## Paso 5: el bot completo {#el-bot}

El bot de este tutorial avanza siempre y cada tanto cambia de rumbo: recta
larga, vira, otra recta. Son dos genes:

```adn
' Un bot que se mueve: avanza y cada tanto vira

' Gen 1: empuja hacia adelante siempre
cond
start
 10 .up store
stop

' Gen 2: una de cada tantas veces, rumbo nuevo al azar
cond
  20 rnd 0 =
start
 1256 rnd .setaim store
stop
end
```

El gen 1 es el de siempre. El gen 2 tiene ahora condiciones, y aprovecha
que en la zona de condiciones corre todo menos los stores: `20 rnd` sortea
un número entre 0 y 20, y `0 =` pregunta si salió 0. Sale una de cada 21
veces en promedio; las demás, el cuerpo no corre y el bot sigue derecho.
Cuando sale, el cuerpo elige un rumbo nuevo al azar. Para que vire más
seguido, bajá el 20; para que vire menos, subilo.

<!-- 20-VM §1 (en la zona de condiciones se ejecuta todo menos los stores), §6.1 (rnd); probado con probar-adn, 120 ciclos: rapidez 40, el rumbo 682 duró unos 30 ciclos y después cambió a 739, 790, 885…, unas cinco viradas en total -->

Cuando lo corrimos durante 120 ciclos, mantuvo la rapidez al tope y viró
unas cinco veces: fue derecho un trecho, cambió de rumbo, siguió, virió de
nuevo… Lo que no hace es esquivar los bordes: al llegar a una pared siguió
empujando contra ella y deslizándose de costado hasta que le tocó un rumbo
que lo alejó. Si querés que gire al tocar el borde, agregá un gen que gire
mientras [[.edge]] esté en 1: el ejemplo está en [[sysvars/movimiento]].

<!-- probado: contra el borde izquierdo quedó apretado unas 50 ciclos, deslizándose, hasta el rumbo nuevo; 30-FISICA §5 (los bots no rebotan: quedan contra la pared) -->

Este esqueleto de «avanzar y virar» es el que usan los exploradores del
Bestiario desde hace más de veinte años. El First bot 4G de Jez (marzo de
2004), por ejemplo, gira 150 hacia la derecha en cada ciclo mientras no ve
nada, y cuando ve algo avanza y dispara; un cuarto gen suyo vira también si
quien ve resulta ser de los suyos: tu bot más un par de ojos, un disparo y
un esquiva-parientes. Los ojos se agregan en el tutorial que sigue.
<!-- Bestiario: First_bot_4G_Jez_-04.03.04.txt (gen «*.eye5 0 =» → 150 .aimdx store; gen «*.eye5 0 >» → 10 .up store y −1 .shoot store; gen 4: «*.refeye 3 = *.eye5 0 !=» → 150 .aimdx store: vira al ver otro First bot, cuya firma marca .refeye en 3); 32-VISION -->

## Qué probar después {#despues}

- **Velocidad y fricción.** El tope de 40 y la eficiencia del empuje son
  ajustes del mundo, y el rozamiento, el fluido o la gravedad cambian por
  completo cómo se desliza un bot. El mecanismo está en
  [[simulacion/fisica]] y se juega con los valores en
  [[app/experimentar]].
- **Energía y costos.** En los escenarios de fábrica, salvo Partido F1,
  moverse no gasta nada. Pero donde los costos están encendidos se cobran
  de verdad: con las reglas F1 cada empujón, cada giro y cada instrucción
  del ADN salen energía, y un bot que solo avanza puede morirse de hambre.
  Cómo se cobra cada cosa está en [[simulacion/energia]] (y ojo: la prueba
  rápida del editor, **Probar**, usa las reglas F1 por defecto).
  <!-- simulacion/energia #mantenimiento (los escenarios de fábrica salvo Partido F1 con costos 0); 30-FISICA §2.1 (costo del empuje) y §7 (costo del giro); app/editor #probar (Reglas F1 por defecto y su aviso) -->
- **El próximo paso**: darle ojos y algo que cazar, en
  [[tutoriales/busca-comida]].
