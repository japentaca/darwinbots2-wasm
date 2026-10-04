---
titulo: .mysx
resumen: "Cuántas veces el ADN del propio bot escribe en .sx (la orden de empujar hacia la izquierda): parte de la firma con la que se reconoce a la propia especie."
etiquetas: [especie, reconocimiento, firma]
estado: revisada
---
Un contador sacado del propio ADN: cuántas veces aparece una escritura en
[[.sx]], es decir, el número 3 (la dirección de `.sx`) seguido
inmediatamente de una palabra de la [[adn/stores#la-familia-completa|familia de
store]], como [[op:store]], [[op:inc]] o [[op:addstore]].
Cuentan `20 .sx store` y `.sx inc`; no cuenta una dirección calculada, ni un
`.sx` que no vaya justo antes de la escritura. Como lo que se mira es el número,
también cuenta si escribís la dirección a mano (`3` en vez de `.sx`).

No dice si esas escrituras se ejecutan: cuenta lo que está escrito en el
genoma, corra o no.
<!-- sysvars.yaml .mysx; makeoccurrlist (port/core senses.hpp): número 1..7 seguido de un token de tipo store; probado con store, inc, addstore, dec y un gen que no corre -->

Su pareja es [[.refsx]], que trae la misma cuenta pero del ADN del bot que
se está viendo. Compararlas es una forma de reconocer a los de la propia
especie (ver [[sysvars/my]]):
<!-- sysvars.yaml .refsx -->

```adn
' lo que veo escribe en .sx una cantidad de veces distinta que yo
cond
*.eye5 0 >
*.refsx *.mysx !=
start
1 60 store
stop
```

El motor la calcula cuando el ADN cambia (al cargar, al nacer, por un virus o
una mutación; ver [[sysvars/my#cuando]]), no en cada ciclo. Si el bot escribe en ella, su valor cambia
para él, pero los demás siguen viendo la cuenta original.
