---
titulo: Condiciones en línea
resumen: "Las comparaciones dejan verdaderos y falsos en la pila booleana; esta página cuenta cómo se combinan con and, or y not, y cómo deciden qué stores corren, antes y después de start."
etiquetas: [condiciones, pila booleana, and, or, not, cond]
estado: revisada
---
Un bot decide comparando números. Cada comparación saca números de la pila entera
y deja un _verdadero_ o un _falso_ en la [[adn/pilas|pila booleana]]. Lo que haya
en esa pila decide después qué escrituras en la memoria se hacen y cuáles no.

Las condiciones pueden ir en dos lugares del gen: entre `cond` y `start`, donde
deciden si el cuerpo corre (lo cuenta [[adn/genes]]), o adentro del cuerpo, después
de `start`. Estas últimas son las condiciones _en línea_, y son las que le dan el
nombre a esta página.

## Las comparaciones
<!-- 20-VM §6.4 (incluido el intervalo invertido de %= y ~= con referencia negativa, §12.4) -->

Todas leen la pila de izquierda a derecha: `a b >` pregunta «¿`a` es mayor que
`b`?». Así, `*.nrg 5000 >` es verdadero cuando la energía pasa de 5000.

Hay diez: [[op:<]], [[op:>]], [[op:<=]], [[op:>=]], [[op:=]], [[op:!=]] y las
«aproximadas» [[op:%=]], [[op:!%=]], [[op:~=]] y [[op:!~=]]. La tabla con lo que
pregunta cada una está en [[adn/operadores#comparaciones]].

Las dos «aproximadas» toman a `a` como referencia. `100 109 %=` es verdadera
(109 está a menos de 10 de 100) y `100 111 %=` es falsa. `~=` saca un tercer número,
el porcentaje: `100 120 25 ~=` es verdadera y `100 130 25 ~=` no.

:::cuidado
Una rareza heredada del DarwinBots 2.48.32: con una referencia negativa, `%=` y `~=`
son **siempre falsas**, aunque los dos números sean iguales (`-100 -100 %=` da
falso). Si comparás valores que pueden ser negativos, como una velocidad, usá
[[op:abs]] antes o una resta y `<`.
:::

Si a la pila entera le faltan números, las comparaciones usan ceros: `=` sobre una
pila vacía compara 0 con 0 y da verdadero. La lista completa, con los detalles de
cada una, está en [[operadores/comparaciones]].

## En la sección cond
<!-- 20-VM §1 (stores solo en body/ELSEBODY), §5.1-5.2 (AddupCond; vacío = verdadero) -->

Entre `cond` y `start` podés poner tantas condiciones como quieras. Cuando llega el
`start`, el motor las une todas con un _y_: el cuerpo corre solo si todas son
verdaderas. Un gen sin ninguna condición corre siempre, porque una pila booleana
vacía cuenta como verdadera.

En esa sección se calculan números y comparaciones, pero los stores no se ejecutan
nunca. Este gen no escribe nada en la celda 50:

```adn
cond
 5 50 store
start
stop
```

## and, or y not
<!-- 20-VM §6.5 (operando ausente = verdadero), §6.6; Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt, gen 3 -->

Si querés algo distinto del _y_ de todas, combinalas vos con los operadores
lógicos, que trabajan sobre los dos booleanos de arriba de la pila:

| Palabra | Deja |
|---|---|
| [[op:and]] | verdadero si los dos son verdaderos |
| [[op:or]] | verdadero si alguno lo es |
| [[op:xor]] | verdadero si uno sí y el otro no |
| [[op:not]] | el contrario del de arriba |
| [[op:true]] / [[op:false]] | un verdadero / un falso, sin mirar nada |

Este gen, el tercero de _Animal Minimalis_ (Numsgil), del Bestiario, gira al azar
si no ve nada **o** si lo que ve es de su misma especie:

```adn
' gira si no ve nada o si lo que ve es de su especie
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 314 rnd .aimdx store
stop
```

Sin ese `or`, las dos condiciones se unirían con _y_ al llegar al `start`, y el gen
haría otra cosa. Leélo como una calculadora de pila: [[.eye5]] `0 =` deja un
booleano, [[.refeye]] [[.myeye]] `=` deja otro encima, y `or` los reemplaza a los
dos por uno solo.

Cuando a un operador lógico le falta un operando, lo reemplaza por verdadero: un
`or` solo, sobre una pila vacía, deja verdadero; un `not` solo deja falso (el
contrario de «vacío», que es verdadero).

## Condiciones dentro del cuerpo {#en-linea}
<!-- 20-VM §4 (tipo 7: CondStateIsTrue mira el tope sin consumir), §5.5, §6.6 -->

Después de un `cond … start`, la pila booleana arranca vacía, o sea verdadera, y
todos los stores corren. Si en medio del cuerpo ponés una condición, su resultado queda arriba
de la pila y **cada store que venga después lo consulta**: si es verdadero, el store
corre; si es falso, se saltea. El store mira el tope sin sacarlo, así que la misma
condición gobierna a todos los stores siguientes, hasta que otra cosa la cambie.

Con [[op:not]] eso da un «si no» dentro del mismo gen:

```adn
' sube los primeros ciclos y después baja
cond
start
*.robage 5 <
20 .up store
not
20 .dn store
stop
```

Mientras [[.robage]] es menor que 5, la condición es verdadera: escribe en [[.up]] y
el `.dn` se saltea. Desde el sexto ciclo pasa al revés y el bot empuja hacia atrás;
por la inercia, tarda un par de ciclos en frenar y dar la vuelta.

Las condiciones en línea gobiernan **solo los stores** (incluidos `inc`, `dec` y el
resto de la familia de [[adn/stores]]). Los números, las cuentas y las otras
comparaciones del cuerpo se ejecutan siempre, sea verdadero o falso lo que haya en
la pila.

## Encadenar condiciones
<!-- 20-VM §6.5 (and), §6.6 -->

Una condición nueva no se suma a la anterior: se apila encima y manda ella sola. Si
querés que un store dependa de dos cosas, unilas con `and`:

```adn
start
 1 2 =
 3 3 =
 1 50 store
 and
 1 51 store
stop
```

El primer store corre, aunque `1 2 =` sea falso, porque arriba quedó `3 3 =`, que es
verdadero. Después del `and` arriba queda un falso, y el segundo store se saltea: la
celda 50 termina en 1 y la 51 en 0.

## Volver a habilitar los stores
<!-- 20-VM §6.5 (true, dropbool, clearbool); Bestiario: Animal_Minimalis_Antivirus_Shasta.txt, gen 1 -->

Para que los stores que siguen vuelvan a correr siempre, tenés tres caminos:

- [[op:true]] pone un verdadero encima. Lo de abajo sigue ahí, pero ya no manda.
- [[op:dropbool]] saca el de arriba y deja mandar al anterior.
- [[op:clearbool]] vacía la pila, y vacía cuenta como verdadera.

La variante _Animal_Minimalis Antivirus_ (Shasta), del Bestiario, escribe todas sus
condiciones en línea y usa el primero. Su gen que busca comida mueve al bot solo si
ve algo que no es de su especie, y al final anota el número de gen pase lo que pase
(en el original la dirección 71 tiene un nombre puesto con [[adn/def]]):

```adn
' Gen 1 de Animal_Minimalis Antivirus: busca comida
cond
start
 *.eye5 0 >
 *.refeye *.myeye != and
 *.refveldx .dx store
 *.refvelup 30 add .up store
 true
 *.thisgene 71 store
stop
```

Si lo corrés solo, sin comida a la vista, el bot no se mueve, pero la celda 71 se
llena igual: el `true` dejó habilitado el último store.

## Dos trampas
<!-- 20-VM §4 (el gate va antes de ExecuteStores: un store salteado no hace pops), §5.1 -->

**Un store salteado no saca nada de la pila entera.** Su valor y su dirección
quedan ahí, y el próximo store que corra los puede encontrar:

```adn
start
 false
 5 50 store
 true
 60 store
stop
```

El primer store se saltea y deja el 5 y el 50 en la pila. Después del `true`, el
`60 store` saca el 60 como dirección y el 50 como valor: la celda 60 termina en 50,
no en 5. Si un store puede saltearse, que no haya stores «a medias» después que
cuenten con una pila prolija.

**Un `start` sin `cond` no limpia la pila booleana.** Solo `cond` la vacía. Si un
gen deja un falso en línea y el siguiente empieza directo con `start`, ese falso
sigue frenando sus stores (el ejemplo está en [[adn/pilas#rareza]]). Por las dudas,
terminá tus condiciones en línea con un `clearbool` o abrí cada gen con `cond`.
