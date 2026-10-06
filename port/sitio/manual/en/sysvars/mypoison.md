---
titulo: .mypoison
resumen: "How many times the bot's own DNA writes to .strpoison, the command to make defensive poison; unlike the other my* sysvars, it has no ref* partner."
etiquetas: [species, signature, poison]
estado: revisada
---
A counter taken from the bot's own DNA: how many writes to [[.strpoison]] there are in
the genome, that is, how many times its address (826) appears immediately followed
by a write word, as in `100 .strpoison store` or
`.strpoison inc`. Just as with
[[.myup]], it counts what is written, whether it runs or not.
<!-- sysvars.yaml .mypoison (stores a 826); makeoccurrlist -->

:::cuidado
Don't compare it with [[.refpoison]]. Even though the names look alike, `.refpoison`
is not the same count for the other bot: it is how much poison it has stored at
that moment. `.mypoison` has no partner among the cells of
[[sysvars/ref|what it sees]], so it's no use for recognizing species by looking at
another bot.
:::
<!-- sysvars.yaml .refpoison: mem(827) del visto -->

It is useful to the bot itself, though, for knowing whether its genome makes poison, for example
in a gene written to be shared among variants:

```adn
' if my DNA doesn't make poison, run from what's coming head-on
cond
*.mypoison 0 =
*.eye5 1000 >
start
30 .dn store
stop
```

The engine computes it when the DNA changes (on load, at birth, through a virus or
a mutation; see [[sysvars/my#cuando]]), not every cycle. For the poison the bot has stored, look at
[[.poison]]. More about these counters in [[sysvars/my]].
