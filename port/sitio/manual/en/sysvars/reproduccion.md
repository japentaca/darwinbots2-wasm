---
titulo: Reproduction
resumen: "The orders for having children, alone or with a partner, and the sense that tells you the bot has been fertilized."
etiquetas: [reproduction, children, sexual, asexual]
estado: revisada
---
<!-- 36-REPRO §2 (reparto de nrg, body, chlr, waste y pwaste por per; tie de nacimiento) -->
A bot has children by writing a percentage: the share of its resources that it passes to the
child. `50 .repro store` splits it into two halves; `10 .repro store` has a
small child and keeps almost everything. The child takes that percentage of the energy, of the
body, of the chloroplasts and of the waste, and is born stuck to its parent, joined to it
by a birth tie.

There are three ways:

- [[.repro]]: asexual. The child is a copy of the parent, with the normal mutations.
- [[.mrepro]]: asexual, but the child mutates much more. Useful for exploring.
- [[.sexrepro]]: sexual. It requires being fertilized (as [[.fertilized]] tells you) by the
  sperm of another bot, and the child's DNA mixes the DNA of both.

<!-- 36-REPRO §0.4, §0.5, §2 (Mod 100, persistencia hasta el éxito, impuestos y DNACOPYCOST) -->
All three share three rules worth keeping in mind:

- **The percentage is taken modulo 100.** `100 .repro store` is 0 and never produces a
  child; `150` is equivalent to 50.
- **The order stays written until it works.** If the birth fails (there is no free spot
  in front of the bot, which is where the child appears, too little body, no energy), the engine does not clear it and it is retried automatically
  every cycle. To cancel it, write 0.
- **It has a cost.** A little energy is lost in the handover and, depending on the
  configuration, the birth also charges for the length of the DNA copied
  ([[param:cost:25]]).

<!-- 21-MEMORIA §5; 36-REPRO §2 (hereda timer y memoria genética); comprobado: el hijo lee .nrg en su primer ciclo y .body y .robage en 0 -->
The child is born with its memory at 0, except for the [[.timer]] and the genetic memory (see
[[adn/memoria#al-nacer]]). In its first cycle it already reads its [[.nrg]], but [[.body]] and
[[.robage]] give it 0. The whole process is in [[simulacion/reproduccion]].

An idea for using it: reproduce when you have energy to spare, with a percentage that leaves the
parent able to carry on.

```adn
' When it gathers energy, it has a child with a third
cond
 *.nrg 6000 >
 *.body 500 >
start
 33 .repro store
stop
```
