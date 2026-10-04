---
titulo: Virus
resumen: "Cómo un bot copia uno de sus genes en un virus, lo incuba y lo dispara, dónde se mete el gen en el ADN de la víctima, cómo se borran genes y cuánto cuesta todo."
etiquetas: [virus, genes, ADN, delgene, infección]
estado: revisada
---
Un _virus_ es un gen empaquetado en un disparo. El bot copia uno de sus
genes, lo incuba unos ciclos y lo dispara; si el disparo toca a otro bot, el
gen se inserta en su ADN y desde el ciclo siguiente corre como uno más de los
suyos. Es la única forma de meterle código a otro bot, y la única, junto con
las mutaciones, de que un ADN crezca en vida.

Las celdas que intervienen son cuatro: [[.mkvirus]], [[.vtimer]],
[[.vshoot]] y [[.delgene]]. Están agrupadas en [[sysvars/adn-y-virus]]; esta
página cuenta el ciclo completo.

## El ciclo de un virus {#ciclo}
<!-- 35-VIRUS §0-§3; core robots.hpp BotDNAManipulation (fase de movimiento: Vtimer, MakeVirus, Vshoot, delgene) -->

```
 .mkvirus ──► incubación ──► listo ──► .vshoot ──► vuelo ──► infección
 (gen N)     .vtimer baja   .vtimer    (fuerza)   dirección  el gen entra
             de a 1         queda en 1            al azar    en la víctima
```

1. **Fabricar.** Escribís en [[.mkvirus]] el número de uno de tus genes. El
   motor lo copia entero, desde su `cond` (o su `start`) hasta su `stop`.
2. **Incubar.** [[.vtimer]] arranca en el doble de palabras del gen copiado y
   baja de a 1 por ciclo. Al llegar a 1 se detiene: el virus está listo.
3. **Disparar.** Con el virus listo y un número distinto de 0 en
   [[.vshoot]], el virus sale. Si escribiste `.vshoot` antes, la orden espera
   y el virus sale apenas termina la incubación.
4. **Infectar.** Si en su vuelo toca a otro bot, le inserta el gen.

La fabricación y el disparo ocurren en la fase de movimiento, después de que
corrió el ADN; el virus disparado empieza a volar en la fase de los disparos del
ciclo siguiente, como cualquier otro disparo.

## Fabricar {#fabricar}
<!-- 35-VIRUS §0.2, §0.3, §1 (gate Vtimer = 0; mkvirus no se consume; gen inválido no fabrica); core BotDNAManipulation (costo length/2 · DNACOPYCOST · COSTMULTIPLIER); comprobado con probar-adn (--cost 25=1,54=1): un gen de 12 palabras cuesta 12 al fabricar y .vtimer se lee 23 al ciclo siguiente -->

Reglas de la fabricación:

- **Un virus por vez.** Mientras haya uno incubando o esperando el disparo,
  escribir otra vez en `.mkvirus` no hace nada.
- **La orden no se borra al fabricar**, sino al disparar: mientras el virus
  incuba, la celda conserva el número del gen.
- **Un número de gen que no existe** no fabrica nada. La numeración es la de
  [[adn/genes#la-numeracion-de-los-genes]].
- **Virus y fotosíntesis no se llevan.** Si el bot tiene cloroplastos, la
  orden no fabrica el virus y le quita todos los cloroplastos. Como la orden
  sigue escrita, el virus se fabrica en el ciclo siguiente.

La copia cuesta energía según el largo del gen: el costo de copia del ADN
([[param:cost:25]]) por cada palabra. Un gen largo es caro de copiar y,
además, tarda más en incubarse: un gen de 12 palabras incuba 24 ciclos.

## Disparar {#disparar}
<!-- 35-VIRUS §2 (energía vshoot·20 con tope 32000; Range = 11 + vshoot/2; dirección Random; velocidad RobSize/3 + actvel; resets); README B3b-1 (un solo cobro); core shots.hpp Vshoot; comprobado con probar-adn (--cost 23=5,54=1): 30 .vshoot cuesta 35 -->

El número que escribís en [[.vshoot]] es la **fuerza** del disparo. Un
negativo cuenta como 1. De la fuerza salen tres cosas:

| | Con fuerza F |
|---|---|
| Energía que lleva el virus | 20 × F (tope 32000) |
| Ciclos que vuela | 11 + F/2 |
| Lo que paga el bot | F (como mucho 1600) más el costo de disparo ([[param:cost:23]]) |

El virus avanza unas 40 unidades por ciclo (más la velocidad que traía el
bot), así que con fuerza 30 vuela 26 ciclos y llega a más de 1000 unidades:
mucho más lejos que un disparo común. A medida que envejece pierde energía,
como cualquier disparo (ver [[simulacion/disparos]]).

Lo que no se elige es la dirección: **sale hacia un lado al azar**. Ni
[[.aim]] ni [[.aimshoot]] influyen. Por eso los bots que viven de virus no
apuntan: disparan cuando tienen a alguien cerca, o todo el tiempo.

Después del disparo, el motor pone en 0 `.vshoot`, `.mkvirus` y `.vtimer`, y
el bot queda libre para fabricar otro.

:::nota
En el DarwinBots original, el disparo de un virus se cobraba dos veces. En
esta versión se cobra una sola.
:::

## La infección {#infeccion}
<!-- 35-VIRUS §3 (inmunes: corpses; slime; Position = Random(0, genenum); MakeSpace tope 32000; SubSpecies nueva; Mutations +1); README B3b-2, B3b-3; core shots.hpp addgene: power = nrg / (Range·40) < 1 siempre; absorbe si power < slime/20 (slime −= power·20), si no slime = 0; comprobado con probar-adn: una víctima con ~25 de baba no se infecta con fuerza 20 ni con fuerza 1000; los de la misma especie se infectan entre sí -->

Cuando el virus toca a un bot, pasa esto:

1. **Los cadáveres no se infectan.** El virus se pierde.
2. **La baba defiende.** El virus tiene una potencia que sale de la energía
   que le queda y de cuánto vuela. Si la baba ([[.slime]]) del bot alcanza
   para frenarla, el virus se absorbe y la baba se gasta un poco. Si no
   alcanza, el virus pasa y la baba se agota entera.
3. **El gen se inserta en un lugar al azar.** Con un ADN de N genes hay N + 1
   lugares posibles, todos igual de probables: antes del primer gen o justo
   después de cualquiera de ellos. Nunca queda en medio de un gen.
4. **El ADN de la víctima cambia de verdad.** [[.genes]] y [[.dnalen]] se
   actualizan en el acto, la infección cuenta como una mutación y el bot pasa
   a ser una subespecie nueva (ver [[simulacion/especies]]). Lo que hereden
   sus hijos ya trae el gen.

La potencia de un virus es siempre menor que 1, y cada unidad de potencia se
frena con 20 de baba. En la práctica, **unas 20 de baba frenan cualquier
virus**, sea cual sea su fuerza; con menos, pasan los más fuertes y los que
pegan recién disparados. Más sobre la baba en [[simulacion/defensas]].

El virus no distingue especies: un bot no se infecta con su propio virus,
pero sí puede infectar a otros de su especie. Un ADN no puede pasar de 32000
palabras: si el gen no entra, la infección no ocurre.

Como el gen entra en cualquier lugar, **los genes que estaban después se
corren un número**. Si la víctima usa números de gen fijos (en `.delgene` o
`.mkvirus`), después de una infección pueden apuntar a otro gen.

:::nota
En el original, la potencia se multiplicaba por el número del gen copiado
(copiar el gen 7 contagiaba siete veces más fuerte que copiar el gen 1), y
atravesar una capa de baba fortalecía al virus en vez de debilitarlo. Esta
versión corrige las dos cosas, y por eso la baba protege mucho más que en el
original.
:::

## Un virus que se propaga solo {#epidemia}
<!-- 35-VIRUS §3 (el gen inyectado puede contener mkvirus/vshoot); port/web/bots: Coexistence_viral_plant_Apr_2022.txt, Lazy_One.txt (*.thisgene .mkvirus store); comprobado con probar-adn: la víctima empieza a fabricar (su .vtimer deja de valer 0) y paga sus propios disparos -->

El truco para que la víctima también contagie es que el gen se empaquete a
sí mismo con [[.thisgene]], que vale el número del gen que se está
ejecutando. Así no importa en qué lugar del ADN ajeno caiga:

```adn
' Un gen que se empaqueta a si mismo: quien lo recibe tambien contagia
cond
 *.vtimer 0 =
start
 *.thisgene .mkvirus store
 30 .vshoot store
stop
```

<!-- comprobado con probar-adn (epidemia contra una víctima de 2 genes, campo 700x700): la víctima pasa de 2 a 9 genes en 400 ciclos, fabrica y dispara sus propios virus -->
Probado contra un bot de dos genes, la víctima empieza a fabricar y disparar
sus propios virus en cuanto la tocan, y en 400 ciclos termina con varias
copias del gen: cada infección nueva agrega otra. La energía de cada disparo
la paga ella. Bots del Bestiario como _Lazy One_ o _Coexistence viral plant_
(evolucionado) llevan `*.thisgene .mkvirus store` en sus genes.

Lo que hace el virus depende de lo que traiga el gen. _BodySnatcher_
(k0zm0, 2005), cuando ve a otro bot, le dispara copias de sus genes 3 y 4,
los que convierten energía en cuerpo y al revés, para que la víctima maneje
su cuerpo como él.

## Borrar genes {#delgene}
<!-- 35-VIRUS §4 (delgene P3, valida 0 < g ≤ genenum; Disqualify); core robots.hpp delgene (sin costo); comprobado con probar-adn: la víctima de este ejemplo queda con .genes 0 y .dnalen 1 -->

[[.delgene]] borra del propio ADN el gen con ese número, entero, en la fase
de movimiento del mismo ciclo. No cuesta energía, y desde ese momento el gen
no corre, no paga mantenimiento y no pasa a los hijos. Un número que no
corresponde a ningún gen no hace nada. El uso clásico es un gen de arranque
que se borra a sí mismo con `*.thisgene .delgene store` (ver la página de
`.delgene`).

Combinado con un virus da un arma: un gen que, en la víctima, la hace
borrarse genes. Para que no le pase lo mismo al que lo fabrica, el gen mira
una marca que solo tiene el fabricante:

```adn
' Virus que hace que la victima se borre los genes
' Gen 1: la marca propia y el virus con el gen 2
cond
 *.vtimer 0 =
start
 1 90 store
 2 .mkvirus store
 20 .vshoot store
stop
' Gen 2: en quien no tiene la marca, borra el primer gen
cond
 *90 0 =
start
 1 .delgene store
stop
```

En la víctima, el gen 2 borra un gen por ciclo, empezando por el primero.
Cuando ya borró todos los que tenía delante, él mismo pasa a ser el gen 1 y
se borra. Los genes que quedaron detrás del punto donde cayó se salvan: si
cayó al final, la víctima pierde todo; si cayó primero, solo se borra a sí
mismo. Probado contra un bot de dos genes, la primera infección le borró uno;
la segunda cayó adelante y no le hizo nada; la tercera se llevó el que
quedaba, y la víctima terminó sin ningún gen: un bot que no piensa.
<!-- comprobado con probar-adn (victima3 de 2 genes contra borrador.txt, campo 700x700, semilla 1): genes 2 → 1 en el ciclo 93, sin cambio en el 272, 0 en el 381 -->

Ningún disparo puede escribir `.delgene` de otro: los disparos de memoria la
saltean y el veneno no puede apuntarle. Pero un bot atado sí puede, con
[[.tieloc]] (ver [[simulacion/lazos]]).

## Costos y reglas de torneo {#costos}
<!-- core BotDNAManipulation, Vshoot (nrg −= tempa/20 + SHOTCOST·mult, tempa = min(20·vshoot, 32000)), delgene; port/README B3b-1; opciones.js opt 93 (nivel 1: ataduras/virus) -->

| Acción | Costo |
|---|---|
| Fabricar | [[param:cost:25]] por cada palabra del gen copiado |
| Disparar | La fuerza más [[param:cost:23]] |
| Infectar | Nada para la víctima, salvo la baba que gaste |
| Borrar un gen | Nada |

Los dos parámetros se multiplican por el multiplicador de costos de la
simulación, como todos; la fuerza que pagás al disparar, no. Por lo demás, el gen que entra pesa en la víctima
como cualquier otro: más ADN es más costo por ciclo (ver
[[adn/ejecucion]]).

En los torneos, la opción de descalificación ([[param:opt:93]]) puede
prohibir los virus y el borrado de genes; qué prohíbe cada nivel está en esa
opción.
