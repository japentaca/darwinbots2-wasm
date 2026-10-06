---
titulo: .trefypos
resumen: "The vertical coordinate of the tied bot, as it published it the previous cycle."
etiquetas: [tref, ties, position]
estado: revisada
---
<!-- sysvars.yaml .trefypos (= mem(217) del atado), .ypos -->
It is a copy of the tied bot's [[.ypos]] (or `.depth`), with the same delay as
[[.trefxpos]]: one cycle older than what the partner reads about itself. As with
`.ypos`, the values grow toward the bottom of the map.

```adn
' If the tied bot is lower than I am, cell 50 is 1
cond
*.numties 0 >
*.trefypos *.ypos >
start
1 50 store
stop
```

Together with [[.trefxpos]] it gives you the complete position of the other end of the tie.
