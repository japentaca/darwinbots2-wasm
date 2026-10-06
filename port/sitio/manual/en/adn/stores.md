---
titulo: Writing to memory
resumen: "How store, inc, dec and the rest of the family write to the bot's memory, what they take from the stack and when the engine acts on what you wrote."
etiquetas: [store, inc, dec, memory, sysvars, latency]
estado: revisada
---
A bot has no other way of acting than writing to its memory. Moving, turning,
shooting or reproducing are always the same thing: putting a number at an address that
the engine watches. The words that write are called _stores_, and this page explains
how they work, which addresses they accept and when the engine does something with what
was written.

Memory has 1000 cells, numbered 1 to 1000. The ones with names, such as
[[.up]] (cell 1) or [[.nrg]] (cell 310), are the _sysvars_; the rest is free memory
for your own variables (see [[adn/numeros]] and [[adn/memoria]]).

## store: value below, address on top {#store-valor-abajo-direccion-arriba}
<!-- 20-VM §7 (dirección del tope, valor debajo); sysvars.yaml 1 (up) -->

[[op:store]] pops two numbers from the [[adn/pilas|integer stack]]: first the
**address** (the top) and then the **value** (the one underneath). That is why
it is always written in this order:

```adn
' up: writes 50 to .up every cycle
cond
start
50 .up store
stop
```

Note that `.up` without an asterisk is just the number 1, the address. The asterisk reads
the cell: `*.up` pushes whatever _is_ at address 1. To write to a
sysvar you use its address, without an asterisk.

This bot pushes forward 50 units per cycle. If you run it, you will see that
it moves in the direction it is pointing, first accelerating and then at a
steady speed.

## inc and dec {#inc-y-dec}
<!-- 20-VM §7 (inc/dec: un operando, costo /10); 21-MEMORIA §2 (memoria libre persistente) -->

[[op:inc]] and [[op:dec]] pop **just one** number, the address, and add or subtract
1 from whatever is in that cell. They are the cheapest way to keep a counter:

```adn
' counts the cycles in cell 50
start
50 inc
stop
```

After the first cycle cell 50 is 1, after the second 2, and so on. Free
memory isn't cleared between cycles: what you store there stays until you
change it.

## The full family {#la-familia-completa}
<!-- 20-VM §7 (tabla de los 14 stores); §6.1 (div bancario) -->

Besides `store`, `inc` and `dec` there are eleven more stores. All of them take the address from the
top of the stack; the two-operand ones also take a value `v` from underneath. In the
table, `m` is what was in the cell before.

| Word | Pops from the stack | Leaves in the cell |
|---|---|---|
| [[op:store]] | `v` and address | `v` |
| [[op:inc]] / [[op:dec]] | address | `m + 1` / `m − 1` |
| [[op:addstore]] / [[op:substore]] | `v` and address | `m + v` / `m − v` |
| [[op:multstore]] | `v` and address | `m · v` |
| [[op:divstore]] | `v` and address | `m / v` rounded; 0 if `v` is 0 |
| [[op:ceilstore]] / [[op:floorstore]] | `v` and address | the smaller / the larger of `m` and `v` |
| [[op:rndstore]] | address | a random number between 0 and `m` (with the sign of `m`) |
| [[op:sgnstore]] | address | −1, 0 or 1 depending on the sign of `m` |
| [[op:absstore]] / [[op:negstore]] | address | `m` without its sign / `m` with its sign changed |
| [[op:sqrstore]] | address | the square root of `m`, rounded; 0 if `m` is not positive |

An example that chains several on the same cell:

```adn
start
10 50 store
5 50 addstore
3 50 multstore
4 50 divstore
2 50 substore
stop
```

Cell 50 goes through 10, 15, 45, 11 and ends at 9. Note the
[[op:divstore]] step: 45 / 4 is 11.25 and it ends up as 11. The division rounds to the nearest
integer (and on an exact tie, to the even one), it doesn't truncate.

Each store has its entry in [[operadores/escritura]], with the cost of each one.

## Which addresses can be written {#que-direcciones-se-pueden-escribir}
<!-- 20-VM §0.6, §7 (Abs Mod 1000, 0 → 1000; dirección 0 no-op sin costo; orden de los pops) -->

Any from 1 to 1000. There are no forbidden addresses and no errors: if the calculated
address falls outside that range, its sign is dropped and the remainder of dividing it
by 1000 is taken, so `-53` writes to 53 and `1050` to 50. A multiple of 1000
lands on 1000.

The exception is address **0**: a store to 0 does nothing and costs no energy.
Watch out for one detail: `store`, `addstore`, `substore` and `multstore`, when the
address is 0, don't even pop the value, which stays on the stack for whatever comes
next. `divstore`, `ceilstore` and `floorstore`, on the other hand, pop it anyway and it
is lost.

```adn
start
7 0 store
60 store
stop
```

The first `store` goes to address 0 and does nothing, but it leaves the 7 on the stack; the
second one finds it and cell 60 ends up holding 7.

## Which values get stored {#que-valores-se-guardan}
<!-- 20-VM §7 (mod32000 y sus excepciones), §2.4 (literal fuera de rango) -->

Each cell holds numbers between −32000 and 32000. Before writing, the value goes
through a circular clipping: the remainder of dividing it by 32000 is taken, preserving the
sign. So 32001 is stored as 1 and −32001 as −1. Exact multiples of 32000
don't become 0 but ±32000: `32000 2 mult 51 store` leaves 32000.

The stores that can't go out of range (`divstore`, `rndstore`,
`sgnstore`, `absstore`, `sqrstore` and `negstore`) write the result as is.

:::nota
A number written literally in the DNA has to be between −32768 and 32767. If you
put, for example, `40000`, the whole bot fails to load. To reach large values,
calculate them with operators.
:::

## Writing to sysvars that aren't yours {#escribir-sysvars-que-no-son-tuyas}
<!-- 21-MEMORIA §3 (regímenes A, B y C; configuración persistente) -->

You can write to any sysvar, including the ones the engine uses to tell you
things, such as [[.nrg]] or [[.robage]]. It doesn't cause an error, but it is no use: the engine
rewrites them every cycle after your DNA runs. This bot tries to give itself an
age of 123:

```adn
start
123 .robage store
stop
```

If you run it, `.robage` is 1, 2, 3… just like in any other bot: the age is
published by the engine and overwrites whatever you put there. The same goes for energy,
body, position, speed or the angle of [[.aim]].

In practice, each sysvar belongs to one of these classes (its entry in
[[sysvars/todas|the sysvar reference]] tells you which):

| Class | Examples | What happens to what you write |
|---|---|---|
| Commands | [[.up]], [[.aimdx]], [[.shoot]] | The engine applies them in this same cycle and sets them back to 0 |
| Senses | [[.eye5]], [[.edge]] | The engine rewrites them; your value is lost |
| Published data | [[.nrg]], [[.robage]] | The engine rewrites them every cycle; your value is lost |
| Configuration | [[.focuseye]], [[.out1]] | They stay as you left them: the engine reads them but doesn't clear them |
| Free memory | cell 50, cell 60 | Nobody touches them; they are yours |

## When the engine acts {#cuando-actua-el-motor}
<!-- 20-VM §0.2 (stores inmediatos); 10-CICLO §2 (paso 10 ADN, 12-16 motor); 21-MEMORIA §3 (excepciones: repro, strbody/fdbody, shootval) -->

Stores are immediate: the cell changes at the moment the word runs,
and whatever comes next in your DNA already sees the new value.

```adn
start
50 .up store
*.up 60 store
stop
```

Cell 60 ends up at 50, because `*.up` reads the command you just wrote. But if you
look at `.up` from outside, at the end of the cycle, it is 0: the engine has already used it to move
the bot and cleared it.

That is because each cycle has a fixed order (see [[simulacion/ciclo]]):
first the DNA of all the bots runs, and only afterwards does the engine move, shoot,
charge energy and update the senses. Three rules follow from that:

- **Commands are carried out in the same cycle.** What you write to `.up` or
  `.shoot` is applied before the next cycle starts, and the engine sets it back to
  0. That is why you have to write it again every cycle in which you want it.
- **Senses arrive one cycle late.** What you see in `.eye5` or in
  [[.robage]] was written by the engine at the end of the previous cycle. If you turn now,
  what you see after the turn you only read in the next cycle.
- **What belongs to nobody persists.** Free memory and configuration stay
  as you left them.

Some commands are not always cleared. [[.repro]] stays written until
reproduction succeeds, so it retries itself every cycle. [[.fdbody]] and
[[.strbody]] only act if they are positive: a negative value is cleared with no
effect (in the original DarwinBots it stayed there forever). And [[.shootval]] is only cleared when a shot is actually fired.

## Stores and conditions {#stores-y-condiciones}
<!-- 20-VM §1 (tipo 7: body/ELSEBODY y CondStateIsTrue), §4; core vm.hpp: el gate va antes de ExecuteStores -->

A store doesn't run every time it appears: it only runs inside a gene's body
(after `start` or `else`), and it also looks at the boolean stack. If on top of that stack
there is a _false_, the store is skipped, and in that case it pops nothing from the integer stack.
All of this is explained in [[adn/condiciones]].

<!-- 20-VM §7 (TieAngOverwrite/TieLenOverwrite solo en los de dos operandos), §12.6 -->

:::cuidado
An oddity inherited from DarwinBots 2.48.32: when you write to
[[.tieang1]]…`.tieang4` or [[.tielen1]]…`.tielen4` to set the angle or the length
of a tie, only the two-operand stores (`store`, `addstore`, `substore`,
`multstore`, `divstore`, `ceilstore` and `floorstore`) notify the tie system.
An `inc`, a `dec` or a `negstore` on those cells changes the number but the tie
doesn't find out. If you want to add 1, write `1 .tieang1 addstore`.
:::

## Costs {#costos}
<!-- 20-VM §1 (COSTSTORE solo si escribe), §7 (fracciones por store) -->

Every store that runs charges energy: `store` charges the full write
cost, and the rest a fraction (`inc` and `dec`, a tenth). A skipped store,
or one to address 0, charges nothing. The concrete numbers depend on the
simulation settings; you can see them in [[adn/ejecucion]].
