---
titulo: Errores frecuentes
resumen: "Los tropiezos más comunes al programar un bot, con su síntoma, su causa y cómo arreglarlos."
etiquetas: [errores, depuración, adn, consejos]
estado: revisada
---
El ADN casi nunca se queja. El cargador no rechaza un bot por estar mal
escrito: toda palabra que no entiende se convierte en el número 0, y ninguna
operación puede romper la ejecución (dividir por cero da 0, sacar de una pila
vacía da 0). La consecuencia es que un error rara vez se ve como un error: se
ve como un bot que _no hace nada_, o que hace otra cosa.

Esta página junta los tropiezos más comunes. Para cada uno vas a encontrar el
síntoma, la causa y un ejemplo mal y bien. Algunos los detecta el
[[app/editor|editor de ADN]], que te avisa mientras escribís; la mayoría no.

| Síntoma | Mirá |
|---|---|
| El bot no se mueve ni hace nada | [[adn/errores#nombre|nombre mal escrito]], [[adn/errores#start-stop|start o stop]], [[adn/errores#direccion|.up y *.up]] |
| Una acción se repite cada ciclo, o se olvida | [[adn/errores#accion|sysvars de acción]] |
| Un store «a veces» no escribe | [[adn/errores#booleana|condiciones en la pila]] |
| Una condición nunca se cumple | [[adn/errores#pila-vacia|pila vacía]], [[adn/errores#direccion|.up y *.up]] |
| Números raros en la memoria | [[adn/errores#division|división por cero]], [[adn/errores#rango|fuera de rango]] |
| La población se mata entre sí | [[adn/errores#especie|disparar a la especie]] |

## Una sysvar mal escrita {#nombre}
<!-- 20-VM §0.4, §2.4 (palabra desconocida = 0; privadas case-sensitive y resueltas al leer), §7 (store a 0 sin costo); lint de db_dna_lint -->

**Síntoma:** el bot carga, pero la acción no ocurre nunca.

**Causa:** un nombre con punto que no es una sysvar ni una variable de
[[adn/def|def]] vale 0. Un [[op:store]] a la dirección 0 no hace nada (y no
cuesta nada), así que `30 .upp store` desaparece sin dejar rastro. Lo mismo
pasa si te olvidás el punto: `up` sin punto no es un nombre, es una palabra que
vale 0.

```adn sin-lint
cond
start
30 .upp store
30 up store
stop
```

El editor marca las dos: «¿quisiste decir .up?» y «¿falta el punto?». Bien:

```adn
cond
start
30 .up store
stop
```

Con una variable propia pasa algo parecido si la usás antes de su `def`: el
cargador lee el archivo de arriba abajo y en ese momento el nombre todavía no
existe. Poné los `def` al principio. Ojo también con las mayúsculas: las
sysvars se reconocen sin importar mayúsculas y minúsculas, pero los nombres de
`def` no.

```adn sin-lint
cond
start
.contador inc
stop

def contador 50
```

```adn
def contador 50

cond
start
.contador inc
stop
```

El primero no cuenta nada; el segundo suma 1 por ciclo en la dirección 50.

## Olvidarse del start o del stop {#start-stop}
<!-- 20-VM §1 (stores solo en body/ELSEBODY), §2.5 (sin validación estructural), §5.5 -->

**Síntoma:** un gen no se ejecuta, o se ejecuta solo cuando se cumple la
condición de _otro_ gen.

**Causa:** lo único que habilita a ejecutar es un `start` (o un `else`). Lo que
va entre `cond` y `start` son las condiciones: ahí un `store` no escribe. Y lo
que queda después de un `stop` y antes del próximo `cond` o `start` no se
ejecuta nunca. Todo eso carga sin avisos. Las reglas completas están en
[[adn/genes]].

Este bot quiere avanzar, pero le falta el `start`, así que se queda quieto:

```adn
cond
30 .up store
stop
```

Este otro quiere avanzar cuando tiene más de 5 ciclos y girar siempre. Como el
segundo bloque quedó después del `stop` sin un `start` propio, no gira nunca:

```adn
cond
*.robage 5 >
start
30 .up store
stop

' girar siempre
40 .aimdx store
```

Si en cambio borrás el `stop`, el giro pasa a ser parte del primer gen y solo
ocurre cuando [[.robage]] supera 5. Lo correcto es darle su propio gen. Un
`start` sin `cond` delante se ejecuta siempre:

```adn
cond
*.robage 5 >
start
30 .up store
stop

' girar siempre
start
40 .aimdx store
stop
```

## Esperar que una sysvar de acción conserve su valor {#accion}
<!-- 21-MEMORIA §3 (régimen B: publicadas; régimen C: órdenes consumidas en el mismo ciclo) -->

**Síntoma:** querés que algo pase una sola vez y pasa todos los ciclos, o
querés acumular un valor y no crece.

**Causa:** muchas sysvars son órdenes para el motor: [[.up]], [[.aimdx]],
[[.shoot]] y compañía. El motor las aplica y las vuelve a 0 en el mismo ciclo,
así que al ciclo siguiente leés 0. Otras, como [[.nrg]] o [[.aim]], las
reescribe el motor en cada ciclo con el valor real: lo que guardes ahí se
pierde. Ninguna de las dos sirve como memoria. En [[simulacion/ciclo]] está el
orden en que pasa cada cosa.

Este bot quiere girar una vez, «mientras .aimdx esté en 0». Como el motor lo
vuelve a 0 después de cada giro, gira 100 unidades en _todos_ los ciclos:

```adn
cond
*.aimdx 0 =
start
100 .aimdx store
stop
```

Para recordar algo usá la memoria libre (por ejemplo la dirección 50, ver
[[adn/memoria]]). Este gira una vez y anota que ya lo hizo:

```adn
cond
*50 0 =
start
100 .aimdx store
1 50 store
stop
```

## .up no es *.up {#direccion}
<!-- 20-VM §2.4 (.nombre = dirección), §1 (tipo 1 lee); sysvars.yaml 310; 21-MEMORIA §0.3 -->

**Síntoma:** una condición que debería cumplirse nunca se cumple (o se cumple
siempre).

**Causa:** `.nrg` es la _dirección_ de la energía (310), no la energía. Para
leer lo que hay en esa dirección hay que poner un asterisco: `*.nrg`. Este bot
compara 310 con 1000, así que no avanza nunca, tenga la energía que tenga:

```adn
cond
.nrg 1000 >
start
30 .up store
stop
```

Bien:

```adn
cond
*.nrg 1000 >
start
30 .up store
stop
```

La regla es simple: con asterisco para _leer_ (`*.eye5`, `*.nrg`), sin
asterisco para decir _dónde_ escribir (`30 .up store`). Más detalles en
[[adn/numeros]] y [[adn/stores]].

:::nota
Lo que el motor escribe para el bot llega con un ciclo de retraso: un bot
recién sembrado lee `*.nrg` en 0 durante su primer ciclo. Por eso el ejemplo
bueno empieza a moverse en el segundo ciclo (ver [[adn/ejecucion#retraso]]).
:::

## La pila vacía {#pila-vacia}
<!-- 20-VM §3 (pop vacío = 0; booleana vacía = verdadero; dup apila dos ceros), §6.4 -->

**Síntoma:** un store escribe 0, o una comparación da siempre lo mismo.

**Causa:** sacar un número de la [[adn/pilas|pila]] vacía no es un error: da 0.
Si te falta un operando, la operación sigue con un 0 en su lugar. Este bot
quería avanzar, pero el [[op:store]] no tiene valor que escribir y escribe 0
en `.up`:

```adn
cond
start
.up store
stop
```

En las condiciones pasa lo mismo. Acá falta el número contra el que comparar,
así que [[op:>]] compara `0 > edad`, que es siempre falso:

```adn
cond
*.robage >
start
30 .up store
stop
```

Bien: `*.robage 0 >`. Dos rarezas más que conviene conocer: [[op:dup]] con la
pila vacía apila dos ceros, y una pila _booleana_ vacía cuenta como
verdadera, por eso un `cond start` sin condiciones se ejecuta siempre.

## Condiciones que se quedan en la pila booleana {#booleana}
<!-- 20-VM §4 (tipo 7: CondStateIsTrue sin consumir), §6.6 -->

**Síntoma:** dentro de un gen, un store que no tiene condición no se ejecuta.

**Causa:** una condición escrita dentro del cuerpo (después del `start`) deja
su resultado en la pila booleana, y ese resultado gobierna _todos_ los stores
que siguen hasta el `stop`, no solo el primero. Nada lo saca de ahí salvo que
vos lo hagas. Es la idea de [[adn/condiciones]].

Este bot quiere disparar cuando ve algo y avanzar siempre. Como la condición
de [[.eye5]] queda en la pila, sin nada a la vista tampoco avanza:

```adn
cond
start
*.eye5 0 >
-1 .shoot store
30 .up store
stop
```

Dos arreglos: sacar el resultado con [[op:dropbool]] después de usarlo, o
poner primero lo incondicional.

```adn
cond
start
30 .up store
*.eye5 0 >
-1 .shoot store
stop
```

En la sección de condiciones (entre `cond` y `start`) pasa lo contrario: todo
lo que queda en la pila se une con «y». Si querés «o», tenés que escribir
[[op:or]].

## El else después del start {#else}
<!-- 20-VM §5.4 (original); core vm.hpp ExecuteFlowCommands (A2-1); README del port -->

En el DarwinBots 2.48.32 original, un `else` que venía después de un `start`
nunca ejecutaba su cuerpo, se cumpliera o no la condición. Los autores lo
documentaban como «igual que start pero se activa si la condición es falsa»,
pero el programa no lo hacía. Este port lo corrige: el `else` corre cuando las
condiciones del gen son falsas.

```adn
cond
*.robage 30000 >
start
30 .up store
else
30 .dn store
stop
```

Este bot retrocede (la condición es falsa y corre el `else`); en el original
se quedaba quieto. Si cargás un bot viejo del foro que use `start … else`,
tené en cuenta que acá se va a comportar distinto que en su época. Más en
[[adn/genes]] y [[tecnico/diferencias]].

## Divisiones por cero {#division}
<!-- 20-VM §6.1 (div y mod por 0 → 0; div bancario), §7 (divstore v=0 → 0) -->

**Síntoma:** un cálculo da 0 sin motivo aparente.

**Causa:** [[op:div]], [[op:mod]] y [[op:divstore]] con divisor 0 no fallan:
dan 0. Si el divisor sale de la memoria (y la memoria arranca en 0), el
resultado es 0 hasta que alguien escriba ahí. Además `div` no trunca: redondea
al entero más cercano y, en el empate, al par, así que `7 2 div` da 4 y
`5 2 div` da 2.

Si un 0 en el divisor tiene otro significado para vos, preguntá antes:

```adn
cond
*51 0 !=
start
1000 *51 div 50 store
stop
```

## Valores fuera de rango {#rango}
<!-- 20-VM §2.4 (literal fuera de rango: no carga), §7 (mod32000; Abs Mod 1000) -->

**Síntoma:** el bot no carga, o un valor guardado aparece cambiado.

**Causa:** hay tres límites (todos en [[adn/numeros]]):

- Un número escrito en el ADN tiene que estar entre −32768 y 32767. Si no, el
  bot entero no carga.
- Lo que un store escribe en la memoria se ajusta al rango ±32000 dando la
  vuelta: guardar 40000 deja 8000, e [[op:inc]] sobre 32000 deja 1.
- Las direcciones dan la vuelta cada 1000: `30 1001 store` escribe en la
  dirección 1, que es `.up`, y el bot avanza.

```adn sin-lint
cond
start
40000 50 store
stop
```

Este no carga. Si necesitás el número grande, calculalo:
`20000 20000 add 50 store` carga, pero deja 8000 por la vuelta de ±32000.
Además, cada sysvar tiene su propio rango útil: está en su ficha de
[[sysvars/todas|la referencia]].

## ADN largo que gasta energía {#adn-largo}
<!-- 20-VM §1, §4 (FLOWCOST siempre), §5.2 (AddupCond sin cortocircuito), §7; 31-ENERGIA §1 -->

**Síntoma:** el bot pierde energía aunque casi no se mueva.

**Causa:** según cómo esté configurado el mundo, el ADN cuesta. Cada palabra
que se ejecuta tiene un costo según su tipo, cada store que escribe cobra el
suyo, y puede haber además un costo por ciclo proporcional al largo del ADN y
otro al copiarlo cuando el bot se reproduce. Los costos y cómo se configuran
están en [[adn/ejecucion]].

Lo que conviene saber al escribir:

- Las condiciones de un `cond` se evalúan _todas_, todos los ciclos, aunque la
  primera ya sea falsa: no hay atajo.
- El cuerpo de un gen que no corre no cobra, pero los `cond`, `start`, `else`
  y `stop` se cobran siempre.
- Un store solo cobra si escribe: los que una condición en línea frena no
  cuestan.
- Los genes muertos (que nunca se cumplen) siguen pagando sus condiciones y el
  largo. Si no los usás, borralos. [[.dnalen]] te dice cuánto mide tu ADN.

## Dispararle a tu propia especie {#especie}
<!-- 33-SHOTS §0.2-0.3; core shots.hpp (inmunidad filial corregida B3-1, age <= 1); comprobado en el port: 4 bots, campo 1000x1000, 60 ciclos -->

**Síntoma:** la población propia se achica sola, sobre todo si hay pocos
vegetales.

**Causa:** el disparo no distingue especies. Un bot nunca se pega con su
propio disparo, pero sí a cualquier otro que se cruce, incluidos sus hermanos
(un recién nacido solo está protegido de los disparos de su padre en sus
primeros instantes). Un bot que dispara a todo lo que ve termina comiéndose a
los suyos. Ver [[simulacion/disparos]].

Mal: gira hasta ver algo y le dispara.

```adn
cond
*.eye5 0 =
start
50 .aimdx store
stop

cond
*.eye5 0 >
start
-1 .shoot store
stop
```

Bien: compara [[.refeye]] con [[.myeye]], una firma que depende del ADN y que
los bots de la misma especie comparten. Es el truco de _Animal Minimalis_, de
Numsgil, uno de los bots del Bestiario:

```adn
cond
*.eye5 0 =
*.refeye *.myeye = or
start
50 .aimdx store
stop

cond
*.eye5 0 >
*.refeye *.myeye !=
start
-1 .shoot store
stop
```

En una prueba con cuatro bots iguales en un mundo chico, sin comida, la
primera versión perdió dos en 60 ciclos; con la segunda los cuatro seguían
con la energía intacta. El paso a paso está en
[[tutoriales/reconoce-especie]].
