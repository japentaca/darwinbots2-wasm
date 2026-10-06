---
titulo: DNA and viruses
resumen: "The sysvars that let a bot look at its own DNA, delete genes from it, and make and shoot viruses that inject a gene into other bots."
etiquetas: [DNA, genes, viruses, delgene]
estado: revisada
---
This group brings together two things that work on the DNA itself, not on memory.

<!-- sysvars.yaml .dnalen .genes .thisgene .delgene; 20-VM §5.6 -->
**Looking at your own DNA.** [[.dnalen]] tells you how many words the DNA has, [[.genes]]
how many genes, and [[.thisgene]] the number of the gene that is currently running. The
engine maintains all three, and they change when the DNA changes: through a mutation,
a virus that got in, or a deleted gene. Gene numbering is covered in
[[adn/genes#la-numeracion-de-los-genes]].

**Changing it.** [[.delgene]] deletes a gene from the bot's own DNA. The best-known
trick is a gene that deletes itself after running once, using [[.thisgene]].

<!-- 35-VIRUS §0.2-§0.3, §1, §2, §3 (fabricación, incubación 2·largo, disparo al azar, inserción, baba, cadáveres inmunes) -->
**Viruses.** A bot can copy one of its genes into a virus and shoot it. The full
cycle is:

1. You write the gene number to [[.mkvirus]]. The engine copies the gene (charging
   energy for its length) and starts incubating it.
2. [[.vtimer]] counts the incubation down: it lasts twice as many words as the gene
   has. When it reaches 1, the virus waits.
3. You write the shot strength to [[.vshoot]]. With the virus ready, it goes out in
   a random direction.
4. If it hits another bot, the gene is inserted between two of its genes, chosen at
   random, and from the next cycle on it runs like any other of its genes.

A gene that makes the victim also make and shoot viruses spreads like an epidemic.
Slime ([[.slime]]) stops weak viruses, and corpses don't get infected. A bot with
chloroplasts can't make viruses: if it tries, it loses its chloroplasts. The full
detail is in [[simulacion/virus]].

```adn
' Makes a virus from gene 3 and shoots it as soon as it's ready
cond
 *.vtimer 0 =
start
 3 .mkvirus store
stop
cond
 *.vtimer 1 =
start
 50 .vshoot store
stop
' Gene 3: what the victim will run
cond
start
 314 .aimdx store
stop
```
