---
titulo: .refxpos
resumen: "The x coordinate of what you are looking at: together with .refypos and the angle operator, it lets you aim right at it."
etiquetas: [vision, refvars, position, aiming]
estado: revisada
---
<!-- sysvars.yaml 689; 32-VISION §4 (copia de mem 219 del visto, asimetría por índice); README B2-4; core senses.hpp lookoccurr/lookoccurrShape; probado: apunta.txt contra lateral.txt; 32-VISION §3.5 (lastopppos solo con el ojo frontal); opcodes.yaml angle -->
`.refxpos` is the horizontal coordinate of the bot your focus eye sees, in the
same units as your own [[.xpos]]. Its counterpart is [[.refypos]].

With both coordinates, the [[op:angle]] operator computes which way the other
bot lies, and writing that angle to [[.setaim]] leaves you aiming straight at
it. It is the most precise way not to lose a moving target: turning blindly
with [[.aimdx]] lets it slip out of the front eye, which is narrow.

```adn
cond
*.eye5 0 =
start
40 .aimdx store
stop

' I have it in sight: aim at its center
cond
*.eye5 0 >
start
*.refxpos *.refypos angle .setaim store
stop
```

In a test against a bot moving sideways, a bot with these two genes kept it in
[[.eye5]] along its whole path.

What you get is the position the other bot _published_, not its exact position
at this moment: depending on the order in which the engine processes the bots, it can be
one cycle late. When what you see is a shape ([[.reftype]] at 1), it is a
point of the shape, and it is only reliable if the focus eye is the front one: with
another eye ([[.focuseye]]) the position of a shape is stale or 0. If you
don't see anything, it is 0.
