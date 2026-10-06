---
titulo: .up
resumen: "Pushes the bot forward, in the direction it points; you have to write it every cycle in which you want to push."
etiquetas: [movement, thrust, command]
estado: revisada
---
<!-- sysvars.yaml .up; 30-FISICA §2.1 -->
`.up` is the forward command. The number you write is a push in the direction of
[[.aim]]: the engine applies it in the same cycle and leaves the cell at 0. If you want to
keep pushing, write it again every cycle (see [[adn/errores#accion]]).

It is an acceleration, not a velocity: each push adds to what the bot was already
carrying. With the default settings, a single `10 .up store` leaves the bot
moving at about 7 per cycle; repeated cycle after cycle, it accelerates up to the cap of
[[.maxvel]]. If the simulation has no friction, the bot keeps sliding even if
you stop pushing.

<!-- 30-FISICA §2.1, §6 -->
The engine multiplies the push by the mass ([[.mass]]), clips the result to
[[.maxvel]] and then divides it by the mass when adding it to the velocity. As long as the
push times the mass doesn't exceed the cap, the mass cancels out: `10 .up store` accelerates
a light bot just the same as a heavy one. But the cap arrives sooner the heavier
the bot is: with mass 1, writing more than 40 (the default cap) is pointless, and with
mass 2, going past 20 no longer adds anything. That's why a heavy bot can't accelerate as much in a
single cycle. Moving costs energy in proportion to the push after clipping.

<!-- 30-FISICA §2.1 (dir = up−dn, sx−dx); §2 (bot fijo sin fuerzas) -->
`.up` combines with [[.dn]], [[.sx]] and [[.dx]]: the engine computes `.up − .dn` and
`.sx − .dx` and pushes along the resulting diagonal. A negative value pushes backward,
just like `.dn`. A bot anchored with [[.fixpos]] neither moves nor pays for movement.

```adn
' goes full speed while it has energy to spare
cond
*.nrg 1000 >
start
40 .up store
stop
```
