---
titulo: "Parameters: Death and decay"
resumen: "What is left of a bot that dies and how it rots, whether energy gifts and waste wear off in flight, and how much waste it takes for a bot to get poisoned."
etiquetas: [death, corpse, decay, waste, shots]
estado: revisada
---
<!-- engine/opciones.js grupo 'muerte' (opt:50-56); CONTROLES_BASICOS 'cadaveres'; core robots.hpp ManageDeath, Decay, HandleWaste/altzheimer; shots.hpp updateshots (NoShotDecay/NoWShotDecay) -->

This group decides what happens to what is left over: dead bots, shots that
stay in flight and waste that piles up. There are three topics:

- **Corpses** (the first four): whether a bot that starves to death leaves its
  body behind as food, and whether that body rots. The mechanics are in
  [[simulacion/muerte]].
- **Shots that do not wear off** ([[param:opt:54]] and [[param:opt:55]]):
  whether energy gifts and waste shots lose strength in flight (see
  [[simulacion/disparos#alcance|how far a shot travels]]).
- **Poisoning** ([[param:opt:56]]): how much waste it takes for a bot to start
  losing its memory (see [[simulacion/energia#desechos|waste]]).

Together they control how much gets recycled. With corpses that do not rot, the
energy of the dead stays in the world until someone eats it; without corpses,
it is lost. In Experiment's basic mode, the first one appears as **Corpses**.

:::parametro opt:50
<!-- core robots.hpp ManageDeath (CorpseEnabled: nrg < 15 y age > 0 → Corpse; si no, nrg < 0,5 o body < 0,5 → Dead); muerte.md probado: alcancia.txt con y sin opt:50 -->
If it is on (as the app starts), a bot whose energy drops below 15 turns into a
corpse: it keeps its body, which others can eat with −6 shots or through a tie,
and it stops running its DNA. With it off, the bot holds on until its energy
drops below 0.5 and then disappears, leaving nothing. The **F1 league** turns
it off.

It only affects those that die of hunger or from a shock: those emptied by a
shot and those left without a body never leave a corpse. The full table is in
[[simulacion/muerte#causas|the causes of death]], and what a corpse is, in
[[simulacion/muerte#cadaveres|corpses]].
:::

:::parametro opt:51
<!-- core robots.hpp Decay (body -= Decay/10 cada Decaydelay ciclos, sin piso); comprobado: muere.txt (350 de energía) con 51=1000, 52=2 → 1040 de cuerpo, −100 cada dos ciclos, sale tras llegar a −60 -->
How much a corpse rots at each step: it loses **a tenth** of this value in body.
With 0, the app's value, corpses never rot and stay in the world until someone
eats them.

In one test, with 1000 and a step every 2 cycles, a corpse with 1040 body lost
100 every two cycles and disappeared after twenty-some cycles. Fast rotting clears the
field of corpses that block the light and get in the way; slow rotting feeds the
scavengers. See [[simulacion/muerte#descomposicion|decay]].
:::

:::parametro opt:52
<!-- core robots.hpp Decay (DecayTimer >= Decaydelay) -->
How many cycles pass between decay steps. The app starts with 100: with that,
even with [[param:opt:51]] other than 0, a corpse lasts a long time. With 1 it
rots every cycle. It only counts if [[param:opt:51]] is not 0.
:::

:::parametro opt:53
<!-- core robots.hpp Decay (DecayType 2 → newshot −4, 3 → newshot −2, valor min(Decay, body), rumbo al azar) -->
Whether the corpse releases something at each decay step, in a random
direction:

- **no shot** (the app's value): it only loses body.
- **waste shot**: it releases a waste shot (−4), which fouls whichever
  neighbor it hits.
- **energy shot**: it releases an energy gift (−2), a small ration for whoever
  passes nearby.

The shot goes out with the value of [[param:opt:51]], or with whatever body it
has left if that is less; since body is worth 10 energy, what it releases equals
what it loses. It only counts if [[param:opt:51]] is not 0. See
[[simulacion/disparos#tipos|what each shot does]].
:::

:::parametro opt:54
<!-- core shots.hpp updateshots (NoShotDecay && shottype −2: sin decaimiento de nrg ni envejecimiento) -->
Energy gifts (−2 shots) do not lose strength in flight or age: they fly with
their full value until they hit someone. That includes the energy that every −1
or −6 shot returns to the shooter: if it does not reach them, it keeps flying
and someone else can eat it. Off in the app and in the **F1 league**.

With this parameter on, no energy is lost in the air, but in a world with walls
the lost gifts bounce endlessly until someone crosses their path.
:::

:::parametro opt:55
<!-- core shots.hpp updateshots (NoWShotDecay && shottype −4) -->
The same for waste shots (−4): they do not lose strength or age, and they keep
flying until they hit someone. A bot that throws out its waste to clean itself
can no longer count on it vanishing: sooner or later it reaches someone else.
Off in the app and in the **F1 league**.
:::

:::parametro opt:56
<!-- core robots.hpp HandleWaste (0 → 400; > 0 y Pwaste + Waste > nivel → altzheimer: (exceso)/4 escrituras al azar en 1..1000 salvo mkchlr/rmchlr); comprobado: sucio.txt con cost 29=1, 54=1 → basura en la memoria desde 600 de desechos con 400, nada con 5000 -->
How much waste it takes for a bot to get poisoned. If [[.waste]] plus the
permanent waste ([[.pwaste]]) go over this value, every cycle the engine writes
random numbers to random memory addresses, once for every 4 units of excess.
Any address from 1 to 1000 can be hit, including commands such as [[.repro]] or
[[.shoot]]; only [[.mkchlr]] and [[.rmchlr]] are spared.

The app starts with 400 and the **F1 league** raises it to 10000. In one test, a
bot that made shell without throwing out its waste had clean memory with the
level at 5000 and memory full of garbage within a few cycles with 400. If you
set 0, the engine takes it as 400; a negative value turns poisoning off.
:::
