---
titulo: .edge
resumen: "It is 1 when the bot is resting against the edge of the world; use it to avoid getting stuck to the wall."
etiquetas: [edge, sense, position, collision]
estado: revisada
---
<!-- sysvars.yaml .edge; 30-FISICA §5; 10-CICLO §7 -->
`.edge` signals that the bot reached the edge of the world: the engine sets it to 1 when the
bot ended up resting against the wall in the physics step, and clears it after the
DNA of the next cycle runs. That means your DNA sees it as 1 for a single
cycle, the one after the contact; if the bot keeps pushing against the wall, it
turns on again every cycle.

It only exists in worlds with walls. If the simulation connects the edges (a bot
that leaves on one side comes in on the opposite one), `.edge` doesn't turn on at those edges;
if it connects only those of one axis, the other two turn it on.

<!-- 30-FISICA §5 (clamp + amortiguador 0,05); probado con el ejemplo -->
A bot against the wall doesn't bounce: the engine leaves it resting on the edge, and if it keeps
pushing outward it stays there, sometimes stuck in a corner. Worse: its
[[.velscalar]] keeps saying it's going fast. That's why it's worth reacting to `.edge`
by turning, as _Anon Terifica 2_, from the Bestiary, does:

```adn
cond
*.edge 0 !=
start
100 .aimsx store
stop
```

It's best for the turn to be small: since `.edge` stays on as long as the bot is
against the wall, a quarter turn per cycle can leave it going
around in circles in a corner, whereas turning 100 at a time ends up pointing outward.

Collisions with other bots don't turn it on; that's what [[.hit]] and its
directions are for.
