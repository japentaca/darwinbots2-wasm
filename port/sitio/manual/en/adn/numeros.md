---
titulo: Numbers and addresses
resumen: "Which numbers you can write in the DNA, how memory is read with the asterisk, why a sysvar is just an address, and what happens with out-of-range values and addresses."
etiquetas: [numbers, addresses, memory, sysvar, range]
estado: revisada
---
In the DNA, everything is a number. A quantity, a memory address and the name
of a sysvar all end up as integers on the [[adn/pilas#entera|integer stack]].
This page covers which numbers you can write, how memory is read and written,
and what the engine does when a value or an address goes out of range.

## Literals {#literales}
<!-- 20-VM §0.4, §2.4 (val → Integer: fuera de rango, error 6 y el archivo no carga; decimales bancarios), §2.5, §6.3 (- niega) -->

A number written in the DNA is pushed as is: `50`, `-5`, `32000`.

- **Literal range: from −32768 to 32767.** A literal outside that range is
  neither rounded nor clipped: **the whole bot fails to load**. Along with a badly written [[adn/def]] line,
  it is the only thing in the DNA that gets the file rejected.
- **Negatives:** they are written with the sign attached, `-5`. You can also negate
  whatever is on top with [[op:-]] (`5 -` leaves −5) or subtract from zero
  (`0 7 sub` leaves −7).
- **Decimals:** they are rounded to the nearest integer and, on a tie, to the even one:
  `1.5` is 2 and `2.5` is also 2. There are no fractional numbers on the stack.

This literal makes the bot fail to load:

```adn sin-lint
cond
start
  40000 50 store
stop
```

If you need a big number, build it with operations: `200 200 mult` leaves
40000 on the stack with no problem.

:::cuidado
A word that is not a command, nor a number, nor a sysvar, nor a variable
from [[adn/def]] **doesn't cause an error: it is 0**. A typo like `.upp` instead
of [[.up]] turns into a silent 0. The [[app/editor]] flags it for you;
see also [[adn/errores]].
:::

## A sysvar is an address {#sysvar}
<!-- 20-VM §2.4 (SysvarTok), 21-MEMORIA §1-§2; sysvars.yaml 1 (up), 310 (nrg) -->

Each bot's memory has 1000 cells, numbered 1 to 1000. Some of them
have a name: those are the _sysvars_. [[.up]] is cell 1, [[.nrg]] is cell 310.
Writing `.up` in the DNA is exactly the same as writing `1`: it pushes the
**address**, not the contents.

That is why `10 .up store` works: it pushes 10, pushes 1, and [[op:store]] writes 10
to cell 1. And that is why this bot stores the number 310 in cell 51, the
address of the energy, and not the energy itself:

```adn
cond
start
  .nrg 51 store
stop
```

The cells without a name are free memory for whatever you like (see
[[adn/memoria]]). With [[adn/def]] you give them a name of your own. The full list
of sysvars is in the sysvar reference, for example [[.nrg]].

## Reading memory: the asterisk {#leer}
<!-- 20-VM §1 (tipo 1), §4, §6.1 (*); 21-MEMORIA §0.3 (latencia 1 ciclo); 10-CICLO §2 «Flujo de datos de los sentidos» -->

To push the **contents** of a cell, put an asterisk in front:

| You write | It pushes |
|---|---|
| `50` | the number 50 |
| `*50` | whatever is in cell 50 |
| `.nrg` | the number 310 |
| `*.nrg` | whatever is in cell 310: the bot's energy |

If you work out the address on the spot, use the separate [[op:*]] operator:
it pops an address from the top and pushes the contents of that cell. `50 *` is the
same as `*50`, but it also works for `*.nrg 10 div *`, where the address
comes out of a calculation.

This bot copies whatever is in cell 50 to cell 60:

```adn
cond
start
  *50 60 store
stop
```

:::nota
What the engine writes for the bot (energy, senses, what the eyes see)
is published after the DNA runs, so the DNA always reads the value
from the previous cycle. A freshly seeded bot reads `*.nrg` as 0 during its first
cycle. See [[adn/ejecucion#retraso]] and [[simulacion/ciclo]].
:::

## Addresses outside 1 to 1000 {#fuera}
<!-- 20-VM §0.6, §4 (tipo 1), §6.1 (*), §7 (Abs Mod 1000, 0 → 1000) -->

From the DNA there is no way to read or write outside the 1000 cells. Every
address, whether reading or writing, goes through the same rule:

1. Take the absolute value (the sign is ignored).
2. Take the remainder of dividing by 1000.
3. If the remainder is 0, the cell is 1000.

| Address requested | Cell used |
|---|---|
| 50 | 50 |
| 1050 | 50 |
| −51 | 51 |
| 2052 | 52 |
| 1000, 2000 | 1000 |
| 0 when reading (`*0`, `0 *`) | 1000 |
| 0 when writing | none (see below) |

This bot writes 7, 8 and 9 to cells 50, 51 and 52 even though the addresses
look like something else:

```adn
cond
start
  7 1050 store
  8 -51 store
  9 2052 store
stop
```

The Bestiary bot “Alga_Pair 1.1.1” takes advantage of the rule: it defines variables
such as `ninjaShoot` at 1007 or `ninjaUp` at 1001, which in memory are
[[.shoot]] (7) and [[.up]] (1) under another name. This bot moves even though it never
writes `.up`:

```adn
def ninjaup 1001

cond
start
  10 .ninjaup store
stop
```

### Writing to address 0 {#cero}
<!-- 20-VM §7 (dirección 0: no-op sin costo; store/addstore/substore/multstore no sacan el valor) -->

A store whose address is exactly 0 **writes nothing and costs no
energy**. With [[op:store]], [[op:addstore]], [[op:substore]] and
[[op:multstore]], moreover, the value **stays on the stack** unconsumed. Here the
store to 0 does nothing, the 7 stays on the stack and the second store puts it in
cell 58:

```adn
cond
start
  7 0 store
  58 store
stop
```

The same happens if the 0 comes out of a calculation (`5 5 sub store`). The details of
each store are in [[adn/stores]].

## Arithmetic and clipping to ±32000 {#recorte}
<!-- 20-VM §0.5, §6.1 (add/sub envuelven, mult satura en ±2·10⁹), §7 (mod32000 y excepciones) -->

Memory holds values from −32000 to 32000, but **the integer stack doesn't**: there
numbers can grow to about two billion. [[op:mult]] saturates at
that limit and [[op:add]] and [[op:sub]] wrap around, but in practice you won't
get there. A large intermediate result is no problem as long as you shrink it
before storing it: `300 300 mult 300 div` gives 300, even though in the middle the stack
held 90000.

The clipping happens **when you write**. A store doesn't saturate: it keeps the **remainder
of dividing by 32000**, preserving the sign. The only exception is exact
multiples of 32000, which end up as 32000 (or −32000). That way a store
never writes 0 unless the value is 0.

| Value on the stack | Ends up in memory as |
|---|---|
| 32000 | 32000 |
| 32500 | 500 |
| 32767 | 767 |
| 60000 (`30000 30000 add`) | 28000 |
| 64000 | 32000 |
| 90000 (`300 300 mult`) | 26000 |
| −40000 | −8000 |

This bot stores 28000, not 32000:

```adn
cond
start
  30000 30000 add 50 store
stop
```

The same clipping applies to [[op:inc]] and [[op:dec]]: a counter at 32000 that
goes up by one becomes **1**, not −32000; one at −32000 that goes down becomes −1. If
you are counting something that can grow a lot, check it before it
reaches the cap.

Some stores (such as [[op:divstore]] or [[op:sqrstore]]) don't apply the clipping
because their result already falls within range; they are covered in [[adn/stores]].

## Negative numbers {#negativos}
<!-- 20-VM §6.1 (mod, div), §7; 21-MEMORIA §5 (timer de fundadores Random(-32000,32000)) -->

Negatives are ordinary citizens of the DNA, with a couple of details:

- **As a value**, they are stored with their sign: `-5 50 store` leaves −5.
- **As an address**, the sign is ignored: `-50` is cell 50.
- [[op:mod]] keeps the sign of the dividend: `-7 3 mod` gives −1 and `7 -3 mod` gives 1.
- [[op:div]] doesn't truncate, it rounds to the nearest and, on a tie, to the even one:
  `7 2 div` gives 4 and `5 2 div` gives 2. Dividing by 0 gives 0.

Several sysvars accept negatives: the [[.timer]] of a founder bot, for
example, starts at a random value between −32000 and 32000. The range of each one is in its entry in the reference, and the arithmetic
operators one by one are in [[adn/operadores]].

## Summary {#resumen}

| What | Rule |
|---|---|
| Literal | from −32768 to 32767; outside that the bot doesn't load |
| Decimal | rounds to the nearest integer, to the even one on a tie |
| Unknown word | is 0 |
| `.sysvar` | its address (a number from 1 to 1000) |
| `*n`, `*.sysvar`, `n *` | the contents of the cell |
| Address out of range | absolute value, remainder of dividing by 1000, 0 → 1000 |
| Store to address 0 | does nothing |
| Values on the stack | up to about ±2 billion |
| Value when storing | remainder of dividing by 32000, with sign; exact multiples → ±32000 |

<!-- Resumen: 21-MEMORIA §0, §2; 20-VM §0.6, §2.4, §4, §6.1, §7 -->
