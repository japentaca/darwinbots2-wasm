---
titulo: La estructura de un bot
resumen: "Un bot es un archivo de texto con su ADN: genes uno tras otro, comentarios, def y palabras separadas por espacios."
etiquetas: [adn, bot, gen, tokens, comentarios, def]
estado: revisada
---
Un bot de DarwinBots es un archivo de texto. Adentro está su ADN: un programa
escrito con palabras separadas por espacios que el motor lee una vez, al cargar
el bot, y convierte en una lista de _tokens_. Desde ahí el texto ya no importa:
en cada ciclo el bot ejecuta esa lista de principio a fin (el detalle está en
[[adn/ejecucion]] y en [[simulacion/ciclo]]).

Esta página te muestra la forma general de un bot. Cómo es el archivo por
dentro (fines de línea, cabeceras, lo que se pierde al exportar) está en
[[adn/formato]].

## Un bot mínimo
<!-- 20-VM §4, §5.1-5.3, §5.5; sysvars.yaml .up -->

Este es un bot completo. Podés pegarlo en el [[app/editor]] y sembrarlo:

```adn
' Mi primer bot: avanza siempre
cond
start
10 .up store
stop
```

Avanza todos los ciclos, cada vez más rápido. Línea por línea:

- La primera línea es un comentario: empieza con `'` y el motor la ignora.
- [[op:cond]] abre un gen. Entre `cond` y `start` van las condiciones; acá no
  hay ninguna, y un gen sin condiciones se ejecuta siempre.
- [[op:start]] marca dónde empieza lo que el gen hace.
- `10 .up store` pone el número 10 en la dirección [[.up]]: es la orden de
  empujar hacia adelante. [[op:store]] toma dos números de la pila (el valor y
  la dirección) y escribe uno en el otro; las [[adn/pilas]] y los
  [[adn/stores]] tienen su propia página.
- [[op:stop]] cierra el gen.

Un `start` sin `cond` delante también funciona y se ejecuta siempre:
`start 10 .up store stop` hace lo mismo que el bot de arriba.

## Genes, uno tras otro
<!-- 20-VM §4 (sin anidamiento), §5.5; §2.2 (end agregado al cargar) -->

Un bot real tiene varios genes, escritos uno después del otro. No se anidan:
`cond`, `start`, [[op:else]] y `stop` son marcas planas que van prendiendo y
apagando la ejecución mientras el bot recorre su lista. La forma habitual es
esta:

```adn
cond
  *.nrg 5000 >
start
  50 .repro store
stop

cond
  *.nrg 1000 <
start
  10 .up store
stop
```

El primer gen se reproduce cuando la energía pasa de 5000; el segundo empuja
hacia adelante cuando baja de 1000. Las reglas exactas de cada marca, incluida
una rareza heredada de `else`, están en [[adn/genes]].

Dos cosas que conviene saber desde ya:

- Lo que escribas **antes** del primer `cond` o `start` no se ejecuta nunca.
- La palabra [[op:end]] termina el programa: lo que venga después se carga,
  pero no se ejecuta. No hace falta escribirla, porque el motor agrega un `end`
  al final de todo bot.

## Comentarios
<!-- 20-VM §2.2 pasos 1-3 y 5 -->

Hay dos maneras de comentar:

- **La comilla `'`** comenta desde donde aparece hasta el final de la línea.
  Sirve para una línea entera o para anotar algo al lado del código.
- **La barra `/`** comenta solo si es lo primero de la línea (sin contar los
  espacios). Muchos bots viejos del foro la usan para hacer recuadros. Este
  fragmento es de _Robottus Fisannis_, del Bestiario:

```adn
/******************/
/* REPRODUCTION */
/******************/

cond
*.nrg
5000
>
start
50
.repro
store
stop
```

En el medio de una línea, la barra no comenta nada: `stop // fin` deja dos
palabras más (`//` y `fin`) que el cargador convierte en ceros. El fragmento de
arriba también muestra que los saltos de línea no tienen significado: escribir
una palabra por línea o todo el gen en una sola línea da el mismo bot.

## def, al principio
<!-- 20-VM §2.2 paso 4, §2.4, §8.1-8.2 -->

Una línea que empieza con `def` le pone nombre a una dirección de memoria:

```adn
' Contador: empuja durante 5 ciclos y después sigue de largo
def pasos 50

cond
  *.pasos 5 <
start
  10 .up store
  .pasos inc   ' suma 1 a la dirección 50
stop
```

Desde el `def`, escribir `.pasos` es lo mismo que escribir `50`, y `*.pasos`
lee lo que hay en esa dirección. El bot empuja cinco ciclos, la dirección 50
llega a 5 y el gen deja de ejecutarse; el bot sigue moviéndose por la inercia.

Los `def` van **arriba**, antes del primer lugar donde usás el nombre: el
cargador resuelve cada nombre en el momento en que lo lee, y uno definido más
abajo vale 0. El valor tiene que ser un número; `def mov .up` no copia la
dirección de `.up`, deja `mov` en 0. Todo esto, con más detalle, en
[[adn/def]].

## Las palabras del ADN {#tokens}
<!-- 20-VM §1, §2.4 (val, redondeo bancario), §6.1 (*) -->

Fuera de los comentarios y los `def`, el cargador parte cada línea por los
espacios (y por los tabuladores) y convierte cada palabra en un token. Hay
pocas clases:

| Lo que escribís | Qué es | Ejemplo |
|---|---|---|
| Un número | Se apila tal cual | `10`, `-5` |
| `*` y un número | Lee esa dirección de memoria y apila lo que tiene | `*50` |
| `.` y un nombre | La dirección de una sysvar (o de un `def`): es un número | `.up` vale 1 |
| `*.` y un nombre | Lee esa sysvar | `*.nrg` |
| Un operador | Hace una cuenta, compara o escribe | `add`, `>`, `store` |
| Una marca de flujo | Organiza los genes | `cond`, `start`, `else`, `stop`, `end` |

Los números van de −32768 a 32767; uno con decimales se redondea al entero más
cercano (en el empate, al par: `2.5` vale 2). Más sobre direcciones y rangos en [[adn/numeros]], y los operadores
agrupados por familia en [[adn/operadores]].

Fijate que `.up` sin asterisco no lee nada: es solo el número de la dirección,
listo para que un `store` la use. Para leer el contenido hace falta el `*`. Un
`*` suelto también lee: `.nrg *` es lo mismo que `*.nrg` (ver [[op:*]]).

## Mayúsculas y minúsculas
<!-- 20-VM §2.4 (LCase de comandos), §8.2 (privadas case-sensitive) -->

Los operadores, las marcas de flujo y los nombres de sysvars se reconocen sin
importar mayúsculas: `COND *.NRG 1000 > START 10 .Up STORE STOP` es un bot
válido. Los nombres que inventás con `def`, en cambio, distinguen: si
definiste `pasos`, `.Pasos` no es lo mismo.

## Qué rechaza el cargador {#rechazos}
<!-- 20-VM §0.4, §2.4, §2.5; core loader.hpp to_vb_integer/insertvar -->

Casi nada. El cargador no rechaza palabras: toda palabra que no reconoce se
convierte en el número 0, y un `.nombre` que no existe también vale 0. Un error
de tipeo carga sin quejas y hace otra cosa:

```adn sin-lint
' Error a propósito: .upp no existe
cond
start
10 .upp store
stop
```

Acá `.upp` vale 0 y el `store` no escribe en ningún lado: el bot no se mueve.
Por eso el [[app/editor]] revisa el ADN y te avisa de las palabras que no
reconoce, con una sugerencia (en este caso, `.up`). La lista de tropiezos
habituales está en [[adn/errores]].

El bot entero se rechaza, y no entra en la simulación, solo en dos casos:

- **Un número fuera de −32768…32767**, en el código o como valor de un `def`.
  Por ejemplo, `40000 .up store`.
- **Un `def` incompleto**, sin nombre o sin valor, como `def pasos`.

Genes sin `stop`, un `stop` de más o condiciones sueltas cargan igual y se
ejecutan con las reglas de siempre.

## Una rareza heredada: el primer token y los def {#cero-inicial}
<!-- 20-VM §2.3, §2.6; README del port: A2-2 conservado; lint "primero" -->

DarwinBots 2.48.32 tiene una rareza que el port conserva: si el bot tiene algún
`def` y su primer token **no** es una marca de flujo (`cond`, `start`, `else`
o `stop`), ese primer token se pierde al cargar. Por ejemplo:

```adn sin-lint
def pasos 50
5 cond start 10 .up store stop
```

Ese `5` desaparece. Como lo que va antes del primer `cond` no se ejecuta
nunca, el bot se comporta igual; lo que cambia es la cuenta de su ADN:
[[.dnalen]] dice 7 en lugar de 8 (cuenta también el `end` final), y las [[simulacion/mutaciones]] trabajan
sobre la lista ya recortada. El editor te avisa cuando pasa. La solución es
simple: empezá el código con `cond` o con `start`, como hacen casi todos los
bots.
