---
titulo: .delgene
resumen: "Deletes the gene with that number from the bot's own DNA; the classic use is a gene that deletes itself after running."
etiquetas: [genes, DNA, action]
estado: revisada
---
<!-- sysvars.yaml .delgene (BotDNAManipulation P3, =0 al consumir; blindada contra disparos de memoria y veneno); 35-VIRUS (delgene) -->
Write the number of a gene and the engine deletes the whole gene from the DNA in the same cycle,
from its `cond` to its `stop`. From the next cycle on that code no longer exists:
it doesn't run, it costs no upkeep and it isn't passed on to children. The command is cleared
when used, and a number that doesn't match any gene does nothing. The numbering is
the one in [[adn/genes#la-numeracion-de-los-genes]].

The best-known use is the single-use gene, which deletes itself with
[[.thisgene]]:

```adn
' Startup gene: runs once and disappears
cond
start
 0 .timer store
 *.thisgene .delgene store
stop
cond
start
 10 .up store
stop
```

<!-- comprobado: .genes pasa de 2 a 1 y .dnalen de 16 a 7 después del primer ciclo -->
This is the pattern of Bestiary bots like _Saber_ (abyaly, 2008). After the first
cycle [[.genes]] drops from 2 to 1 and [[.dnalen]] shrinks.

:::cuidado
When a gene is deleted, the ones after it shift down by one number. If you
stored gene numbers in memory (for [[.mkvirus]] or another `.delgene`), they no longer
point to the same thing.
:::

Remote attacks can't write to `.delgene`: memory shots
skip it and venom can't target it. But two routes remain: a virus whose
code does it, and a bot tied to you, which can write it through the tie with
`340 .tieloc` and the gene number in [[.tieval]] (see [[simulacion/lazos]]).
