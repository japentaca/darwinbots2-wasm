---
titulo: .tielen
resumen: "The length of the .tiepres tie, measured edge to edge between the two bots."
etiquetas: [ties, tie, senses]
estado: revisada
---
It is the distance between the bot and its partner minus the two radii: close to
0 when they touch, and it can be slightly negative if they overlap. The engine
publishes it at the end of every cycle, so you read it one cycle late. It is 0 if
there is no tie.

<!-- sysvars.yaml .tielen (UpdateTieAngles P5 = CInt(dist − radios); 0 sin tie) -->

Like [[.tieang]], it always measures the [[.tiepres]] tie, even if you write another one in
[[.tienum]]; and the parent, which sees the birth tie with tie port 0, reads 0
until it has another tie.

It is useful for controlling the shape of an organism or for knowing whether you are being
dragged: a tie that breaks is one that went past 1000 edge to edge.

<!-- 34-TIES §1 (borrado por longitud > 1000 + radios) -->

```adn
' if the partner ended up far away, go toward it
cond
*.tielen 200 >
start
*.tieang .aimdx store
10 .up store
stop
```

To set the length there is [[.fixlen]], and to measure the first four ties of
a multicellular bot, [[.tielen1]]…`.tielen4`.
