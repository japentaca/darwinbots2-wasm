---
titulo: Ties
resumen: "The cells for tying to another bot, talking and passing resources through the tie, shaping it and, with stiffened ties, building multicellular organisms."
etiquetas: [ties, tie, multicellular, communication]
estado: revisada
---
A _tie_ is a spring between two bots. There are two ways to get one: at birth,
parent and child are joined by a tie that breaks by itself after 100 cycles; and
with [[.tie]], which ties the bot you are looking at. A tie made with `.tie`
stiffens after 19 cycles and from then on both bots are _multicellular_
([[.multi]]): they can share resources and fix the shape of the tie.

<!-- 34-TIES §0.4 (last = 100 nacimiento, −20 .tie → regang a los 19 ciclos), §3 (Multibot); port/core: TieHooke corre en los dos extremos, comprobado con probar-adn (los dos pasan a .multi 1 en el mismo ciclo) -->

Each tie has a number, its _tie port_, and each end knows it by a different number:
whoever creates it uses the value it put in `.tie`; the other one uses the
tie's sequence number among its own. [[.tiepres]] gives the tie port of the last tie
created and [[.numties]] how many you have. Almost all commands act on the tie
you choose with [[.tienum]] (or, if you leave it at 0, on the one in `.tiepres`).

<!-- 34-TIES §0.2 (puerto asimétrico), §2 (tabla de operaciones y gates) -->

The cells are grouped like this:

- **Tying and releasing:** [[.tie]], [[.deltie]], [[.numties]], [[.tiepres]],
  [[.multi]].
- **Writing and transferring through the tie:** [[.tienum]], [[.tieloc]],
  [[.tieval]]. With a positive `.tieloc` you write to the other one's memory;
  with `-1`, `-3`, `-4` or `-6` you give or take energy, venom, waste or body.
- **Measuring:** [[.tieang]] and [[.tielen]] (the tie in `.tiepres`), and
  [[.tieang1]] to `.tieang4` and [[.tielen1]] to `.tielen4` (the first four, in
  a multicellular).
- **Shaping** (stiffened ties only): [[.fixang]], [[.fixlen]], [[.stifftie]]
  and, when writing, `.tieang1`…`.tielen4`.
- **Sharing** (multicellulars only): [[.sharenrg]], [[.sharewaste]],
  [[.shareshell]], [[.shareslime]] and [[.sharechlr]].
- **Reading the other one:** [[.readtie]] chooses which tie the cells of
  [[sysvars/tref|what it feels through a tie]] come from.

The basic recipe for an organism: the child, as soon as it is born, ties itself
to the parent with `.tie`; twenty cycles later both are multicellular and the
child, which is the one that created the tie, splits the energy with `.sharenrg`.
That is the detail to watch: sharing only works from the bot that created the
tie. The full workings are in [[simulacion/lazos]].

<!-- 34-TIES §2 (sharing solo en ties no-back), §2.1; comprobado con probar-adn: con 90 .sharenrg en los dos, solo el del hijo mueve energía -->
