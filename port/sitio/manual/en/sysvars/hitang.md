---
titulo: .hitang
resumen: "A sysvar that exists in name only: the engine never writes it, so it works as free memory."
etiquetas: [collision, free memory, oddity]
estado: revisada
---
<!-- sysvars.yaml .hitang (sentido free, in/out false) -->
By its name, `.hitang` should give the angle of a collision, but in DarwinBots
2.48.32 no engine system writes or clears it. The name is recognized when the
DNA is loaded and points to a memory cell like any other sysvar, and nothing
more.

In practice it is free memory with a name: it is 0 from the moment the bot is born,
and if you write something to it, it keeps it until you change it, like the
unnamed cells (see [[adn/memoria]]). Some Bestiary bots read it, for example
_EvoZerobot_, but what they read is that 0 or whatever they themselves saved.

To know which side a collision came from, the ones that work are [[.hitup]],
[[.hitdn]], [[.hitdx]] and [[.hitsx]]. And if what you are after is an angle,
the one of a received shot is in [[.shang]].

:::nota
Since mutations do not use it either to choose what to read or write, an
evolving bot rarely touches it on its own.
:::
