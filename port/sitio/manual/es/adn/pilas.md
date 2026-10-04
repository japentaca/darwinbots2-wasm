---
titulo: La pila entera y la booleana
resumen: "El ADN calcula con dos pilas, una de números y otra de verdadero o falso: cuánto les cabe, qué pasa si se llenan o se vacían y cuándo arrancan de cero."
etiquetas: [pila, booleano, condiciones, store, ADN]
estado: revisada
---
El ADN de DarwinBots es un lenguaje _de pila_: no hay variables ni paréntesis,
cada palabra deja algo en una pila o lo saca de ahí. Si alguna vez usaste una
calculadora RPN, ya conocés la idea: primero los operandos, después la
operación.

Hay **dos pilas**, y cada palabra sabe con cuál trabaja:

| Pila | Guarda | La llenan | La vacían |
|---|---|---|---|
| Entera | números | números sueltos, lecturas como `*.nrg`, operadores como [[op:add]] | operadores, condiciones y stores |
| Booleana | verdadero o falso | condiciones como [[op:>]], [[op:true]], [[op:false]] | lógicos como [[op:and]], el `start` de un gen, [[op:dropbool]] |

## La pila entera {#entera}
<!-- 20-VM §3, §6 (convención a b, b en el tope), §6.1 (rango ±2·10⁹), §7 -->

Un número escrito en el ADN se apila. Un operador saca los que necesita y
apila el resultado. Un store saca una dirección y un valor y escribe en la
memoria del bot. Este bot suma 3 y 4 y guarda el 7 en la dirección 50, una
celda de memoria libre:

```adn
cond
start
  3 4 add 50 store
stop
```

Paso a paso, la pila entera queda así (el tope a la derecha):

| Palabra | Pila después |
|---|---|
| `3` | 3 |
| `4` | 3 4 |
| `add` | 7 |
| `50` | 7 50 |
| `store` | (vacía): escribió 7 en la dirección 50 |

El orden importa en las operaciones que no son conmutativas: `10 3 sub` es
10 − 3, y `*.nrg 1000 >` pregunta si la energía es mayor que 1000. La regla es
siempre la misma: el que está más abajo es el primer operando. Por eso un
store se escribe _valor dirección_ [[op:store]], con la dirección arriba.

En la pila entera caben números mucho más grandes que en la memoria (hasta
unos dos mil millones); el recorte a ±32000 pasa recién al guardar. Lo
contamos en [[adn/numeros]].

## La pila booleana {#booleana}
<!-- 20-VM §5.2 (AddupCond: AND de toda la pila), §6.4, §6.5, §6.6 -->

Las condiciones sacan dos números de la pila entera y apilan un resultado en
la booleana. `*.nrg 1000 >` saca la energía y el 1000 y apila _verdadero_ o
_falso_. Los lógicos ([[op:and]], [[op:or]], [[op:not]], [[op:xor]]) trabajan
solo sobre la booleana.

Varias condiciones seguidas entre `cond` y `start` se combinan con un _y_
implícito: el `start` hace el _y_ de todo lo que haya en la pila booleana y la
deja vacía. Para un _o_ hay que escribirlo. En este bot la primera condición es
cierta y de las otras dos solo una lo es; con el [[op:or]] el gen se ejecuta y
escribe 9 en la dirección 57:

```adn
cond
  1 1 =
  2 2 = 3 4 = or
start
  9 57 store
stop
```

Todo lo de las condiciones del gen está en [[adn/genes]], y los operadores uno
por uno en [[adn/operadores]].

## Tamaño: 101 lugares {#tamano}
<!-- 20-VM §0.1, §3 (push sobre lleno descarta el fondo, igual en las dos pilas) -->

Cada pila tiene lugar para **101 valores**. Si apilás uno más, la pila no da
error: **se pierde el valor más viejo**, el del fondo, y el nuevo entra arriba.

Lo comprobamos apilando un 1000 y después 101 unos: al sumar todo, el
resultado es 101 y no 1101, porque el 1000 del fondo se cayó al entrar el
último 1. En la práctica no vas a llegar a 101 salvo con un error (un número
que se apila en cada vuelta y nadie saca), pero conviene saber que no avisa.

## Sacar de una pila vacía {#vacia}
<!-- 20-VM §0.1, §3 (pop vacío: 0 / centinela −5 = verdadero; dup, dupbool, over, overbool, swap), §6.5 -->

Tampoco hay error al sacar de una pila vacía. Cada pila tiene su regla:

- **La entera da 0.** Un operador que no encuentra operandos trabaja con
  ceros.
- **La booleana, vacía, cuenta como verdadero.** Es la regla que más
  consecuencias tiene.

Por ejemplo, este bot no apila nada antes del store: la dirección 52 la saca
bien, pero el valor sale de la pila vacía y vale 0. Si la dirección 52 tenía
otro número, queda en 0:

```adn
cond
start
  52 store
stop
```

Y por la regla de _vacía = verdadero_:

- Un gen sin condiciones (`cond start`, o un `start` solo) se ejecuta
  siempre.
- Un store se ejecuta si la pila booleana está vacía (ver más abajo).
- [[op:not]] sobre la booleana vacía apila _falso_ (lo contrario de
  verdadero).
- [[op:and]] con un solo valor deja ese valor; [[op:or]] con uno solo da
  _verdadero_.

Algunos operadores de pila tienen asimetrías heredadas del DarwinBots 2.48.32
que el port respeta tal cual:

| Operador | Con la pila vacía | Con un solo valor |
|---|---|---|
| [[op:dup]] | apila dos ceros | lo duplica |
| [[op:dupbool]] | no hace nada | lo duplica |
| [[op:over]] | no hace nada | apila un 0 encima |
| [[op:overbool]] | no hace nada | apila _verdadero_ encima |
| [[op:swap]], [[op:swapbool]] | no hacen nada | no hacen nada |

## Cuándo se vacían {#cuando}
<!-- 20-VM §4 (stacks limpiados al entrar cada bot), §5.1-5.3; 10-CICLO §3 -->

**Al empezar el turno de cada bot, en cada ciclo, las dos pilas arrancan
vacías.** Nada pasa de un ciclo al siguiente por las pilas: lo que quieras
recordar lo tenés que guardar en memoria (ver [[adn/memoria]]). Este bot deja
un 7 en la pila al final de su turno; en el ciclo siguiente el store no lo
encuentra y escribe 0 en la dirección 50:

```adn
cond
start
  50 store
  7
stop
```

Dentro de un mismo ciclo, en cambio, **la pila entera no se vacía entre
genes**. Un número que sobra en un gen lo puede usar el siguiente. Acá el
primer gen apila un 7 y el segundo lo guarda en la dirección 51:

```adn
start
  7
stop

start
  51 store
stop
```

Funciona, pero hace al bot frágil: si el primer gen no se ejecuta, el segundo
encuentra otra cosa. Mejor que cada gen deje la pila como la encontró.

La pila booleana tiene dos momentos de limpieza:

- **`cond`** la vacía al abrir el gen.
- **`start`**, cuando viene de un `cond`, la consume entera para decidir si el
  gen corre.

### Una rareza: el booleano que sobrevive {#rareza}
<!-- 20-VM §4 (gate CondStateIsTrue sin consumir), §5.1 (solo cond limpia), §5.2 (start sin cond no hace AddupCond); comprobado en el port -->

Un gen que empieza con `start` directo (sin `cond`) no limpia la pila
booleana. Si el gen anterior dejó un _falso_ arriba, ese _falso_ bloquea los
stores del gen nuevo, aunque el gen se ejecute. En este bot la dirección 51
nunca se escribe:

```adn
start
  1 2 = 3 50 store
stop

start
  4 51 store
stop
```

Basta abrir el segundo gen con `cond` para que la pila booleana arranque
limpia y el 4 se guarde. El falso sigue mandando en todos los genes que
vengan después, hasta el próximo `cond`. Es un comportamiento del DarwinBots original que el
port conserva para que los bots viejos se comporten igual. Si escribís genes
con condiciones en el cuerpo, abrí cada gen con `cond`, o terminá el cuerpo con
[[op:clearbool]].

## Condiciones dentro del cuerpo {#en-el-cuerpo}
<!-- 20-VM §4 (tipo 7), §5.5, §6.6 -->

Una condición también se puede evaluar entre `start` y `stop`. No decide si el
gen corre, pero **el tope de la pila booleana gobierna todos los stores que
siguen**: si es _falso_, no escriben; si es _verdadero_ o la pila está vacía,
sí. El store mira el tope sin sacarlo, así que el mismo resultado sigue mandando
hasta que lo saques con [[op:dropbool]], lo tapes con otra condición o vacíes
la pila con [[op:clearbool]].

```adn
cond
start
  1 2 > 7 53 store
  dropbool
  8 54 store
stop
```

Como 1 no es mayor que 2, el 7 no se guarda en la 53; después del
[[op:dropbool]] la pila queda vacía (verdadero) y el 8 sí se guarda en la 54.
Ojo: la condición solo frena a los stores. Los números y operadores del cuerpo
se ejecutan igual.

El bot «Alga_Pair 1.1.1» del Bestiario usa esta técnica en una línea: cuenta
una generación más solo en el ciclo en que nace (cuando [[.robage]] vale 0) y
enseguida descarta la condición para que no frene al resto del gen:

```adn
def generation 971

cond
start
  .generation *.robage 0 = inc dropbool
stop
```

Fijate que [[op:inc]] también es un store, y por eso la condición lo frena. La
técnica completa, con más ejemplos, está en [[adn/condiciones]].

## Resumen {#resumen}

| | Pila entera | Pila booleana |
|---|---|---|
| Tamaño | 101 valores | 101 valores |
| Al desbordar | se pierde el más viejo | se pierde el más viejo |
| Sacar estando vacía | da 0 | cuenta como verdadero |
| Se vacía | al empezar el turno del bot | al empezar el turno, en cada `cond` y al decidir el `start` |
| Pasa de un gen al otro | sí, dentro del mismo ciclo | solo si el gen siguiente no abre con `cond` |
| Pasa al ciclo siguiente | no | no |

<!-- Resumen: 20-VM §3, §4, §5.1-5.5, §6.5, §6.6 -->
