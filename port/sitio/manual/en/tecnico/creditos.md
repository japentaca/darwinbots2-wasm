---
titulo: Credits and license
resumen: "Who created DarwinBots, who kept it alive, who made this port, what licenses everything travels under, and where the Bestiary's bots come from."
etiquetas: [credits, license, history, bestiary, community]
estado: revisada
---
Every simulation you run on this site rests on more than twenty years of
other people's work. This page names those who did it and tells you what
license it travels under.

## The original and its community {#original}

DarwinBots was created by **Carlo Comis** in Italy, in 2002 and 2003.
The original program's _About_ screen still greets you in Italian:
_“Robottini genetici!”_, genetic robots.
<!-- README.md §Historia -->

From then on the project passed from hand to hand: **Purple Youko** and
**Numsgil** maintained it in 2004 and 2005; **Eric Lockard** (EricL)
took over after 2.42, in 2006 and 2007; after 2.44.01 it was carried on
by the members of the DarwinBots forum, and after 2.45.1, by
**Botsareus**, up to **2.48.32**, the version that runs here.
<!-- README.md §Historia (tabla de etapas); LICENSE.md -->

A community grew around the program. For years it documented the DNA
language and the system variables on the wiki, discussed strategies on
the forum, organized leagues and competitions (F1, F2, F3, multibots…)
and, above all, wrote bots. That community is the reason this port
exists.
<!-- README.md §El proyecto original y su comunidad -->

## This port {#el-port}

The port carries no signature of its own: the repository's README
presents it without names, as a _faithful reimplementation_ of 2.48.32,
and gives the credit where it belongs: “All the credit for the design,
the simulation and the bots is theirs; this repository only tries to
keep their work running on modern machines.” How it was made, step by
step, is in [[tecnico/como-esta-hecho]].
<!-- README.md (nota inicial) -->

It wasn't the first attempt to bring DarwinBots to new platforms: there
were others, such as DarwinbotsC or DarwinBots.Js; this repository
followed its own path.
<!-- README.md §Gracias -->

## The license {#licencia}

The original source is copyright 2003 by Carlo Comis, with modifications
by Purple Youko and Numsgil (2004–2005), Eric Lockard (2006–2007) and the
members of the DarwinBots forum.
<!-- LICENSE.md; README.md §Licencia -->

In plain words, the license (BSD-style, with a twist of its own) allows
you to use and redistribute the program, with or without changes, as
long as three conditions are met:
<!-- LICENSE.md -->

1. whoever distributes the source keeps the full copyright notice and
   license;
2. whoever distributes binaries includes that same notice and license in
   the documentation;
3. without the author's agreement, redistribution can only be
   **non-commercial** and not for profit.

And it gives no warranty at all: the program is provided “as is”.
<!-- LICENSE.md -->

The port and the specification are works derived from that source and
are distributed under the same license, including its non-commercial use
clause. The Bestiary's bots belong to their authors.
<!-- README.md §Licencia -->

## The Bestiary {#bestiario}

The 684 bots in the library were written by that community over the
years. None of them was written or modified for this port: the twelve
sub-forums of the forum's Bestiary (F1, F2, F3, Short, Multi-Bots,
Veggies…) were crawled, and from each topic we took the DNA published by
its author — the attachment when there was one, otherwise the most
complete code block in the first post. Only the invisible characters the
forum had introduced were normalized. Afterwards, bots from the rest of
the forum and from the wiki were added.
<!-- README.md §De dónde salen los bots de la demo (sub-foros y proceso); port/README.md §Bestiary (115 extra, 684 en total) -->

Each bot was validated with the ported engine itself, not with
heuristics: it is loaded, seeded and run for 50 cycles; one bot per topic
was kept and copies with identical DNA were removed. In the library each
one keeps the name its author published it under, and the index keeps
the link to the original forum topic, where the authorship and the
discussion are.
<!-- README.md §De dónde salen los bots de la demo -->

If any bot in the library is yours and you'd prefer it be removed or
credited in some other way, open an _issue_.
<!-- README.md §Gracias -->

## Thanks {#gracias}

To Carlo Comis for the idea and the original code; to Purple Youko,
Numsgil, EricL and Botsareus for keeping it alive; to those who wrote
the wiki, which documented the language and settled questions that the
source alone couldn't answer; and to every person who posted a bot on
the forum.
<!-- README.md §Gracias -->

## Where to go next {#seguir}

- The [DarwinBots wiki](http://wiki.darwinbots.com/): the documentation
  the community wrote.
- The [DarwinBots forum](http://forum.darwinbots.com/): the discussions,
  the leagues and the original Bestiary.
- The [original source on GitHub](https://github.com/darwinbots/Darwinbots2):
  the Visual Basic 6 of 2.48.32, as it was published.
  <!-- README.md §El proyecto original y su comunidad, §Historia -->
