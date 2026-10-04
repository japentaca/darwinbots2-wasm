---
titulo: Variables con def
resumen: "Cómo ponerle nombre a una dirección de memoria o a un número con def, cómo se resuelven esos nombres y qué trampas tiene."
etiquetas: [def, variables, nombres, memoria]
estado: revisada
---
Escribir `50 inc` para contar algo funciona, pero a la tercera dirección suelta ya no sabés qué era cada una. La línea `def` le pone nombre a un número: después, en cualquier parte del bot, escribís `.nombre` y el cargador lo cambia por ese número.

```adn
' Un contador en una variable propia
def pasos 50

cond
start
.pasos inc
stop
```

Este bot suma 1 a la celda 50 en cada ciclo: `.pasos inc` es exactamente lo mismo que `50 inc`. Lo comprobamos corriéndolo: después de cinco ciclos la celda 50 vale 5.

## Cómo se escribe {#sintaxis}
<!-- 20-VM §2.2 pasos 1-4 (comentario, tabs, def por sus tres primeras letras, sin tokens), §2.6 (DnaLen), §8.1 -->

La forma es `def nombre número`, sola en su línea:

- `def` en minúsculas, al principio de la línea. `Def` o `DEF` no cuentan: esa línea se lee como ADN común y sus palabras se vuelven ceros (ver [[adn/numeros]]).
- Un espacio (o un tabulador) entre `def` y el nombre, y otro entre el nombre y el número.
- El número es un entero entre −32768 y 32767. Puede ir un comentario con `'` después.
- Una línea `def` no produce ninguna instrucción: no ocupa lugar en el ADN, no cuesta energía y no cuenta en [[.dnalen]].

Los `def` se ponen arriba de todo, antes del primer gen, por una razón que sigue.

## Cómo se resuelven los nombres {#resolucion}
<!-- 20-VM §2.4 (SysvarTok: sysvars case-insensitive, privadas case-sensitive, última gana), §8.1-8.2; lint de db_dna_lint (nombre, def más abajo, mayúsculas, sin punto) -->

El cargador lee el archivo de arriba hacia abajo y traduce cada palabra en el momento en que la lee. Cuando encuentra `.algo`:

1. Busca una sysvar llamada `algo`, sin distinguir mayúsculas: `.UP`, `.Up` y `.up` son la misma.
2. Después busca entre tus `def` **ya leídos**, esta vez distinguiendo mayúsculas: `.Pasos` no es `.pasos`.
3. Si hay coincidencia en los dos lados, gana tu `def`. Si hay dos `def` con el mismo nombre, gana el último.
4. Si no encuentra nada, `.algo` vale 0. No hay error ni aviso al cargar.

Dos consecuencias prácticas:

- **Un `def` puesto más abajo que su uso no sirve.** Si un gen usa `.pasos` y el `def pasos 50` aparece después, ese `.pasos` ya se tradujo como 0.
- **El punto es obligatorio.** Sin punto, `pasos` es una palabra desconocida y vale 0. Con asterisco y punto, `*.pasos`, leés lo que hay guardado en la celda (ver [[op:*]]).

:::nota
El editor de la app te avisa de casi todos estos casos: nombre sin `def`, `def` más abajo que su uso, diferencia de mayúsculas o palabra sin punto.
:::

Que un nombre «no exista» y valga 0 parece inofensivo, pero no lo es: en un store, la dirección 0 no hace nada, y en una lectura `*0` lee la celda 1000. Un error de tipeo en un nombre deja al gen escribiendo en ningún lado (ver [[adn/numeros#cero]]).

## Un def es solo un número {#numeros}
<!-- 20-VM §8.2-8.3 (la privada es un número; normalización en ejecución); §8.1 (val del valor); Bestiario: LoveBot_F2_Moonfisher_-_30-03-08.txt -->

El cargador no sabe si tu `def` es una dirección o una constante: guarda un número y nada más. Eso te deja usar `def` para las dos cosas. Este bot usa `reloj` como dirección y `giro` como constante:

```adn
' Gira un cuarto de vuelta cada 20 ciclos
def reloj 60
def giro 314

cond
start
.reloj inc
stop

cond
*.reloj 20 >=
start
0 .reloj store
.giro .aimdx store
stop
```

`.reloj inc` incrementa la celda 60; `*.reloj` lee su valor; `.giro` apila directamente el número 314, que es lo que se guarda en [[.aimdx]]. Al correrlo, la celda 60 cuenta de 0 a 19, vuelve a 0, y en ese ciclo el [[.aim]] del bot baja 314 (un cuarto de vuelta hacia la derecha, porque la vuelta entera es 1256).

LoveBot F2, de Moonfisher, usa el mismo truco para dejarle una «llave» a sus hijos en la memoria genética:

```adn
' Fragmento de LoveBot F2 (Moonfisher, 2008)
def original 971
def origkey 1234

cond
*.robage 2 <
start
.origkey .original store
stop
```

`original` es una dirección (la 971, que se hereda: ver [[adn/memoria#memoria-genetica]]) y `origkey` es una constante. El gen guarda 1234 en la 971 durante los dos primeros ciclos de vida.

Como es solo un número, el `def` puede valer cualquier cosa en ±32767. Si lo usás como dirección y cae fuera de 1..1000, se ajusta igual que cualquier dirección (ver [[adn/numeros]]): `def x 1050` y `def x -50` terminan los dos en la celda 50. El valor tiene que ser un número escrito con cifras: `def x .up` no copia la dirección de `.up`, vale 0.

## Un def que pisa una sysvar {#sombra}
<!-- 20-VM §2.4, §8.2 (la privada sombrea a la sysvar homónima); lint «sombra» -->

Si llamás a tu variable igual que una sysvar, tu `def` gana en todo el bot. Acá `.up` deja de ser la orden de avanzar:

```adn sin-lint
def up 50

cond
start
10 .up store
stop
```

El bot no se mueve: el `10` va a la celda 50, no a la 1 ([[.up]]). Y como los `def` distinguen mayúsculas y las sysvars no, en ese mismo bot `.UP` sigue siendo la sysvar de verdad. Es una fuente de confusión segura; el lint de la app lo marca como aviso. Elegí nombres que no choquen con [[sysvars/todas|la lista de sysvars]].

## Nombres sin control {#sin-validacion}
<!-- 20-VM §2.2 paso 4, §8.3 (defensa 50 define nsa) -->

El cargador no revisa el nombre. Puntos, cifras o símbolos valen: `def a.b 70` o `def 5 70` definen variables legales, que se usan como `.a.b` y `.5`. Ojo con el último: `.5` sin `def` **no** es la dirección 5, vale 0 (las direcciones van sin punto).

Más raro todavía: cualquier línea que empiece con las letras `def` se toma como un `def`. El cargador descarta los cuatro primeros caracteres y lee lo que queda. Una línea como esta:

```adn sin-lint
defensa 50
```

define una variable llamada `nsa` con el valor 50. Si alguna vez un bot hace cosas inexplicables, revisá que ninguna línea empiece con «def» por accidente.

## use: una palabra muerta {#use}
<!-- 20-VM §8.5 -->

Algunos bots viejos del foro traen líneas como `use NewMove`. En esta versión `use` no hace nada especial: cada palabra se lee como ADN común y, al no ser comandos ni números, valen 0. Si la línea está antes del primer gen, esos ceros no se ejecutan nunca; si está dentro de un gen, apilan ceros. Podés borrarlas sin miedo.

## Límites y errores que impiden cargar {#limites}
<!-- 20-VM §2.5, §8.1 (error 5 malformado, 6 fuera de rango, 9 con el def 1001); core loader.hpp insertvar -->

| Caso | Qué pasa |
|---|---|
| `def x` sin número, o `def` solo | El bot entero no carga. |
| Número fuera de −32768…32767 (`def x 40000`) | El bot entero no carga. |
| Más de 1000 `def` | El bot entero no carga. |
| Dos `def` con el mismo nombre | Carga; gana el último. |
| `def` con un número fuera de 1..1000 | Carga; usado como dirección, se ajusta a 1..1000. |

## Rarezas heredadas del 2.48.32 {#rarezas}
<!-- 20-VM §2.3 (corrimiento del cero inicial, conservado como A2-2); core vm.hpp ExecuteDNA (ADN solo-defs: no-op, V-07); 60-FORMATOS §1 y 20-VM §9 (savingtofile: sin nombres privados) -->

Dos comportamientos curiosos del original, uno conservado y otro corregido:

- **Se pierde el primer token** (se conserva). Si el bot tiene algún `def` y lo primero del ADN no es `cond`, `start`, `else` ni `stop` (por ejemplo, un número suelto antes del primer gen), ese primer token desaparece. Como lo que está antes del primer gen no se ejecuta, en la práctica solo lo notás en que [[.dnalen]] da uno menos. Si empezás con `cond`, no pasa nada. Más en [[adn/estructura#cero-inicial]].
- **Un bot hecho solo de `def`** (corregido). En el DarwinBots original, un archivo con `def` y ningún gen trababa una parte de cada ciclo de la simulación. En esta versión el bot simplemente vive sin hacer nada.

Por último, los nombres existen solo en tu archivo. Cuando la simulación guarda un bot como `.txt` (ver [[adn/formato]]), el ADN sale ya traducido: cada `.pasos` aparece como `50`, sin los `def`.
