---
titulo: .readtie
resumen: "Elige, por su puerto, de qué lazo vienen las celdas tref* (lo que el bot siente del otro); 0 usa el de .tiepres."
etiquetas: [lazos, tie, configuración]
estado: revisada
---
Las celdas de [[sysvars/tref|lo que se siente por un lazo]], como [[.trefnrg]] o
[[.trefage]], describen a _un_ bot atado. Con `.readtie` elegís cuál: escribí el
puerto de ese lazo. Con 0 se usa el de [[.tiepres]].

A diferencia de [[.tienum]], el motor no la borra: es una selección estable que
queda hasta que la cambies. Si el puerto que pusiste no existe, las celdas `tref*`
quedan en 0.

<!-- sysvars.yaml .readtie (readtie P1: puerto del que leer, 0 = tiepres; nunca se borra); 34-TIES §2 (si el puerto no existe, EraseTRefVars) -->

El motor llena las `tref*` después de que corre el ADN, así que las leés con un
ciclo de atraso, como cualquier sentido.

<!-- 10-CICLO §2 P1 (readtie al final de P1) -->

```adn
' leer siempre al compañero del lazo 7
cond
*.robage 0 =
start
7 .readtie store
stop
```
