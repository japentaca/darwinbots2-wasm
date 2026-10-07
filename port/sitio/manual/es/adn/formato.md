---
titulo: El formato .txt
resumen: "Cómo es por dentro el archivo .txt de un bot: líneas, comentarios, la cabecera '#, la codificación y qué cambia cuando el motor lo exporta."
etiquetas: [formato, txt, archivo, exportar, cabecera, hash]
estado: revisada
---
Todos los bots se guardan como archivos de texto con extensión `.txt`: los del
Bestiario, los que escribís vos y los que la app exporta desde una simulación.
Esta página cuenta cómo lee ese archivo el cargador, línea por línea, y qué
escribe el motor cuando lo saca de vuelta. La forma del ADN en sí (genes,
tokens, `def`) está en [[adn/estructura]]; los otros formatos de la app, como
las simulaciones guardadas, en [[tecnico/formatos]].

## Líneas {#lineas}
<!-- 20-VM §2.2 (decisión RV-04: corta en LF, quita el CR final, no corta en CR suelto; tabs y Trim) -->

El cargador lee el archivo de a una línea por vez:

- Acepta fin de línea Windows (CR+LF) y Unix (LF solo), y mezclados. Un CR
  suelto, como en los archivos de los Mac viejos, **no** corta la línea: el
  archivo entero queda como una sola línea y el bot no hace nada.
- Los tabuladores valen como espacios, y los espacios de los bordes no
  importan. Podés sangrar el código como quieras.
- Una línea vacía se ignora.

Dentro de una línea, las palabras se separan por uno o más espacios. Los
saltos de línea no tienen otro significado: dónde cortes el código es cosa
tuya.

## Lo que el cargador ignora {#comentarios}
<!-- 20-VM §2.2 pasos 1-5, §8.3 -->

| Línea | Qué hace el cargador |
|---|---|
| Empieza con `'` (después de los espacios) | La ignora: es un comentario |
| Empieza con `/` | La ignora: es un comentario |
| Tiene una `'` en el medio | Lee hasta la comilla y descarta el resto |
| Empieza con `'#` o `/#` | Es una línea de cabecera (abajo) |
| Empieza con `def` | Define una variable; no agrega tokens ([[adn/def]]) |
| Cualquier otra | Se parte en palabras y cada una es un token |

Ojo con dos detalles. La barra solo comenta al principio de la línea: un `//`
en el medio son palabras que valen 0. Y toda línea que empiece con las letras
`def` se toma como un `def`, aunque la palabra sea otra: `defensa 50` define
una variable llamada `nsa`.

## Codificación {#codificacion}
<!-- 20-VM §0.4 (palabra desconocida = 0); lint de db_dna_lint (caracteres invisibles o de codificación) -->

La app lee el archivo como texto UTF-8. En los comentarios podés escribir lo
que quieras, con acentos y eñes. En el código, en cambio, solo cuentan los
caracteres comunes del teclado inglés: una palabra con un carácter raro (un
acento, un espacio duro copiado de una página web, un carácter invisible) no
se reconoce y vale 0. Por ejemplo, un `stop` con un espacio duro en el medio
deja de cerrar el gen. El [[app/editor]] te avisa cuando encuentra una palabra
así.

## La cabecera '# {#cabecera}
<!-- 20-VM §2.2 paso 3 (getvals; hash sobre el texto anterior; si no coincide se resetean generation y OldMutations); 60-FORMATOS §1; core formats.hpp (tag de 45 caracteres); comprobado en el port: tag acentuado e ida y vuelta del hash -->

Las líneas que empiezan con `'#` (o con `/#`) llevan datos sobre el bot, con
la forma `'#nombre: valor`. El cargador entiende cuatro:

| Línea | Qué guarda |
|---|---|
| `'#generation: 7` | La generación del bot |
| `'#mutations: 3` | Cuántas mutaciones acumula su linaje |
| `'#tag: texto` | Una etiqueta libre, de hasta 45 caracteres |
| `'#hash: …` | Una firma de 20 caracteres del texto anterior |

Cualquier otra línea `'#`, o una con un valor que no se entiende, se ignora
sin rechazar el bot. En la etiqueta, las letras fuera del inglés básico se
vuelven signos de pregunta: `'#tag: Acción` queda como `Acci??n`.

El `'#hash` es un control contra la edición a mano. El motor lo calcula sobre
todo el texto que viene antes, y al cargar lo vuelve a calcular. Si no
coincide, la generación y las mutaciones vuelven a 0; el ADN carga igual. Por
eso, si cambiás algo de un archivo exportado (el código, la generación, o
incluso si agregás un comentario arriba), el bot pierde su historia y vuelve a
la generación 0. Cambiar los fines de línea de CR+LF a LF no la rompe. Un
archivo sin `'#hash` conserva lo que diga su cabecera.

## Cómo exporta el motor un bot {#exportar}
<!-- 60-FORMATOS §0.5, §1; 20-VM §9 (destokenización, VOID); core formats.hpp SalvarobText (UseEpiGene apagado en la app); comprobado en el port con el ejemplo -->

En la app, el texto de un bot vivo está en la pestaña ADN del
[[app/inspector]], con el botón **Copiar**. Ese texto no es el archivo
original: el motor lo reconstruye a partir de los tokens, igual que el
DarwinBots original al guardar un bot. Si el bot mutó desde que lo abriste,
**Releer** trae la versión actual.

Con este bot de partida:

```adn
'#generation: 7
'#mutations: 3
' Gira 10 por ciclo durante 5 ciclos
def pasos 50

cond
  *.pasos 5 <
start
  .aim * 10 add .setaim store
  .pasos inc   ' suma 1 a la dirección 50
stop
```

lo que exporta el motor es esto (las líneas de comillas son comentarios de
gen que agrega él):

```adn
'#generation: 7
'#mutations: 3

 cond
 *50 5 <
 start
 18 * 10 add .setaim store
 50 inc
 stop
''''''''''''''''''''''''  Gene:  1 Ends at position  14  '''''''''''''''''''''''

'#hash: …
```

Comparalos y vas a ver todo lo que cambia:

- **Los comentarios desaparecen.** Los tuyos no se guardan en el ADN.
- **Los `def` desaparecen** y en su lugar quedan los números: `*.pasos` sale
  como `*50`.
- **Las sysvars recuperan su nombre solo en dos lugares:** después de un `*`
  (`*.nrg`) y justo antes de un `store` u otra palabra que escribe en memoria
  (`.setaim store`). En cualquier otro lugar sale el número: `.aim`
  quedó como `18`.
- **El formato es siempre el mismo:** un espacio al principio de cada línea y
  un salto después de cada condición, cada operador lógico, cada escritura y
  cada marca de flujo.
- **Se agregan comentarios de gen** con la posición donde empieza y termina
  cada uno (las posiciones cuentan tokens, desde 1).
- **Se agrega la cabecera:** `'#generation`, `'#mutations` (las del bot más las
  que traía), una línea en blanco y el `'#hash`; y `'#tag` si el bot tiene
  etiqueta.

Volver a cargar ese texto da el mismo bot, con la misma generación. La única
excepción viene de las [[simulacion/mutaciones]]: pueden dejar tokens que no
tienen forma escrita, y el motor los exporta como `VOID`, una palabra que al
recargar vale 0. Un ADN así no vuelve idéntico.

:::nota
El DarwinBots original podía agregar al exportar un gen extra que restituye la
memoria epigenética del bot (ver [[adn/memoria]]). La app no lo agrega: el
texto que copiás tiene solo el ADN.
:::

## Tus bots, el Bestiario y los archivos {#archivos}
<!-- procedencia del Bestiario: port/web/bots/bots.json (673 enlaces al foro, 10 al wiki) -->

- **Para traer un `.txt`** a una simulación, en [[app/inicio]] usá «Desde un
  archivo»: siembra el bot en un mundo con algas.
- **Tus bots** viven en la biblioteca de la app ([[app/bots]]). El editor
  guarda el texto tal como lo escribiste, con comentarios y `def`, y cada
  versión por separado; la reconstrucción del motor es solo lo que copiás desde
  el inspector.
- **Los bots del Bestiario** son archivos publicados en el foro y el wiki de
  DarwinBots.
  Por eso algunos tienen comentarios de gen y una cabecera con `'#hash`: son
  bots que alguien exportó de una simulación.
- **Para respaldar** tu biblioteca entera, la app la exporta como un archivo
  `.json` (ver [[app/tus-datos]]).

:::cuidado
Si querés conservar tus comentarios y tus nombres, guardá tu propio texto. Lo
que copiás del inspector sirve para estudiar o reutilizar un bot evolucionado,
pero ya no tiene nada de lo que el cargador ignora.
:::
