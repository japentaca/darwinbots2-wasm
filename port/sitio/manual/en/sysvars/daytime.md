---
titulo: .daytime
resumen: "It is 1 if it's daytime and 0 if it's night; for a bot with chloroplasts, 1 only if the sun is also shining on it."
etiquetas: [sun, day, night, sense, chloroplasts]
estado: revisada
---
<!-- sysvars.yaml .daytime (feedvegs paso 21); 10-CICLO §2 -->
`.daytime` says whether there was sun in the last cycle. If the simulation has no
day and night cycle, it is always day and the value is 1 (except in the first cycle of life, when
it is 0). With the cycle turned on, it alternates between 1 and 0 at the pace set by the
configuration, and the simulation can also turn the sun off or on depending on the
world's total energy.

For a bot with chloroplasts there is a nuance: the sun may light only a strip of the
world, and if the bot is outside it, it reads 0 even in daytime. For such a bot, `.daytime`
means "the sun is shining on me". One without chloroplasts sees 1 anywhere
as long as it is daytime. This is covered in [[simulacion/cloroplastos]].

The engine writes it at the end of the cycle, after everything else, so your DNA
reads what happened in the previous cycle.

A classic use is saving energy at night. _Anon Terifica daynight_, from the Bestiary, pins
itself in place when it gets dark and lets go at dawn (see [[.fixed]]):

```adn
cond
*.daytime 0 =
*.fixed 0 =
start
1 .fixpos store
stop
```

Don't confuse it with [[.sun]], which has nothing to do with light.
