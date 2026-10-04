---
titulo: Los operadores por familia
resumen: "Panorama de los operadores del ADN agrupados por familia: qué toman y qué dejan en cada pila, y los más usados con un ejemplo."
etiquetas: [operadores, pilas, aritmética, condiciones, lógicos, flujo]
estado: revisada
---
<!-- 20-VM §6, §7, §5; opcodes.yaml -->

El ADN se escribe en notación polaca inversa: primero van los datos y después
el operador que los usa. `3 4 add` apila un 3, apila un 4, y `add` los saca a
los dos y deja un 7. No hay paréntesis ni precedencia: el orden de las
palabras es el orden de las cuentas.

Los operadores trabajan sobre dos pilas, la de enteros y la booleana (las
explica [[adn/pilas]]). Según qué pila tocan y qué hacen, se agrupan en
familias. Cada familia tiene su página en la referencia, con la tabla
completa de sus operadores y su costo:

| Familia | Toma de | Deja en | Para qué |
|---|---|---|---|
| [[operadores/basicos]] | enteros | enteros | aritmética y manejo de la pila |
| [[operadores/avanzados]] | enteros | enteros | ángulos, distancias, raíces, trigonometría |
| [[operadores/bits]] | enteros | enteros | operar con los bits de un número |
| [[operadores/comparaciones]] | enteros | booleana | preguntar (mayor, igual, parecido…) |
| [[operadores/logicos]] | booleana | booleana | combinar respuestas (y, o, no) |
| [[operadores/escritura]] | enteros | memoria | guardar valores y dar órdenes |
| [[operadores/flujo]] | — | — | marcar dónde empieza y termina cada gen |

Además están los números sueltos y las lecturas de memoria como `*.eye5`, que
solo apilan un valor: los cuenta [[operadores/literales]] y los explica
[[adn/numeros]].

## Cómo leer las descripciones
<!-- 20-VM §0.1, §3, §6 (convención a b), §1 (qué tipos corren con flow ≠ CLEAR; stores solo en body/ELSEBODY) -->

En esta página la pila se escribe `a b`, con `b` arriba de todo (el último
que entró). Así, `a b sub` calcula `a − b`: `10 3 sub` da 7.

Ningún operador falla nunca. Si la pila de enteros está vacía, sacar de ella
da 0; si la booleana está vacía, cuenta como _verdadero_. Cada pila tiene
101 lugares; si se llena, el valor más viejo se pierde sin aviso. Un
operador mal usado no rompe el bot: hace algo, aunque no sea lo que querías.

Los operadores de las cinco primeras familias corren dentro de un gen, tanto
en la condición (después de `cond`) como en el cuerpo (después de `start` o
`else`). Fuera de un gen, por ejemplo antes del primer `cond`, no hacen nada.
Los de escritura, en cambio, solo corren en el cuerpo.

## Básicos
<!-- 20-VM §6.1; opcodes.yaml (básicos) -->

Son la aritmética y las herramientas para acomodar la pila. Todos sacan sus
operandos de la pila de enteros y dejan el resultado ahí mismo.

- Cuentas: [[op:add]] (suma), [[op:sub]] (resta), [[op:mult]]
  (producto), [[op:div]] (división), [[op:mod]] (resto), [[op:abs]] (valor
  absoluto), [[op:sgn]] (signo: −1, 0 o 1) y [[op:rnd]] (un número al azar
  entre 0 y el tope, ambos incluidos).
- Manejo de la pila: [[op:dup]] duplica el tope, [[op:drop]] lo tira,
  [[op:swap]] intercambia los dos de arriba, [[op:over]] copia el segundo
  arriba de todo (`a b → a b a`) y [[op:clear]] vacía la pila.
- [[op:*]] lee la memoria en la dirección que está en el tope: `740 *` es lo
  mismo que `*740`, pero la dirección se puede calcular.

Algunas rarezas que conviene saber, porque así se comportaba el 2.48.32:

- `div` no trunca: redondea al entero más cercano y, en el empate, al par.
  `7 2 div` da 4, `5 2 div` da 2 y `100 7 div` da 14. Dividir por cero da 0.
- `mod` conserva el signo del dividendo: `-7 3 mod` da −1 y `7 -3 mod` da 1.
- `dup` sobre la pila vacía apila dos ceros.

Un ejemplo con [[op:rnd]] y [[op:mod]]: el bot cambia de rumbo al azar cada
20 ciclos de vida ([[.robage]]) y siempre avanza. Un giro completo son 1256
unidades de ángulo, así que `1256 rnd` es una dirección cualquiera.

```adn
' Cambia de rumbo al azar cada 20 ciclos y avanza
cond
*.robage 20 mod 0 =
start
1256 rnd .setaim store
stop

cond
start
10 .up store
stop
```

## Avanzados
<!-- 20-VM §6.2; opcodes.yaml (avanzados); §1 (ADCMDCOST solo si value < 13: debugint/debugbool gratis) -->

Cuentas más elaboradas, casi todas pensadas para moverse por el mundo:

- [[op:angle]] toma un punto `x y` y da el ángulo desde el bot hasta ese
  punto, en las mismas unidades que [[.aim]] (0 a 1256). [[op:dist]] da la
  distancia hasta el punto.
- [[op:anglecmp]] compara dos ángulos y da la diferencia con signo, entre
  −628 y 628: cuánto hay que girar, y el signo dice hacia qué lado.
- [[op:sin]] y [[op:cos]] toman un ángulo en esas unidades y devuelven el
  seno o el coseno multiplicado por 32000: `314 sin` (un cuarto de vuelta)
  da 32000.
- [[op:sqr]] (raíz cuadrada; 0 si el número no es positivo), [[op:pow]]
  (potencia: `2 10 pow` da 1024; el exponente se limita a ±10),
  [[op:root]] (`27 3 root` da 3), [[op:logx]] (logaritmo en base `b`:
  `1000 10 logx` da 3) y [[op:pyth]] (`3 4 pyth` da 5, la hipotenusa).
- [[op:ceil]] pone un techo y [[op:floor]] un piso: `x 100 ceil` deja `x`
  pero nunca más de 100, y `x 0 floor` lo deja pero nunca menos de 0.
- [[op:debugint]] y [[op:debugbool]] dejan una traza para depurar, que
  muestra el comando `debug` de la consola del [[app/inspector]]. No cobran
  energía y casi nunca cambian la pila (`debugbool` sobre la pila booleana
  vacía apila un _verdadero_).

El bot 4-d_Swarmer del Bestiario usa `angle` con [[.refxpos]] y [[.refypos]]
(la posición de lo que está viendo) para girar hacia una planta:
`*.refxpos *.refypos angle .setaim store`. Con un punto fijo se ve igual de
bien: este bot apunta hacia (3000, 2500) y avanza hacia allá (si no frena,
se pasa de largo).

```adn
' Apunta al punto (3000, 2500) y avanza hacia él
cond
start
3000 2500 angle .setaim store
10 .up store
stop
```

## Bit a bit
<!-- 20-VM §6.3 -->

Tratan el número como 32 bits. [[op:&]], [[op:|]] y [[op:^]] hacen el
_y_, el _o_ y el _o exclusivo_ bit a bit de los dos del tope; [[op:~]]
invierte todos los bits; [[op:<<]] y [[op:>>]] corren los bits un lugar
(multiplican o dividen por 2, y `>>` conserva el signo: `-5 >>` da −3);
[[op:++]] y [[op:--]] suman o restan 1.

:::cuidado
El signo menos suelto es un operador de esta familia: [[op:-]] cambia el
signo del tope (`5 -` da −5). No resta. Para restar se usa `sub`, y un número
negativo se escribe pegado: `-5`.
:::

Sirven para guardar varias marcas en una sola celda. `*740 4 | 740 store`
prende el bit de valor 4 en la celda 740, y `*740 4 &` da 4 si está prendido
o 0 si no.

## Comparaciones
<!-- 20-VM §6.4 (incluido %= y ~= con referencia negativa), §5.2 (AND implícito en start) -->

Son las preguntas del ADN. Cada una saca enteros de la pila de enteros y
deja _un_ resultado, verdadero o falso, en la booleana. Con `a b` en la pila:

| Operador | Es verdadero si… |
|---|---|
| [[op:<]] · [[op:>]] | `a` es menor · mayor que `b` |
| [[op:<=]] · [[op:>=]] | `a` es menor o igual · mayor o igual que `b` |
| [[op:=]] · [[op:!=]] | `a` es igual · distinto de `b` |
| [[op:%=]] · [[op:!%=]] | `b` está · no está dentro del 10 % de `a` |
| [[op:~=]] · [[op:!~=]] | con `a b d`: `b` está · no está dentro del `d` % de `a` |

`100 105 %=` es verdadero y `100 115 %=` es falso; `100 115 20 ~=` es
verdadero. Una rareza heredada: si `a` es negativo, `%=` y `~=` dan siempre
falso.

En la condición de un gen se pueden poner varias comparaciones seguidas: al
llegar a `start` se exige que todas sean verdaderas. Este bot avanza solo
mientras tiene más de 1000 de energía ([[.nrg]]):

```adn
' Avanza mientras tenga más de 1000 de energía
cond
*.nrg 1000 >
start
10 .up store
stop
```

Una comparación también puede ir en el cuerpo, y entonces decide si se
ejecutan las escrituras que la siguen; eso es [[adn/condiciones]].

## Lógicos
<!-- 20-VM §6.5, §6.6 -->

Trabajan solo sobre la pila booleana. [[op:and]], [[op:or]] y [[op:xor]]
combinan los dos resultados de arriba; [[op:not]] invierte el tope;
[[op:true]] y [[op:false]] apilan una constante. Y la pila booleana tiene su
propio juego de herramientas: [[op:dupbool]], [[op:dropbool]],
[[op:swapbool]], [[op:overbool]] y [[op:clearbool]].

Como el `start` ya une todas las condiciones con un _y_, el `or` es el que
más se escribe: sin él no hay forma directa de pedir «esto o aquello».

```adn
' Avanza si la celda 740 vale 0 o si la 741 vale 0
cond
*740 0 =
*741 0 =
or
start
10 .up store
stop
```

Si falta un operando, cuenta como verdadero (la pila booleana vacía vale
_verdadero_). Por eso `not` sobre la pila vacía da falso, y un `cond start`
sin ninguna condición ejecuta su cuerpo siempre.

## Escritura en memoria
<!-- 20-VM §7 -->

Son los únicos que cambian algo fuera de las pilas: escriben en la memoria
del bot, y escribir en ciertas direcciones es dar una orden (moverse,
disparar, reproducirse). El más usado es [[op:store]]: `10 .up store` guarda
10 en la dirección de [[.up]] y el bot avanza. Hay variantes que operan sobre
lo que ya hay en la celda: [[op:inc]] y [[op:dec]] le suman o restan 1,
[[op:addstore]] le suma un valor, [[op:negstore]] le cambia el signo, y así
hasta catorce.

Solo corren en el cuerpo de un gen y solo si el tope de la pila booleana es
verdadero (o está vacía). La dirección 0 no escribe nada. Todos los detalles,
incluido cómo se recorta el valor escrito, están en [[adn/stores]].

## Flujo
<!-- 20-VM §1 (tipo 9 sin gate, FLOWCOST), §2.2 (end agregado), §5 -->

No calculan nada: marcan la estructura. [[op:cond]] abre un gen y su
condición, [[op:start]] abre el cuerpo que corre si la condición dio
verdadero, [[op:else]] el que corre si dio falso, y [[op:stop]] cierra el
gen. [[op:end]] termina la lectura del ADN; el cargador lo agrega solo al
final, así que no hace falta escribirlo. Cómo se combinan está en
[[adn/genes]].

A diferencia del resto, estos marcadores se ejecutan siempre, incluso en un
gen que se está salteando, y cada uno cobra su costo.

## Un truco del Bestiario: cuentas en lugar de condiciones
<!-- 20-VM §6.1 (div por 0 → 0); Bestiario: Bardus_1S_Moonfisher.txt -->

Algunos autores escriben bots enteros sin condiciones, con aritmética. El
truco se apoya en que dividir por cero da 0: `x dup div` vale 1 si `x` no es
cero y 0 si lo es. Y `x dup div 1 sub abs` es al revés: 1 si `x` es cero.
Multiplicando por eso se «prende» o «apaga» un valor. Bardus, de Moonfisher,
lleva la idea al extremo: todo el bot es un único `store` de una línea
larguísima.

Una versión chica: avanzar 10 si el ojo central ([[.eye5]]) no ve nada, y
quedarse quieto si ve algo.

```adn
' Avanza solo si el ojo central no ve nada, sin condiciones
cond
start
*.eye5 dup div 1 sub abs 10 mult .up store
stop
```

Se lee peor que la forma con `cond`, así que para empezar conviene esa. Lo
que cuesta cada operador se cuenta en [[adn/ejecucion]].
