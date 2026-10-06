---
titulo: "Parameters: Costs"
resumen: "How much energy the simulation charges a bot for running its DNA, moving, shooting, making defenses, having a body and growing old."
etiquetas: [costs, energy, parameters, F1, upkeep, age]
estado: revisada
---
<!-- opciones.js «Costos (CostsForm; índices de SimOptions.bas)»; core vm.hpp Costs::of (v[i] × v[COSTMULTIPLIER]); 31-ENERGIA §1 -->

This group sets the price of everything a bot does. All prices are paid in
energy ([[.nrg]]) and are the same for every bot in the world, vegetables
included. With the app's factory values they are all 0: living and acting is
free, and a bot only runs out of energy if it spends it on something (giving
it away, moving it to the body, making defenses) or if it is taken away.
Change them when you want evolution to reward thrifty bots, or when you set up
a world with tournament rules.

This page says what each parameter charges. The overall mechanism (in which
phase of the cycle each thing is charged, what happens if the energy goes
negative) is in [[simulacion/energia]], and the DNA side of it in
[[adn/ejecucion#costos]].

## How costs are charged {#como-se-cobra}
<!-- core: cada consumidor multiplica por Costs(54); Upkeep salta cadáveres (robots.hpp P1); vm.hpp resta sin piso -->

Each cost is charged as **price × [[param:cost:54]]**. The multiplier is 1 by
default and is the master knob: at 0 everything is free even if the prices
aren't, at 2 everything costs double. It lives in the
[[app/parametros-costos-dinamicos]] group because the engine can move it by
itself to steer the population toward a target.

There are three kinds of costs:

| Kind | When it is paid | Parameters |
|---|---|---|
| Per instruction | Every time the DNA executes one, in the DNA phase. | [[param:cost:0]] to [[param:cost:9]] |
| Per action | When the bot does something: push, turn, tie, shoot, make. | [[param:cost:8]], [[param:cost:20]] to [[param:cost:23]], [[param:cost:26]] to [[param:cost:29]] |
| Upkeep | Every cycle, even if the bot does nothing; also when reproducing. | [[param:cost:24]], [[param:cost:25]], [[param:cost:30]] to [[param:cost:33]], [[param:cost:51]], [[param:cost:60]] |

Charges don't look at the balance: the energy can go negative between one
phase and the next, and only in the actions phase is it decided whether the
bot died (see [[simulacion/energia#por-fase]]). Corpses don't pay upkeep.

A negative price, or a negative multiplier, turns the cost into a payment:
with the multiplier at −1 and the store at 1, each `store` _adds_ 1 energy to
the bot. The app accepts a negative price with an unusual-value warning; it
accepts a negative multiplier without any warning.

<!-- comprobado: cond start 1 50 store stop, cost 7=1: multiplicador 2 → −2/ciclo, 0 → 0, −1 → +1/ciclo -->

## Shortcuts: F1 and no costs {#atajos}
<!-- opciones.js CONTROLES_BASICOS 'costos', costosF1 (For t = 1 To 70 → 0, después F1_COSTOS), costosNinguno; BASES.f1; i18n/es/experimentar.json ajustesF1 -->

You don't need to enter the 26 values by hand. In **Experiment**, **Basic**
mode has a **Costs** control with three options: **F1** sets the league's
prices, **No costs** puts everything back to the factory values, and
**Custom** is what you see when the values match neither of the other two (for
example, because you changed one in **Advanced** mode). In advanced mode, the
**F1 settings** button and the scenario's **F1 league** base set the same
prices, along with the rest of the league's rules (see [[app/experimentar]]
and [[app/experimentar-avanzado]]).

The F1 prices are these; everything else in the group stays at 0 (and so does
the dynamic adjustment):

| Parameter | F1 |
|---|---|
| [[param:cost:5]] | 0.004 |
| [[param:cost:7]] | 0.04 |
| [[param:cost:8]] | 0.2 |
| [[param:cost:20]] | 0.05 |
| [[param:cost:22]] | 2 |
| [[param:cost:23]] | 2 |
| [[param:cost:26]] and [[param:cost:27]] | 0.01 |
| [[param:cost:28]] and [[param:cost:29]] | 0.1 |
| [[param:cost:30]] | 0.00001 |
| [[param:cost:31]] | 0.01, from almost the moment it is born |
| [[param:cost:54]] | 1 |

With those prices, shooting and tying are what's expensive; running the DNA and
having a body hardly cost anything. F1 copies the original, which set the
costs from 1 onward to 0: it doesn't touch [[param:cost:0]], so if you changed
it by hand, it stays as it was.

:::parametro cost:0
<!-- vm.hpp tok::NUMBER (fuera de CLEAR); 20-VM §1 -->
Charged for every number the DNA pushes onto the stack as it runs, such as
`10`, or `.up` when the sysvar has no asterisk (it is an address, that is, a
number). Inside a gene that is off, the numbers are not executed and cost
nothing. It is the cost that grows most with the length of the DNA that really
runs: a typical gene has more numbers than anything else. See
[[operadores/literales]].
:::

:::parametro cost:1
<!-- vm.hpp tok::DEREF -->
Charged for every memory read with an asterisk, such as `*.eye5` or `*50`. A
bot that checks many senses per cycle pays once per read, even if it reads the
same one twice. See [[operadores/lectura]].
:::

:::parametro cost:2
<!-- vm.hpp ExecuteBasicCommand: cobra siempre, casos 1-14 -->
Paid by every basic operator executed: arithmetic and stack handling, such as
[[op:add]], [[op:mult]], [[op:rnd]], [[op:dup]] or [[op:swap]]. The full list
is in [[operadores/basicos]].
:::

:::parametro cost:3
<!-- vm.hpp ExecuteAdvancedCommand: if (n < 13) cobra; debugint/debugbool exentos -->
Paid by every advanced operator: trigonometry and geometry, such as
[[op:angle]], [[op:dist]], [[op:sqr]] or [[op:pow]]. [[op:debugint]] and
[[op:debugbool]] belong to that family but never cost anything. See
[[operadores/avanzados]].
:::

:::parametro cost:4
<!-- vm.hpp ExecuteBitwiseCommand: cobra BTCMDCOST siempre -->
Paid by every bitwise operator, such as [[op:&]] or [[op:<<]]. See
[[operadores/bits]].
:::

:::parametro cost:5
<!-- vm.hpp CONDCOST; F1 0.004 -->
Charged for every comparison, such as [[op:>]], [[op:=]] or [[op:%=]]. Note:
a gene's conditions are always evaluated, because the engine has to know
whether the gene runs, so even genes that end up off pay this cost. With the
F1 rules it is 0.004. See [[operadores/comparaciones]].
:::

:::parametro cost:6
<!-- vm.hpp ExecuteLogic: cobra LOGICCOST siempre -->
Paid by every logic operator, the ones that combine or manipulate boolean
results: [[op:and]], [[op:or]], [[op:not]], [[op:dropbool]] and the others in
[[operadores/logicos]].
:::

:::parametro cost:7
<!-- vm.hpp: store entero; inc/dec /10; addstore… /5; rndstore, sgnstore, sqrstore /7; absstore, negstore /8; store que no corre o a dirección 0 no cobra (20-VM §7) -->
This is the price of [[op:store]], the instruction the bot acts with: almost
everything it does goes through a `store`. The variants pay a fraction:
[[op:inc]] and [[op:dec]] a tenth; [[op:addstore]] and its relatives, a fifth;
[[op:rndstore]], [[op:sgnstore]] and [[op:sqrstore]], a seventh;
[[op:absstore]] and [[op:negstore]], an eighth. A store that doesn't get to
write (because of a false inline condition, or because the address is 0) costs
nothing. With the F1 rules it is 0.04. See [[adn/ejecucion#costos]].
:::

:::parametro cost:8
<!-- robots.hpp ChangeChlr: (nuevos) × CHLRCOST × mult; cancela si newnrg < 100 o vegetal con TotalChlr > MaxPopulation; comprobado: 90 de energía y costo 0 → no compra; 10 a 0,2 → −2 -->
Charged for every chloroplast the bot buys with [[.mkchlr]]. The purchase is
canceled entirely if it would leave the bot with less than 100 energy, and
that rule applies even if the price is 0: a bot with 90 energy can't buy a
single one. Removing them with [[.rmchlr]] is free. With the F1 rules it is
0.2: 1000 chloroplasts cost 200 energy. See
[[simulacion/cloroplastos#tener]].
:::

:::parametro cost:9
<!-- vm.hpp ExecuteFlowCommands: cobra cond/start/else/stop siempre -->
Paid by the gene markers: `cond`, `start`, `else` and `stop`. They run even if
the gene is off, so a bot with many genes pays this cost for each one every
cycle. See [[operadores/flujo]].
:::

:::parametro cost:20
<!-- physics.hpp VoluntaryForces (|empuje recortado| × MOVECOST × mult, nunca más que nrg); gravedad en modo estanque × Bouyancy -->
This is the price of pushing with [[.up]], [[.dn]], [[.sx]] and [[.dx]], per
unit of thrust. It is charged on the thrust after it has been clipped by the
speed cap, so asking for more than the world allows doesn't cost more, and
the bot is never charged more energy than it has. In pond mode you also pay
to stay afloat. With the F1 rules it is 0.05. See
[[simulacion/fisica#empuje]].
:::

:::parametro cost:21
<!-- physics.hpp SetAimFunc: |Round((diff+diff2)/200, 3)| × TURNCOST × mult -->
This is the price of turning, per 200 units of turn (about 57 degrees): a
quarter turn costs 1.57 times the price and a full turn, 6.28. You pay the
same whether you turn with [[.aimsx]], [[.aimdx]] or [[.setaim]]. The F1
rules don't charge for turning. See [[simulacion/fisica#giro]].
:::

:::parametro cost:22
<!-- ties.hpp maketie: TIECOST × mult / (numties + 1) al final, con numties ya actualizado si el lazo salió; robots.hpp FireTies (solo con alguien a tiro) y Reproduce/sexual (maketie del lazo de nacimiento, lo paga el padre); revisor, probar-adn con 22=2: cada parto le cuesta 1 al padre; el hijo que se ata al padre paga 1 -->
Charged every time the bot tries to tie to another with [[.tie]] and there is
someone in range, whether or not the tie comes out. It is also charged at
every birth, for the birth tie: the parent pays it (in sexual reproduction,
the mother). The price is divided by the number of ties the bot has after the
attempt, plus one, so the first tie costs half the price, the second a third,
and so on; a failed attempt, with no ties, costs the full price. With the F1
rules it is 2: a child costs a parent that had no other ties 1 energy. See
[[simulacion/lazos#crear]].
:::

:::parametro cost:23
<!-- shots.hpp robshoot (tabla por tipo), defacate (/(numties+1)), vshoot; 33-SHOTS -->
This is the base price of a shot with [[.shoot]]. How much the shooter pays
depends on the type: feeding shots, venom and waste divide it by the number of
ties plus one, memory shots pay it in full, and a feeding shot with a large
[[.shootval]] multiplies it (the table is in
[[simulacion/disparos#crear]]). It is also paid, without the bot asking for
it, by the shot it uses to expel waste when too much builds up, and by a
virus shot ([[simulacion/virus#disparar]]). With the F1 rules it is 2.
:::

:::parametro cost:24
<!-- robots.hpp Upkeep: (DnaLen − 1) × DNACYCCOST × mult -->
An upkeep cost: every cycle, the bot pays this price for each instruction in
its genome (not counting the final `end`), whether or not it runs. It is what
punishes the junk DNA that accumulates with mutations. A DNA of 100
instructions plus the `end`, with the price at 0.01, costs 1 per cycle. See
[[adn/ejecucion#adn-largo]].
:::

:::parametro cost:25
<!-- robots.hpp Reproduce y la sexual: p.nrg −= DnaLen × DNACOPYCOST × mult, piso 0; virus: por palabra del gen -->
Charged when reproducing, for each instruction in the genome (this time
counting the `end`): it is the price of copying the DNA for the child. If the
parent can't afford it, it is left with 0 energy, but the child is born all
the same. It is also paid by whoever makes a virus, for each word of the gene
it copies. See [[simulacion/reproduccion#reparto]].
:::

:::parametro cost:26
<!-- robots.hpp storevenom: |Delta| × VENOMCOST × mult; el costo pasa a Waste -->
This is the transaction cost for each unit of venom the bot makes with
[[.mkvenom]], on top of the fixed conversion (1 energy per unit). What is paid
as this cost doesn't disappear: it becomes waste ([[.waste]]). With the F1
rules it is 0.01. See [[simulacion/defensas#fabricar]].
:::

:::parametro cost:27
<!-- robots.hpp storepoison -->
Same as the venom one, for the poison made with [[.mkpoison]] (the fixed
conversion is 1 energy per 4 units). The cost also becomes waste. With the F1
rules it is 0.01. See [[simulacion/defensas#fabricar]].
:::

:::parametro cost:28
<!-- robots.hpp makeslime: en multibot dividido por numties + 1, el Waste sube por el costo completo -->
The cost per unit of slime made with [[.mkslime]], on top of the fixed
conversion (1 energy per 10). It becomes waste. A bot tied to others in a
multicellular organism pays less: the cost is divided by the number of ties
plus one, although the waste is added in full. With the F1 rules it is 0.1.
:::

:::parametro cost:29
<!-- robots.hpp makeshell -->
The cost per unit of shell made with [[.mkshell]], with the same rules as
slime: a fixed conversion of 1 energy per 10, the cost becomes waste, and in a
multicellular organism it is divided by the ties plus one. With the F1 rules
it is 0.1. See [[simulacion/defensas#caparazon]].
:::

:::parametro cost:30
<!-- robots.hpp Upkeep: body × BODYUPKEEP × mult; comprobado en energia.md: 1000 de cuerpo a 0,001 → −1/ciclo -->
Body upkeep: every cycle, the bot pays this price for each point of
[[.body]]. It makes storing energy in the body cost something. At 0.001, a
bot with 1000 body loses 1 per cycle; with the F1 value (0.00001), a
hundredth of that. See [[simulacion/energia#mantenimiento]].
:::

:::parametro cost:31
<!-- robots.hpp Upkeep: ageDelta = age − round(AGECOSTSTART) > 0; constante, log o lineal -->
The age cost: what the bot pays per cycle once its age has passed
[[param:cost:32|the starting age]]. As it stands it is a fixed amount; with
[[param:cost:51]] or [[param:cost:60]] it grows with the years. It lets old
bots make room for their children without you having to program their death.
With the F1 rules it is 0.01 and the starting age stays at 0. See
[[simulacion/muerte#causas]].
:::

:::parametro cost:32
<!-- comprobado: 31=1, 32=5 → primer cobro con robage 7; revisor: 31=1, 32=0 → sin cobro en el ciclo 1, −1 desde el ciclo 2 (Upkeep: age − inicio > 0 y age > 0) -->
The age, in cycles, from which [[param:cost:31]] is charged: charging starts
when the age exceeds it. With 0 (the factory value) it is charged from the
second cycle of life, because in the first one the age is still 0. The
logarithmic and linear forms count cycles from this age, not from birth.
:::

:::parametro cost:33
<!-- robots.hpp: AGECOST + ageDelta × AGECOSTLINEARFRACTION; comprobado: 31=1, 60=1, 33=0,5 → 1,5; 2; 2,5… -->
The slope of the linear age cost: how much is added to [[param:cost:31]] for
each cycle lived after [[param:cost:32|the starting age]]. With the cost at 1
and the slope at 0.5, the bot pays 1.5 in its first cycle of old age, 2 in
the second, 2.5 in the third, and so on. It only counts if [[param:cost:60]]
is on.
:::

:::parametro cost:51
<!-- robots.hpp: AGECOST × ln(ageDelta), == 1 exacto; tiene prioridad sobre el lineal; comprobado: 31=10 → 6,93; 10,99; 13,86… -->
When on, the age cost is [[param:cost:31]] times the natural logarithm of the
cycles lived since [[param:cost:32|the starting age]]: it grows fast at first
and then more and more slowly. With the cost at 10, the bot pays 6.9 when it
is 2 cycles into old age, about 46 at 100 and about 69 at 1000. If you also
turn on [[param:cost:60]], this one wins.
:::

:::parametro cost:60
<!-- robots.hpp: else if AGECOSTMAKELINEAR == 1 -->
When on, the age cost grows in a straight line: [[param:cost:31]] plus
[[param:cost:33]] for each cycle lived since
[[param:cost:32|the starting age]]. In the long run it is harsher than the
logarithmic one, because it never flattens out. It has no effect if
[[param:cost:51]] is also on.
:::
