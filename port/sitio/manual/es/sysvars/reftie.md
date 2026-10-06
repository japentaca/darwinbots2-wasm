---
titulo: .reftie
resumen: "Cuántas veces aparece .tie en el ADN del bot que estás viendo: si es mayor que 0, sabe atarse a otros bots."
etiquetas: [visión, refvars, firma, lazos]
estado: revisada
---
<!-- sysvars.yaml 712; core senses.hpp makeoccurrlist (occurr 9: el número 330 en cualquier lugar); probado: firma.txt (.tie y 330 dan 2) -->
Cuenta cuántas veces aparece en el ADN del bot visto el número 330, que es la
dirección de [[.tie]]. A diferencia de [[.refup]] y sus vecinas, no hace falta
que vaya seguido de una escritura: cualquier aparición suma, tanto `.tie`
como un `330` suelto.

Un valor mayor que 0 dice que el otro tiene con qué atarse a vos; es la señal
de los parásitos y los multibots que se pegan a sus presas (ver
[[simulacion/lazos]]). Tu propia cifra es [[.myties]]. Como el resto de la
firma, no se recalcula en cada ciclo y vale 0 si no ves nada.

```adn
' me alejo de lo que sabe atarse
cond
*.eye5 0 >
*.reftie 0 >
*.myties 0 =
start
628 .aimdx store
stop
```
