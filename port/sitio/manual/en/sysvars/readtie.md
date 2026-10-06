---
titulo: .readtie
resumen: "Chooses, by its port, which tie the tref* cells (what the bot feels from the other end) come from; 0 uses the one in .tiepres."
etiquetas: [ties, tie, configuration]
estado: revisada
---
The cells of [[sysvars/tref|what it feels through a tie]], such as [[.trefnrg]] or
[[.trefage]], describe _one_ tied bot. With `.readtie` you choose which: write the
port of that tie. With 0 the one in [[.tiepres]] is used.

Unlike [[.tienum]], the engine doesn't clear it: it is a stable selection that
stays until you change it. If the port you set doesn't exist, the `tref*` cells
stay at 0.

<!-- sysvars.yaml .readtie (readtie P1: puerto del que leer, 0 = tiepres; nunca se borra); 34-TIES §2 (si el puerto no existe, EraseTRefVars) -->

The engine fills the `tref*` cells after the DNA runs, so you read them one
cycle late, like any sense.

<!-- 10-CICLO §2 P1 (readtie al final de P1) -->

```adn
' always read the partner on tie 7
cond
*.robage 0 =
start
7 .readtie store
stop
```
