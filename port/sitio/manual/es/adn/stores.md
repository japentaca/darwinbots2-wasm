---
titulo: Escribir en la memoria
resumen: "Cómo store, inc, dec y el resto de la familia escriben en la memoria del bot, qué toman de la pila y cuándo actúa el motor sobre lo que escribiste."
etiquetas: [store, inc, dec, memoria, sysvars, latencia]
estado: revisada
---
Un bot no tiene otra forma de actuar que escribir en su memoria. Moverse, girar,
disparar o reproducirse son siempre lo mismo: poner un número en una dirección que
el motor mira. Las palabras que escriben se llaman _stores_, y esta página explica
cómo funcionan, qué direcciones aceptan y en qué momento el motor hace algo con lo
escrito.

La memoria tiene 1000 celdas, numeradas del 1 al 1000. Las que tienen nombre, como
[[.up]] (la 1) o [[.nrg]] (la 310), son las _sysvars_; el resto es memoria libre
para tus propias variables (ver [[adn/numeros]] y [[adn/memoria]]).

## store: valor abajo, dirección arriba
<!-- 20-VM §7 (dirección del tope, valor debajo); sysvars.yaml 1 (up) -->

[[op:store]] saca dos números de la [[adn/pilas|pila entera]]: primero la
**dirección** (el tope) y después el **valor** (el que estaba debajo). Por eso
siempre se escribe en este orden:

```adn
' sube: escribe 50 en .up cada ciclo
cond
start
50 .up store
stop
```

Fijate que `.up` sin asterisco es solo el número 1, la dirección. El asterisco lee
la celda: `*.up` apila lo que _hay_ en la dirección 1. Para escribir en una
sysvar va su dirección, sin asterisco.

Este bot empuja hacia adelante 50 unidades por ciclo. Si lo corrés, vas a ver que
se desplaza en la dirección en que apunta, primero acelerando y después a una
velocidad pareja.

## inc y dec
<!-- 20-VM §7 (inc/dec: un operando, costo /10); 21-MEMORIA §2 (memoria libre persistente) -->

[[op:inc]] y [[op:dec]] sacan **un solo** número, la dirección, y le suman o restan
1 a lo que haya en esa celda. Son la forma más barata de llevar un contador:

```adn
' cuenta los ciclos en la celda 50
start
50 inc
stop
```

Después del primer ciclo la celda 50 vale 1, después del segundo 2, y así. La
memoria libre no se borra entre ciclos: lo que guardás ahí queda hasta que lo
cambies vos.

## La familia completa
<!-- 20-VM §7 (tabla de los 14 stores); §6.1 (div bancario) -->

Además de `store`, `inc` y `dec` hay once stores más. Todos toman la dirección del
tope de la pila; los de dos operandos toman además un valor `v` de debajo. En la
tabla, `m` es lo que había en la celda antes.

| Palabra | Saca de la pila | Deja en la celda |
|---|---|---|
| [[op:store]] | `v` y dirección | `v` |
| [[op:inc]] / [[op:dec]] | dirección | `m + 1` / `m − 1` |
| [[op:addstore]] / [[op:substore]] | `v` y dirección | `m + v` / `m − v` |
| [[op:multstore]] | `v` y dirección | `m · v` |
| [[op:divstore]] | `v` y dirección | `m / v` redondeado; 0 si `v` es 0 |
| [[op:ceilstore]] / [[op:floorstore]] | `v` y dirección | el menor / el mayor entre `m` y `v` |
| [[op:rndstore]] | dirección | un número al azar entre 0 y `m` (con el signo de `m`) |
| [[op:sgnstore]] | dirección | −1, 0 o 1 según el signo de `m` |
| [[op:absstore]] / [[op:negstore]] | dirección | `m` sin signo / `m` cambiado de signo |
| [[op:sqrstore]] | dirección | la raíz cuadrada de `m` redondeada; 0 si `m` no es positivo |

Un ejemplo que encadena varios sobre la misma celda:

```adn
start
10 50 store
5 50 addstore
3 50 multstore
4 50 divstore
2 50 substore
stop
```

La celda 50 pasa por 10, 15, 45, 11 y termina en 9. Fijate en el paso de
[[op:divstore]]: 45 / 4 es 11,25 y queda 11. La división redondea al entero más
cercano (y en el empate exacto, al par), no trunca.

Cada store tiene su ficha en [[operadores/escritura]], con el costo de cada uno.

## Qué direcciones se pueden escribir
<!-- 20-VM §0.6, §7 (Abs Mod 1000, 0 → 1000; dirección 0 no-op sin costo; orden de los pops) -->

Cualquiera del 1 al 1000. No hay direcciones prohibidas ni errores: si la dirección
calculada se sale de ese rango, se le saca el signo y se toma el resto de dividirla
por 1000, así que `-53` escribe en la 53 y `1050` en la 50. Un múltiplo de 1000
cae en la 1000.

La excepción es la dirección **0**: un store a 0 no hace nada y no cuesta energía.
Ojo con un detalle: `store`, `addstore`, `substore` y `multstore`, cuando la
dirección es 0, ni siquiera sacan el valor, que queda en la pila para lo que venga
después. `divstore`, `ceilstore` y `floorstore`, en cambio, lo sacan igual y se
pierde.

```adn
start
7 0 store
60 store
stop
```

El primer `store` va a la dirección 0 y no hace nada, pero deja el 7 en la pila; el
segundo lo encuentra y la celda 60 termina valiendo 7.

## Qué valores se guardan
<!-- 20-VM §7 (mod32000 y sus excepciones), §2.4 (literal fuera de rango) -->

Cada celda guarda números entre −32000 y 32000. Antes de escribir, el valor pasa
por un recorte circular: se toma el resto de dividirlo por 32000, conservando el
signo. Así 32001 se guarda como 1 y −32001 como −1. Los múltiplos exactos de 32000
no se convierten en 0 sino en ±32000: `32000 2 mult 51 store` deja 32000.

Los stores de un operando que no pueden salirse del rango (`divstore`, `rndstore`,
`sgnstore`, `absstore`, `sqrstore` y `negstore`) escriben el resultado tal cual.

:::nota
Un número escrito literalmente en el ADN tiene que estar entre −32768 y 32767. Si
ponés, por ejemplo, `40000`, el bot entero no carga. Para llegar a valores grandes,
calculalos con operadores.
:::

## Escribir sysvars que no son tuyas
<!-- 21-MEMORIA §3 (regímenes A, B y C; configuración persistente) -->

Podés escribir en cualquier sysvar, también en las que el motor usa para contarte
cosas, como [[.nrg]] o [[.robage]]. No da error, pero no sirve: el motor las
reescribe en cada ciclo después de que corre tu ADN. Este bot intenta ponerse 123
de edad:

```adn
start
123 .robage store
stop
```

Si lo corrés, `.robage` vale 1, 2, 3… igual que en cualquier otro bot: la edad la
publica el motor y pisa lo que hayas puesto. Lo mismo pasa con la energía, el
cuerpo, la posición, la velocidad o el ángulo de [[.aim]].

En la práctica, cada sysvar es de una de estas clases (su ficha en
[[sysvars/todas|la referencia de sysvars]] te dice cuál):

| Clase | Ejemplos | Qué pasa con lo que escribís |
|---|---|---|
| Órdenes | [[.up]], [[.aimdx]], [[.shoot]] | El motor las aplica en este mismo ciclo y las vuelve a 0 |
| Sentidos | [[.eye5]], [[.robage]], [[.nrg]] | El motor las reescribe; tu valor se pierde |
| Configuración | [[.focuseye]], [[.out1]] | Quedan como las dejaste: el motor las lee pero no las borra |
| Memoria libre | la 50, la 60 | Nadie las toca; son tuyas |

## Cuándo actúa el motor
<!-- 20-VM §0.2 (stores inmediatos); 10-CICLO §2 (paso 10 ADN, 12-16 motor); 21-MEMORIA §3 (excepciones: repro, strbody/fdbody, shootval) -->

Los stores son inmediatos: la celda cambia en el momento en que se ejecuta la
palabra, y lo que viene después en tu ADN ya ve el valor nuevo.

```adn
start
50 .up store
*.up 60 store
stop
```

La celda 60 termina en 50, porque `*.up` lee la orden recién escrita. Pero si
mirás `.up` desde afuera, al final del ciclo, vale 0: el motor ya la usó para mover
al bot y la borró.

Eso es porque cada ciclo tiene un orden fijo (lo cuenta [[simulacion/ciclo]]):
primero corre el ADN de todos los bots, y recién después el motor mueve, dispara,
cobra energía y actualiza los sentidos. De ahí salen tres reglas:

- **Las órdenes se cumplen en el mismo ciclo.** Lo que escribís en `.up` o
  `.shoot` se aplica antes de que empiece el ciclo siguiente, y el motor la deja en
  0. Por eso hay que volver a escribirla en cada ciclo en que la quieras.
- **Los sentidos llegan con un ciclo de atraso.** Lo que ves en `.eye5` o en
  [[.robage]] lo escribió el motor al final del ciclo anterior. Si girás ahora, lo
  que ves después del giro lo leés recién en el próximo ciclo.
- **Lo que no es de nadie persiste.** La memoria libre y la configuración quedan
  como las dejaste.

Hay algunas órdenes que no se borran siempre. [[.repro]] queda escrita hasta que la
reproducción sale bien, así que se reintenta sola cada ciclo. [[.fdbody]] y
[[.strbody]] solo actúan si son positivas: un valor negativo se borra sin
efecto (en el DarwinBots original quedaba ahí para siempre). Y [[.shootval]] solo se borra cuando de verdad se dispara.

## Stores y condiciones
<!-- 20-VM §1 (tipo 7: body/ELSEBODY y CondStateIsTrue), §4; core vm.hpp: el gate va antes de ExecuteStores -->

Un store no se ejecuta siempre que aparece: solo corre dentro del cuerpo de un gen
(después de `start` o `else`), y además mira la pila booleana. Si encima de esa pila
hay un _falso_, el store se saltea, y en ese caso no saca nada de la pila entera.
Todo eso se explica en [[adn/condiciones]].

<!-- 20-VM §7 (TieAngOverwrite/TieLenOverwrite solo en los de dos operandos), §12.6 -->

:::cuidado
Una rareza que viene del DarwinBots 2.48.32: cuando escribís en
[[.tieang1]]…`.tieang4` o [[.tielen1]]…`.tielen4` para fijar el ángulo o el largo
de un lazo, solo los stores de dos operandos (`store`, `addstore`, `substore`,
`multstore`, `divstore`, `ceilstore` y `floorstore`) le avisan al sistema de lazos.
Un `inc`, un `dec` o un `negstore` sobre esas celdas cambian el número pero el lazo
no se entera. Si querés sumar 1, escribí `1 .tieang1 addstore`.
:::

## Costos
<!-- 20-VM §1 (COSTSTORE solo si escribe), §7 (fracciones por store) -->

Cada store que se ejecuta cobra energía: `store` cobra el costo completo de
escritura, y el resto una fracción (`inc` y `dec`, un décimo). Un store salteado,
o uno a la dirección 0, no cobra nada. Los números concretos dependen de la
configuración de la simulación; los ves en [[adn/ejecucion]].
