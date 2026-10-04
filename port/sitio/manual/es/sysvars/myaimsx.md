---
titulo: .myaimsx
resumen: "Cuántas veces el ADN del propio bot escribe en .aimsx (la orden de girar a la izquierda): parte de la firma con la que se reconoce a la propia especie."
etiquetas: [especie, reconocimiento, firma]
estado: revisada
---
Un contador sacado del propio ADN: cuántas veces aparece una escritura en
[[.aimsx]], es decir, el número 6 (la dirección de `.aimsx`) seguido
inmediatamente de una palabra de la [[adn/stores#la-familia-completa|familia de
store]], como [[op:store]], [[op:inc]] o [[op:addstore]].
Cuentan `35 .aimsx store` y `.aimsx inc`; no cuenta una dirección calculada, ni un
`.aimsx` que no vaya justo antes de la escritura. Como lo que se mira es el número,
también cuenta si escribís la dirección a mano (`6` en vez de `.aimsx`).

No dice si esas escrituras se ejecutan: cuenta lo que está escrito en el
genoma, corra o no.
<!-- sysvars.yaml .myaimsx; makeoccurrlist (port/core senses.hpp): número 1..7 seguido de un token de tipo store; probado con store, inc, addstore, dec y un gen que no corre -->

Su pareja es [[.refaimsx]], que trae la misma cuenta pero del ADN del bot que
se está viendo. Compararlas es una forma de reconocer a los de la propia
especie (ver [[sysvars/my]]):
<!-- sysvars.yaml .refaimsx -->

```adn
' lo que veo escribe en .aimsx una cantidad de veces distinta que yo
cond
*.eye5 0 >
*.refaimsx *.myaimsx !=
start
1 60 store
stop
```

El motor la calcula cuando el ADN cambia (al cargar, al nacer, por un virus o
una mutación; ver [[sysvars/my#cuando]]), no en cada ciclo. Si el bot escribe en ella, su valor cambia
para él, pero los demás siguen viendo la cuenta original.
