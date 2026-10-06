---
titulo: pyth
resumen: "Gives the hypotenuse of the top two numbers of the stack, the square root of a² + b²: the length of a vector."
etiquetas: [geometry, Pythagoras, distance, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (pyth: Sqr(a²+b²) en Single, satura 2·10⁹); 20-VM §6.2 (dist usa pos del bot); sysvars.yaml .xpos (P5, latencia 1 ciclo); comprobado en el port -->

`a b pyth` leaves the square root of `a² + b²`, rounded: the Pythagorean
theorem. `3 4 pyth` gives 5. The order doesn't matter, and neither does the
sign.

It's useful for the length of any vector whose two components you have. For
example, the bot's speed from its forward velocity ([[.velup]]) and its
sideways velocity ([[.veldx]]):

```adn
cond
start
  *.velup *.veldx pyth 50 store
stop
```

(For speed in particular, [[.velscalar]] already exists, which the engine
calculates for you.)

With coordinate differences it gives a distance:
`*.refxpos *.xpos sub *.refypos *.ypos sub pyth` gives almost the same as
`*.refxpos *.refypos dist` in a normal-sized world, but [[op:dist]] does it in
a single word and uses the bot's exact position at that moment, not the one in
[[.xpos]] and [[.ypos]], which arrives one cycle late.
