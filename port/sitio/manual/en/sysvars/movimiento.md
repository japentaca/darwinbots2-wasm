---
titulo: Movement
resumen: "The sysvars for pushing the bot, turning it, knowing where it points and how fast it goes, and anchoring it in one place."
etiquetas: [movement, turning, speed, physics]
estado: revisada
---
<!-- 30-FISICA §2.1, §6, §7; sysvars.yaml .up .aimsx .setaim -->
A bot does not walk: it pushes itself. The four movement commands, [[.up]],
[[.dn]], [[.sx]] and [[.dx]], are pushes forward, backward, to the left and to the
right, always measured from where the bot points. The engine applies them in the
same cycle and sets them to 0, so to keep pushing you have to write them every
cycle. Each push is added to the speed it already had: it is an acceleration, not
a speed.

There are two ways to turn. [[.aimsx]] and [[.aimdx]] turn _by_ an amount to the
left or the right; [[.setaim]] turns _to_ an absolute heading. The current heading
is read in [[.aim]]. Angles are measured in a unit of their own: a full turn is
1256, so 314 is a quarter turn. 0 looks to the right of the screen, 314 up, 628 to
the left and 942 down.

<!-- sysvars.yaml .velup .velscalar .maxvel .fixpos -->
The speed ones report how the bot moved in the last cycle: [[.velup]] and
[[.veldn]] forward and backward, [[.veldx]] and [[.velsx]] sideways, and
[[.velscalar]] the total speed. [[.maxvel]] gives the cap imposed by the
simulation. Finally, [[.fixpos]] anchors the bot in place and [[.fixed]] reports
whether it is anchored.

<!-- probado: el ejemplo sale del borde y sigue -->
The most used are `.up` and `.setaim`: aim and advance. This bot always advances
and, while it is against the edge of the world (reported by [[.edge]]), turns a
little every cycle until it breaks free:

```adn
cond
start
20 .up store
stop

cond
*.edge 0 !=
start
100 .aimsx store
stop
```

The cost of moving and turning depends on the simulation's configuration (see
[[adn/ejecucion#costos]]), and the full physics is in [[simulacion/fisica]].
