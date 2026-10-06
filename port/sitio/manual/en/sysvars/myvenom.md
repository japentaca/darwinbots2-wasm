---
titulo: .myvenom
resumen: "How many times the bot's own DNA writes to .strvenom, the command to make attack venom; unlike the other my* sysvars, it has no ref* partner."
etiquetas: [species, signature, venom]
estado: revisada
---
A counter taken from the bot's own DNA: how many writes to [[.strvenom]] there are in
the genome, that is, how many times its address (824) appears immediately followed
by a write word, as in `100 .strvenom store` or
`.strvenom inc`. Just as with
[[.myup]], it counts what is written, whether it runs or not.
<!-- sysvars.yaml .myvenom (stores a 824); makeoccurrlist -->

:::cuidado
Don't compare it with [[.refvenom]]. `.refvenom` is not the same count for the other
bot: it is how much attack venom it has stored. `.myvenom` has no partner
among the cells of [[sysvars/ref|what it sees]], so it's no use for
recognizing species by looking at another bot.
:::
<!-- sysvars.yaml .refvenom: mem(825) del visto -->

It is useful to the bot itself, though, for knowing whether its genome makes attack venom:

```adn
' if my DNA makes venom and I have none, make a little
cond
*.myvenom 0 >
*.venom 0 =
start
50 .strvenom store
stop
```

In this example the gene itself already makes `.myvenom` at least 1.

The engine computes it when the DNA changes (on load, at birth, through a virus or
a mutation; see [[sysvars/my#cuando]]), not every cycle. For the venom the bot has stored, look at
[[.venom]]. More about these counters in [[sysvars/my]].
