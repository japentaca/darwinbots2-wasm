---
titulo: .dnalen
resumen: "El largo del ADN del bot en palabras, contando el end final; de él dependen el mantenimiento y el costo de copiarlo."
etiquetas: [ADN, sentido, costos]
estado: revisada
---
<!-- sysvars.yaml .dnalen (pinned cada P3 y en carga, nacimiento, mutación, delgene, addgene); comprobado: `cond start 1 50 store stop` da 7 desde el primer ciclo -->
Cuenta las palabras del ADN, incluido el `end` que cierra todo ADN: un bot
`cond start 1 50 store stop` tiene 6 palabras y `.dnalen` vale 7. Las líneas
`def` y los comentarios no cuentan (ver [[adn/def]]). Como [[.genes]], ya está
publicada desde el primer ciclo.

<!-- 31-ENERGIA §1 ((DnaLen−1)·DNACYCCOST por ciclo; DnaLen·DNACOPYCOST al nacer) -->
Importa por la energía. Según la configuración, el bot paga cada ciclo por el largo
de su ADN, se ejecute o no ([[param:cost:24]]), y al reproducirse paga por copiarlo
([[param:cost:25]]); ver [[adn/ejecucion#adn-largo]]. Un ADN que creció por
mutaciones o por virus se vuelve caro.

Cambia cuando cambia el ADN: mutaciones, genes borrados con [[.delgene]] o virus
insertados. Escribir en `.dnalen` no tiene efecto: el motor la reescribe cada
ciclo.

```adn
' Si el ADN creció mucho (por ejemplo, por un virus), cancela
' cualquier pedido de reproducción: va después del gen que lo pide
cond
 *.dnalen 200 >
start
 0 .repro store
stop
```
