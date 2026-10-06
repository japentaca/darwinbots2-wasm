---
titulo: .aim
resumen: "Where the bot is pointing, on a scale of 0 to 1255 where 0 is the right of the screen and 314 is up."
etiquetas: [turning, heading, sense]
estado: revisada
---
<!-- sysvars.yaml .aim (0..~2513 con momento angular); 30-FISICA §7 -->
`.aim` is the bot's heading: where it faces, where [[.up]] pushes it, and where
its eyes are measured from. A full turn is 1256: 0 faces the right of the screen,
314 faces up, 628 faces left and 942 faces down. The engine publishes it after
applying the turns from [[.aimsx]], [[.aimdx]] and [[.setaim]]; writing to it
does not turn the bot.

If the bot turns for other reasons (a tie twisting it, Brownian motion) the value
can drift a little outside the 0-1255 range.

<!-- sysvars.yaml meta.al_nacer (mem 19 sembrada, mem 18 no) -->
:::cuidado
In the first cycle of life `*.aim` is 0, even if the bot is pointing somewhere
else: the engine hasn't published it yet. At that moment the true heading is in
[[.setaim]], which the engine seeds at birth. A `*.aim 100 add .setaim store` in
the first cycle leaves the bot at 100, not 100 past where it was.
:::

<!-- sysvars.yaml .aim (lookoccurr -> 711) -->
Other bots see your heading in [[.refaim]] when they look at you. To turn around,
just add half a turn to the current heading:

```adn
' turns around when something touches it from behind
cond
*.hitdn 0 !=
start
*.aim 628 add .setaim store
stop
```

[[.setaim]] accepts any number and keeps its remainder after dividing by 1256,
so you don't need to correct the sum.
