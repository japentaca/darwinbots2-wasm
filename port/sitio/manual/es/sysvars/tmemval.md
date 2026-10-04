---
titulo: .tmemval
resumen: "El contenido de una celda de la memoria del bot atado; la celda la elegís con .tmemloc."
etiquetas: [memoria, espionaje, lazos, tref]
estado: revisada
---
<!-- sysvars.yaml .tmemval (= mem(tmemloc) del atado, solo si tmemloc en 1..1000; si no, no se toca); core ties.hpp ReadTRefVars; atraso comprobado con probar-adn -->
Si en [[.tmemloc]] pusiste una dirección entre 1 y 1000, `.tmemval` trae lo que tiene
esa celda en la memoria del bot atado, del mismo lazo que describen las
[[sysvars/tref|tref*]] (el que elegís con [[.readtie]]). Es la versión por lazo de
[[.memval]].

La foto se toma después de que corrió el ADN del otro: si tu compañero escribe su
celda 61 en un ciclo, vos leés ese valor en el ciclo siguiente.

```adn
' Si el atado tiene mi mismo largo de ADN, la celda 50 vale 1
cond
*.numties 0 >
*.tmemval *.dnalen =
start
1 50 store
stop
```

(con `.dnalen .tmemloc store` escrito antes en algún gen). Dos trampas: si ponés en
`.tmemloc` una dirección fuera de 1..1000, `.tmemval` no se borra, sino que se queda
con el último valor leído. Y cuando el lazo se corta, recién vuelve a 0 un ciclo
después, como el resto de las tref*.
