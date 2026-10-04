---
titulo: "Genes: cond, start, else y stop"
resumen: "Cómo se arma un gen con cond, start, else y stop, qué partes del ADN se ejecutan y cómo se numeran los genes."
etiquetas: [gen, cond, start, else, stop, flujo]
estado: revisada
---
El ADN de un bot es una lista larga de palabras que se recorre entera, de
izquierda a derecha, una vez por ciclo. Lo que la ordena son cuatro marcadores
de flujo: [[op:cond]], [[op:start]], [[op:else]] y [[op:stop]]. Con ellos se
arman los _genes_: trozos de ADN que se ejecutan solo si se cumplen ciertas
condiciones.

No hay anidamiento ni bloques: los cuatro marcadores son planos, y cada uno
cambia el estado del intérprete al pasar por él. Esta página cuenta qué hace
cada uno, con ejemplos que corrimos en el port.

## Anatomía de un gen
<!-- 20-VM §5.1-5.4; core vm.hpp ExecuteFlowCommands (else corregido, A2-1) -->

La forma típica es esta:

```adn
' Avanza los primeros 10 ciclos de vida y despues retrocede
cond
 *.robage 10 <
start
 10 .up store
else
 10 .dn store
stop
```

- `cond` abre el gen y empieza la _zona de condiciones_.
- `start` cierra las condiciones y abre el _cuerpo_, que se ejecuta si todas
  dieron verdadero.
- `else` abre un segundo cuerpo, que se ejecuta si alguna dio falso.
- `stop` cierra el gen.

Este bot empuja hacia adelante con [[.up]] mientras su edad ([[.robage]]) es
menor que 10, y después empuja hacia atrás con [[.dn]]. Corriéndolo, el bot
avanza unas 400 unidades, frena por la inercia hacia el ciclo 16 y vuelve sobre
sus pasos.

## La zona de condiciones
<!-- 20-VM §1 (tabla: stores solo en body/ELSEBODY), §5.1-5.2 (AddupCond, vacío = verdadero), §6.6 -->

Entre `cond` y `start` se ejecuta todo **menos los stores**: números, lecturas
de memoria, operadores y comparaciones. Así que podés calcular antes de
comparar:

```adn
' En la zona de condiciones se puede calcular, pero no escribir
cond
 2 3 add 5 =
 7 87 store
start
 1 88 store
stop
```

Acá la condición es `2 3 add 5 =` (verdadera) y el cuerpo escribe 1 en la
dirección 88. El `7 87 store` de la zona de condiciones no escribe nada: un
[[op:store]] solo actúa dentro de un cuerpo.

Las comparaciones, como [[op:<]] o [[op:=]], dejan su resultado en la pila
booleana (ver [[adn/pilas]]). Lo que pasa con esa pila en cada marcador es la
clave de todo:

- `cond` **vacía** la pila booleana al empezar.
- `start` (y `else`, cuando viene pegado a las condiciones) hace un **Y lógico
  de todo lo que haya en la pila booleana** y la deja vacía. Si todo es
  verdadero, se ejecuta el cuerpo.
- Si no hubo ninguna comparación, la pila está vacía y cuenta como
  **verdadera**: `cond start … stop` se ejecuta siempre.

No hace falta escribir [[op:and]] entre condiciones: tres comparaciones
seguidas ya se combinan con Y. Para un O, usá [[op:or]] explícito.

## Un start sin cond
<!-- 20-VM §5.2 paso 2, §5.5 -->

Un `start` que no viene detrás de un `cond` abre un gen **sin condiciones**:
se ejecuta todos los ciclos. Es lo mismo que `cond start`, y muchos bots
empiezan así. Bardus, de Moonfisher, es un bot entero de un solo gen
`cond start … stop` que resuelve todo con aritmética, sin una sola
comparación.

## El else {#else}
<!-- 20-VM §5.4 describe el original (else tras start muerto); core vm.hpp ExecuteFlowCommands: elseok/elsecond (A2-1); README del port, «Bugs del original corregidos» -->

En esta versión, el `else` funciona como uno espera:

```adn
' Gen con else: escribe 1 o 2 en la direccion 60 segun *50
cond
 *50 0 >
start
 1 60 store
else
 2 60 store
stop
```

Con la dirección 50 en 0, el bot escribe 2 en la 60; con la 50 en 5, escribe
1. El `else` usa el resultado de las condiciones que abrieron el `start`
anterior.

:::cuidado
En el DarwinBots 2.48.32 original, el cuerpo de un `else` que venía después de
un `start` **no se ejecutaba nunca**, fuera cierta o falsa la condición, aunque
la ayuda del programa decía lo contrario. El port lo corrige, y por eso los
bots viejos que usan `start … else` (Lionfish o Zer0Bot, entre otros) se
comportan distinto que en el original. Ver [[tecnico/diferencias]].
:::

También vale el `else` **pegado a las condiciones**, sin `start`. Su cuerpo
corre solo si las condiciones dan falso, y no hay cuerpo para el caso cierto:

```adn
' else sin start: corre cuando la condicion es falsa
cond
 *50 0 >
else
 9 83 store
stop
```

Con la 50 en 0 escribe 9 en la 83; con la 50 en 3 no hace nada.

Un `else` que no tiene un `cond … start` justo antes **no se ejecuta nunca**:
después de un `start` sin `cond`, después de un `stop` o después de otro
`else`. En este bot solo se escribe la dirección 84:

```adn
' else despues de un start sin cond, o despues de stop: nunca corre
start
 1 84 store
else
 2 85 store
stop
else
 3 86 store
stop
```

## Código fuera de los genes
<!-- 20-VM §4 (CLEAR suprime token a token; tipo 9 sin gate y con FLOWCOST), §5.5 -->

Lo que queda antes del primer marcador, o entre un `stop` y el marcador
siguiente, **no se ejecuta**. Ni siquiera los números se apilan:

```adn
' Lo que queda fuera de un gen no se ejecuta
5 70 store
start
 1 71 store
stop
7 72 store
cond
 3 73 store
start
 4 74 store
stop
```

De las cinco escrituras solo ocurren la de la 71 y la de la 74. La de la 73 no,
porque está en la zona de condiciones.

Los marcadores, en cambio, se procesan siempre, aunque el gen se esté saltando,
y cobran su costo cada vez (ver [[adn/ejecucion]]). Por eso un `cond` en
cualquier lugar abre un gen nuevo: cierra el cuerpo anterior aunque le falte el
`stop`.

```adn
' Un cond cierra el gen anterior aunque falte el stop
cond
 1 2 >
start
 1 90 store
cond
start
 2 91 store
stop
```

El primer gen no corre (1 no es mayor que 2) y el segundo sí: la 91 vale 2.

El ADN termina en el primer [[op:end]]; lo que siga no existe para el bot.

## Varios start seguidos
<!-- 20-VM §5.5 («start tras start») -->

Un segundo `start` no es un «y además»: abre **otro gen, sin condiciones**.

```adn
' El segundo start abre un gen nuevo sin condiciones
cond
 *50 0 >
start
 1 75 store
start
 2 76 store
stop
```

Con la 50 en 0, la condición es falsa y la 75 queda en 0, pero la 76 recibe 2
igual. Si querés dos cuerpos con la misma condición, repetí el `cond`.

## La pila booleana pasa de un gen al siguiente
<!-- 20-VM §4 (gate de stores CondStateIsTrue), §5.1 (solo cond limpia), §5.3 -->

Solo `cond` limpia la pila booleana: ni `stop` ni un `start` sin condiciones
lo hacen. Por eso una condición escrita dentro de un cuerpo (ver
[[adn/condiciones]]) puede seguir frenando los stores del gen siguiente si ese
gen no empieza con `cond`. El ejemplo está en [[adn/pilas#rareza]].

Si un gen tiene que correr pase lo que pase, empezalo con `cond start`, o
limpiá la pila al final del gen anterior con [[op:clearbool]] o
[[op:dropbool]].

## La numeración de los genes
<!-- 20-VM §2.6, §5.6, §9 (comentarios de gen al exportar); sysvars.yaml 336, 339, 341 -->

Los genes se numeran desde 1, en orden. Cuenta como gen nuevo:

- cada `cond`;
- cada `start` o `else` que **no** viene justo después de las condiciones de
  un `cond`.

Ojo con la segunda regla: en `cond … start … else … stop`, el `else` cuenta
como un gen aparte. Este bot anota en cada cuerpo el número de su gen:

```adn
' Cada gen anota su numero con .thisgene
cond
start
 *.thisgene 61 store
stop
start
 *.thisgene 62 store
stop
cond
 1 2 >
start
 *.thisgene 63 store
else
 *.thisgene 64 store
stop
```

Resultado: la 61 vale 1, la 62 vale 2 y la 64 vale 4 (el `start` de la 63 es
el gen 3, que no corrió). [[.genes]] vale 4.

| Sysvar | Qué tiene |
|---|---|
| [[.genes]] | Cuántos genes tiene el ADN. Se actualiza solo. |
| [[.thisgene]] | El número del gen en curso. Cambia en cada marcador, aunque el gen se salte, así que al final del ciclo queda el del último gen. |
| [[.dnalen]] | El largo del ADN en palabras. |

Esa misma numeración usan [[.delgene]], que borra un gen del propio ADN, y
[[.mkvirus]], que arma un virus con un gen (ver [[simulacion/virus]]). Cuando el
motor exporta un bot como texto agrega comentarios del estilo
`Gene: 5 Begins at position 97`, con la misma cuenta (ver [[adn/formato]]);
muchos bots del Bestiario los traen.

## Resumen

| Situación | Qué pasa |
|---|---|
| `cond C start A stop` | A corre si todas las condiciones de C son verdaderas. |
| `cond start A stop` o `start A stop` | A corre siempre. |
| `cond C start A else B stop` | A si C es cierta; B si es falsa. Son dos genes. |
| `cond C else B stop` | B corre si C es falsa. |
| `else` tras `stop`, tras otro `else` o tras un `start` sin `cond` | Nunca corre. |
| `start A start B` | B es otro gen, sin condiciones. |
| Stores entre `cond` y `start` | No escriben. |
| Código fuera de un gen | No se ejecuta. |

<!-- Resumen: 20-VM §4, §5.1-5.6, §2.6; core vm.hpp ExecuteFlowCommands (else corregido A2-1) -->
