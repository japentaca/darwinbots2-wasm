---
titulo: .mkvirus
resumen: "Copies the gene with that number into a virus and starts incubating it; it is fired later with .vshoot."
etiquetas: [virus, genes, action]
estado: revisada
---
<!-- 35-VIRUS §0.2, §0.3, §1 (gate Vtimer = 0, mkvirus no se consume hasta el disparo, gen inválido no fabrica) -->
Write the number of one of your genes (using the numbering in
[[adn/genes#la-numeracion-de-los-genes]]) and the engine copies it whole, from its
`cond` to its `stop`, into a virus that the bot keeps inside. The copy charges
energy according to the gene's length ([[param:cost:25]] per word) and starts the
incubation: [[.vtimer]] becomes twice the number of words in the gene and drops
by 1 per cycle. When it reaches 1, the virus waits for you to write [[.vshoot]].

Details:

- **One virus at a time.** While one is incubating or waiting, another write to
  `.mkvirus` makes nothing.
- **It is not cleared when making**, but when firing. Meanwhile the cell keeps the
  gene number.
- **A gene number that does not exist** makes nothing.
- **No chloroplasts.** If the bot has chloroplasts, the attempt does not make the
  virus and removes all the chloroplasts. Since the command is still written, the
  virus is made in the next cycle.

```adn
' Makes a virus out of its own first gene and fires it when it is ready
cond
 *.vtimer 0 =
start
 1 .mkvirus store
 10 .vshoot store
stop
```

<!-- comprobado: .vtimer se lee 23, 22… y el virus sale 23 ciclos después de fabricado; al ciclo siguiente el gen vuelve a fabricar otro -->
This gene has 12 words, so the incubation starts at 24. The virus goes out as soon
as the count reaches 1, 23 cycles after it was made, because `.vshoot` was left
written waiting for it. After that [[.vtimer]] goes back to 0 and the gene makes
another. The copied gene is precisely the one that makes viruses, so the victim
also starts making them. But note: in the victim, the inserted gene need not be
number 1, so what it copies depends on where it landed. The full cycle is in
[[sysvars/adn-y-virus]].
