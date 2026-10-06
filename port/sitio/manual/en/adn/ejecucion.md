---
titulo: Execution and costs
resumen: "When the DNA runs within the cycle, in what order, what it sees of the senses, and how much energy each instruction costs."
etiquetas: [execution, costs, energy, cycle, store]
estado: revisada
---
A bot's DNA isn't a program that starts once and keeps running: it's a recipe that the world reads again in full, from top to bottom, every cycle. This page covers when in the cycle that happens, what the bot sees when it reads its senses, in what order the genes run, and how much energy each instruction costs.

## The DNA runs at the start of the cycle {#cuando}
<!-- 10-CICLO §2 (pasos 1-9 antes; 10 ExecRobs; 12-16 después) y «Flujo de datos de los sentidos», §3 (cadáveres excluidos; recién nacidos corren en N+1) -->

Every simulation cycle (you can see it in full in [[simulacion/ciclo]]) begins, after some general bookkeeping, with the _DNA phase_: the engine goes through the living bots one by one and runs each one's DNA. Only once they've all finished do the shots move, the forces get applied, the positions get integrated, the eyes look and the actions get resolved (shooting, reproducing, making a shell…).

That has two consequences worth keeping in mind at all times:

- **What you read comes from the previous cycle.** The eyes, contact, velocity, energy and the other senses are written during the physical part of cycle _N−1_; the DNA in cycle _N_ reads those values.
- **What you write is applied later.** A `10 .up store` leaves the 10 in memory right away, but the thrust is applied later, in the physical part of the same cycle. You'll only see its effect on the senses in the next cycle.

Corpses don't run DNA. A bot born during cycle _N_ runs its DNA for the first time in cycle _N+1_.

## A one-cycle delay, verified {#retraso}
<!-- 21-MEMORIA §0.3 (latencia 1 ciclo); 10-CICLO §2; comprobado en el port (tabla de .vel; bot sembrado lee .nrg 0 en su primer ciclo) -->

This bot pushes forward with [[.up]] and, before that, records at position 52 the velocity it reads from [[.vel]]:

```adn
' Pushes forward and records the velocity it reads
cond
start
  *.vel 52 store
  10 .up store
stop
end
```

Running it, position 52 is always one step behind the real velocity:

| Cycle | `.vel` at the end of the cycle | What the DNA recorded in 52 |
|---|---|---|
| 1 | 7 | 0 |
| 2 | 13 | 7 |
| 3 | 20 | 13 |
| 4 | 26 | 20 |

In cycle 1 the bot has already pushed, but when its DNA read `.vel` the thrust hadn't been applied yet. The same goes for [[.nrg]]: the bot sees the energy it ended the previous cycle with, not what it has left while its own DNA spends it. A bot freshly seeded into the world also reads its senses as 0 during its first cycle, because it hasn't been through any physical part yet.

:::nota
This one-cycle delay isn't a flaw of the port: it's the one in DarwinBots 2.48.32, and the Bestiary bots are written (and evolved) counting on it.
:::

## All the DNA, every cycle, in order {#orden}
<!-- 20-VM §4 (bucle hasta end, sin saltos; CLEAR token a token; stacks limpiados por bot); 10-CICLO §3 (stores inmediatos; sin estado compartido salvo RNG) -->

Every cycle the interpreter starts at the first instruction and advances to the final `end` (or to the end of the file). There are no jumps or loops: genes don't call each other and nothing goes back. Each instruction is looked at at most once per cycle, and the genes are traversed in the order they're written.

A gene whose condition is false isn't _skipped_ in one go: the interpreter keeps passing over its instructions, but ignores them one by one until the next marker (`cond`, `start`, `else` or `stop`). The details of those markers are in [[adn/genes]].

The stacks ([[adn/pilas]]) are emptied when each bot's DNA starts: nothing stays on them from one cycle to the next, or passes from one bot to another. What does persist is memory, and stores write to it **at that moment** ([[adn/stores]]). That's why a gene sees what an earlier gene wrote in the same cycle, but not what a later one is going to write:

```adn
' Gene 1 counts; gene 2 copies the counter
cond
start
  *50 1 add 50 store
stop

cond
start
  *50 51 store
stop
end
```

With this order, at the end of every cycle 50 and 51 hold the same value (1 and 1, 2 and 2, 3 and 3…). If you swap the two genes, the copy reads the old value and 51 is always one behind 50 (1 and 0, 2 and 1, 3 and 2…).

A bot's DNA touches only its own memory and its own energy; it doesn't read or write anything of other bots during this phase. That's why the order _between_ bots doesn't change what each DNA computes. (The only shared thing is the random number generator: if you use [[op:rnd]], the number you get depends on how many bots used it before you.)

## What each instruction costs {#costos}
<!-- 20-VM §1 (tabla de tipos y costos; × COSTMULTIPLIER; resta sin piso), §7 (fracciones por store; store solo si escribe); constants.yaml costes_indices -->

Every instruction that runs deducts energy from the bot at that moment, according to its class. The prices are scenario parameters (the [[app/parametros-costos]] page) and all of them are multiplied by the [[param:cost:54]]:

| Class | Examples | Parameter |
|---|---|---|
| Number | `10`, `.up` (as an address) | [[param:cost:0]] |
| Memory read | `*.eye5`, `*50` | [[param:cost:1]] |
| Basic operator | [[op:add]], [[op:dup]], [[op:rnd]] | [[param:cost:2]] |
| Advanced operator | [[op:angle]], [[op:dist]], [[op:sqr]] | [[param:cost:3]] |
| Bitwise operator | [[op:&]], [[op:<<]] | [[param:cost:4]] |
| Condition | [[op:>]], [[op:=]], [[op:%=]] | [[param:cost:5]] |
| Logical | [[op:and]], [[op:not]], [[op:dropbool]] | [[param:cost:6]] |
| Store | [[op:store]], [[op:inc]]… | [[param:cost:7]] (see below) |
| Gene marker | `cond`, `start`, `else`, `stop` | [[param:cost:9]] |

Some finer rules:

- **What's ignored isn't charged.** Inside a switched-off gene, numbers, reads, operators and stores cost nothing. What is always charged is the condition section (which has to be evaluated to know whether the gene runs) and the `cond`, `start`, `else` and `stop` markers, which run even when the gene is switched off.
- **A store that doesn't write costs nothing.** If an inline condition left a _false_ on top of the boolean stack ([[adn/condiciones]]), the store doesn't run and isn't charged. A store to address 0 doesn't do anything or cost anything either.
- **Not all stores cost the same.** [[op:store]] pays the full price; [[op:inc]] and [[op:dec]], a tenth; [[op:addstore]], [[op:substore]], [[op:multstore]], [[op:divstore]], [[op:ceilstore]] and [[op:floorstore]], a fifth; [[op:rndstore]], [[op:sgnstore]] and [[op:sqrstore]], a seventh; [[op:absstore]] and [[op:negstore]], an eighth.
- **Free:** [[op:debugint]] and [[op:debugbool]], which are only for looking.
- **No floor.** The interpreter subtracts without checking the balance: energy can go negative during the DNA phase. Death from lack of energy is decided later in the cycle ([[simulacion/muerte]]).

### An example with numbers {#ejemplo-costos}
<!-- comprobado en el port con costos 0, 5, 7 y 9 en 1 y multiplicador 1: −6 y −12 por ciclo -->

```adn
' A gene whose condition is false
cond
  0 1 =
start
  1 50 store
  2 51 store
stop
end
```

With number, condition, store and markers at 1 each, this bot loses 6 energy per cycle: 2 numbers and a condition in the `cond` part, plus the three markers. The body isn't charged. If you change `0 1 =` to `1 1 =`, the body runs and the spend goes up to 12: 4 numbers and 2 stores get added.

## Long DNA costs even when it doesn't run {#adn-largo}
<!-- 31-ENERGIA §1 (mantenimiento (DnaLen−1)·DNACYCCOST); constants.yaml repro_tax (DnaLen·DNACOPYCOST); 20-VM §2.6 (DnaLen cuenta el end) -->

On top of what each instruction that runs charges, each cycle's upkeep charges for the _length_ of the DNA, whether it runs or not. The price is the [[param:cost:24]] parameter, and it's paid once for each instruction in the genome, not counting the final `end`. A bot like `cond start 1 50 store 2 51 store stop end` has 9 instructions plus the `end`: with that cost at 1 it loses 9 per cycle, and it would lose the same with all its genes switched off. You can look up the length of your own DNA in [[.dnalen]], which also counts the `end` (for that bot it's 10).

Length weighs in again at reproduction: the parent pays the [[param:cost:25]] cost once for each instruction in the genome (this time counting the `end`) when copying it for the child ([[simulacion/reproduccion]]). With these two costs switched on, every spare instruction is energy the bot isn't using for anything else.

## Is there an instruction limit? {#limite}
<!-- 20-VM §4 (a <= 32000), §0.1 -->

There's no cap on energy or on time: a bot runs all its DNA every cycle even if it runs out of energy along the way. The only limit is one of position: the interpreter looks at no more than the first 32000 instructions of the genome, and whatever lies beyond never runs. Since there are no loops, no DNA can hang the simulation.

## Which values are used {#valores}
<!-- constants.yaml preset_f1 (COSTSTORE 0.04, CONDCOST 0.004, resto de la VM 0); 10-CICLO §2 paso 7 (costos dinámicos) -->

Costs depend on the scenario. The F1 rules, the ones for competitions (in Experiment you apply them with "F1 settings"), charge 0.04 per store and 0.004 per condition and leave the other DNA costs at 0, including the length one. With those rules, ten stores per cycle cost a bot 0.4 energy per cycle; the genome length, nothing.

The [[param:cost:54]] can move on its own if you turn on [[param:cost:56]] ([[app/parametros-costos-dinamicos]]): the engine raises or lowers it to bring the population to a target, and all the prices on this page change with it. How all this fits with the rest of the bot's expenses is in [[simulacion/energia]].
