---
titulo: "Parameters: Energy and vegetables"
resumen: "How much energy enters the world from the sun, how many vegetables there are and how they are replenished, how what gets eaten is shared out, mutations and tides."
etiquetas: [energy, vegetables, repopulation, photosynthesis, shots, tides]
estado: revisada
---
<!-- engine/opciones.js grupo 'energia' (base:maxEnergy … base:mutations, opt:60-64); CONTROLES_BASICOS luz, vegetales, repoblacion, mutaciones; 50-MUNDO §2; 31-ENERGIA; 33-SHOTS §5 -->

This group regulates the world's economy: how much food comes in and how it
passes from hand to hand. Energy only enters from two places, the sun and the
seeding of new vegetables (see
[[simulacion/energia#flujo|where the energy comes from]]), and almost
everything here touches one of the two. The other parameters decide how much a
shot that steals energy yields, how what a chloroplast produces is split
between energy and body, whether children mutate, and whether there are tides.

If you want a richer or a poorer world, start with [[param:base:maxEnergy]]
and with the ones that decide how many vegetables there are and how they are
replenished. In Experiment's basic mode they appear as **Solar energy**,
**Vegetable cap**, **Vegetable repopulation** and **Mutations**. The complete
mechanics of the sun and the vegetables are in [[simulacion/cloroplastos]].

:::parametro base:maxEnergy
<!-- 50-MUNDO §2.2; core master.hpp feedvegs(sim, MaxEnergy), vegs.hpp tok = totnrg/3,5; comprobado: planta.txt (16000 cloroplastos, campo 32000²): +3,39 de energía y +1,02 de cuerpo por ciclo con 10; revisor: idem con 16000 .mkchlr, 63=0,75 -->
The basis of photosynthesis: every bot with chloroplasts gains, in each
sunlit cycle, an amount proportional to this value (the formula is in
[[simulacion/cloroplastos#fotosintesis|photosynthesis]]). The app starts at 10
and the **F1 league** base uses 40.

With 10, a vegetable with 16000 chloroplasts, alone in a 32000 × 32000 field,
gains about 3.4 energy and 1 body per cycle. With 20 it gains double; with 0
the sun feeds nobody, and the only food that comes in is from repopulation. In
pond mode ([[param:opt:30]]) this value isn't used: [[param:opt:31]] rules
there.
:::

:::parametro base:minVegs
<!-- 50-MUNDO §2.1; core master.hpp paso 20 (TotalChlr < MinVegs → VegsRepopulate), TotalChlr = suma de chloroplasts / 16000 de todos los vivos -->
The repopulation threshold. If the chloroplasts of the whole field, counted
in units of 16000, fall below this number, the simulation starts seeding new
vegetables. The app starts at 15; the **F1 league** uses 10. With 0 it never
repopulates: if the vegetables go extinct, they don't come back.

It counts chloroplasts, not bots: twenty vegetables of 4000 chloroplasts add
up to 5 units, and animals that bought chloroplasts count too. See
[[simulacion/cloroplastos#repoblacion|repopulation]].
:::

:::parametro base:maxPopulation
<!-- 31-ENERGIA §3; core robots.hpp ChangeChlr (TotalChlr > MaxPopulation y Veg), Reproduce (lotería RandomI(0,10) != 5 sobre el 90 %) -->
The vegetable cap, also in units of 16000 chloroplasts. When the field's total
goes over it, vegetables can't reproduce or buy chloroplasts; above 90% of
the cap, only one in eleven reproduction attempts goes ahead. It doesn't stop
animals. The app starts at 100; the **F1 league** uses 25.

Set it above [[param:base:minVegs]]: if it ends up below, the vegetables stop
reproducing before repopulation stops, and the population is held up by
seeding alone. See [[simulacion/cloroplastos#tope|the vegetable cap]].
:::

:::parametro base:repopAmount
<!-- core master.hpp VegsRepopulate (for t = 1 To RepopAmount: aggiungirob) -->
How many vegetables are born in each repopulation batch. Each one appears at a
random place within its species' zone, with 1000 body, the species' initial
energy and [[param:base:startChlr]] chloroplasts. The app starts at 10, like
the **F1 league**; with 0 repopulation seeds nothing.
:::

:::parametro base:repopCooldown
<!-- core master.hpp VegsRepopulate: cooldown += 1 solo mientras TotalChlr < MinVegs; siembra al llegar a RepopCooldown y resta (no vuelve a 0); sim.hpp cooldown (B7-4) -->
How many cycles below the threshold are needed for each batch. The wait only
advances in the cycles when the chloroplasts are below [[param:base:minVegs]],
and what has accumulated isn't lost when the population recovers: it keeps
counting the next time it drops. The app starts at 10; the **F1 league** uses
25. With 0 or 1 it seeds a batch every cycle while vegetables are missing,
which can fill the field very quickly.
:::

:::parametro base:startChlr
<!-- wasm dbcore_api db_sim_seed_species (fundadores vegetales) y core master.hpp aggiungirob (repoblados): chloroplasts = StartChlr; el core arranca en 0, la app manda 16000 -->
The chloroplasts each seeded vegetable is born with, both the simulation's
founders and those from repopulation. Children don't: they take their share of
the parent's ([[simulacion/reproduccion#reparto|how things are split at birth]]).
The app starts at 16000.

More chloroplasts isn't always better: with a lot, the vegetable weighs more,
blocks more light, and in a full field may yield less (the table is in
[[simulacion/cloroplastos#rinde|how much a vegetable yields]]). With 0 the
vegetables are born without chloroplasts and don't eat until their DNA buys
them with [[.mkchlr]]. Changing it live only affects those seeded afterwards.
:::

:::parametro base:mutations
<!-- 40-MUTACIONES §1 (DisableMutations global); wasm db_sim_set_mutations -->
The master switch for mutations. On (as the app starts), each bot mutates
according to its own table of rates, during life and at birth; off, nobody
mutates and children are exact copies of the parent (or the exact mix of the
two, in sexual reproduction). The **F1 league** turns it off, so that species
compete exactly as they were written. Which kinds of mutation exist and how
the rates are read is in [[simulacion/mutaciones]].
:::

:::parametro opt:60
<!-- 33-SHOTS §5; core shots.hpp releasenrg/releasebod (EnergyExType: power = value·nrg/(Range·40)·EnergyProp; si no, EnergyFix); comprobado: tirador.txt contra nada.txt, −198 por golpe proporcional, −180 fijo -->
How the strength of the shots that steal is calculated: the energy shot (−1)
and the body shot (−6). With **proportional**, the value in the app and in the
**F1 league**, the strength depends on the shooter's body, on its
[[.shootval]] and on how far the shot traveled, multiplied by
[[param:opt:62]]. With **fixed**, each hit lands with [[param:opt:61]],
regardless of any of that.

In a test with a shooter of 1000 body and a stationary target, each −1 took
198 energy from the target with the proportional exchange and 180 with the
fixed one of 200. The details of each shot type are in
[[simulacion/disparos#tipos|what each shot does]].
:::

:::parametro opt:61
<!-- core shots.hpp power = EnergyFix (Integer); comprobado: 61=500 → −450 de energía y −5 de cuerpo por golpe -->
The strength of each −1 or −6 shot when the exchange ([[param:opt:60]]) is
fixed; with the proportional one it isn't used. The app starts at 200. A −1
takes 90% of this value from the victim in energy and 1% in body, and gives
the shooter back a gift of the full value: with 500, the victim loses 450
energy and 5 body per hit.

Since it doesn't depend on the shooter's body, the fixed exchange puts small
bots and large ones on equal terms.
:::

:::parametro opt:62
<!-- core shots.hpp releasenrg/releasebod: × EnergyProp; comprobado: 62=2 → −396 por golpe (el doble de 198) -->
A multiplier on the strength of −1 and −6 shots when the exchange
([[param:opt:60]]) is proportional. With 1, the value in the app and in the
**F1 league**, shots hit as described in
[[simulacion/disparos#tipos|what each shot does]]; with 2, double (in the test
above, 396 energy per hit instead of 198); with 0, the shots that steal take
nothing. It raises or lowers, all at once, the advantage of hunting over that of
photosynthesizing.
:::

:::parametro opt:63
<!-- core vegs.hpp feedvegs (nrg += acttok·(1 − VFB); body += acttok·VFB/10) y feedveg2; comprobado con planta.txt: 0 → +13,6 de energía por ciclo; 1 → +1,36 de cuerpo por ciclo -->
What part of what the chloroplasts produce goes to the body; the rest goes to
energy. With 0.75, the app's value, a quarter of the gain goes into [[.nrg]]
and three quarters into [[.body]], at a rate of 10 energy per 1 body. The
**F1 league** uses 0.5.

In the lone-vegetable test, with 0 it gained 13.6 energy per cycle and no
body; with 1, no energy and 1.36 body. A vegetable that only fattens up can't
pay for its actions or reproduce, and one that doesn't fatten up doesn't grow
either. It applies equally to the waste that the chloroplasts digest (see
[[simulacion/energia#desechos|waste]]).
:::

:::parametro opt:64
<!-- core robots.hpp mareas (BouyancyScaling = sqrt((1 + sin(2π·fase/Tides))/2); Ygravity = (1 − B)·4; PhysBrown = 10 si B > 0,8), vegs.hpp (acttok·(1 − B)); 50-MUNDO §2 -->
The period of the tides, in cycles; with 0 (the app's value) there are no
tides. With a positive value, the world oscillates with that period: in one
part the downward gravity rises to 4 and the sun feeds at full strength; in
the other, gravity drops to almost nothing, the water churns with Brownian
motion and the vegetables barely eat.

While there are tides, the engine rewrites [[param:opt:20]] and
[[param:opt:13]] every cycle, so what you put in them isn't used; and if you
turn the tides off, they keep the last value the tide gave them. See
[[simulacion/mundo#gravedad|gravity, ponds and tides]].
:::
