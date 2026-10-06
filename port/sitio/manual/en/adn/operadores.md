---
titulo: Operators by family
resumen: "An overview of the DNA operators grouped by family: what each one takes from and leaves on each stack, and the most common ones with an example."
etiquetas: [operators, stacks, arithmetic, conditions, logic, flow]
estado: revisada
---
<!-- 20-VM §6, §7, §5; opcodes.yaml -->

DNA is written in reverse Polish notation: the data comes first and then the
operator that uses it. `3 4 add` pushes a 3, pushes a 4, and `add` pops both
and leaves a 7. There are no parentheses and no precedence: the order of the
words is the order of the calculations.

Operators work on two stacks, the integer one and the boolean one (they are
explained in [[adn/pilas]]). Depending on which stack they touch and what they do, they are grouped into
families. Each family has its own page in the reference, with the complete
table of its operators and their cost:

| Family | Takes from | Leaves on | What for |
|---|---|---|---|
| [[operadores/basicos]] | integers | integers | arithmetic and stack handling |
| [[operadores/avanzados]] | integers | integers | angles, distances, roots, trigonometry |
| [[operadores/bits]] | integers | integers | working with the bits of a number |
| [[operadores/comparaciones]] | integers | boolean | asking questions (greater, equal, close…) |
| [[operadores/logicos]] | boolean | boolean | combining answers (and, or, not) |
| [[operadores/escritura]] | integers | memory | storing values and giving commands |
| [[operadores/flujo]] | — | — | marking where each gene starts and ends |

There are also bare numbers and memory reads such as `*.eye5`, which
only push a value: [[operadores/literales]] covers them and
[[adn/numeros]] explains them.

## How to read the descriptions {#como-leer-las-descripciones}
<!-- 20-VM §0.1, §3, §6 (convención a b), §1 (qué tipos corren con flow ≠ CLEAR; stores solo en body/ELSEBODY) -->

On this page the stack is written `a b`, with `b` on top of everything (the last
one to go in). So `a b sub` computes `a − b`: `10 3 sub` gives 7.

No operator ever fails. If the integer stack is empty, popping from it
gives 0; if the boolean one is empty, it counts as _true_. Each stack has
101 slots; if it fills up, the oldest value is lost without warning. A
misused operator doesn't break the bot: it does something, even if it isn't what you wanted.

The operators of the first five families run inside a gene, both
in the condition (after `cond`) and in the body (after `start` or
`else`). Outside a gene, for example before the first `cond`, they do nothing.
The writing ones, on the other hand, run only in the body.

## Basic {#basicos}
<!-- 20-VM §6.1; opcodes.yaml (básicos) -->

These are the arithmetic and the tools for arranging the stack. All of them pop their
operands from the integer stack and leave the result right there.

- Calculations: [[op:add]] (sum), [[op:sub]] (subtraction), [[op:mult]]
  (product), [[op:div]] (division), [[op:mod]] (remainder), [[op:abs]] (absolute
  value), [[op:sgn]] (sign: −1, 0 or 1) and [[op:rnd]] (a random number
  between 0 and the top value, both included).
- Stack handling: [[op:dup]] duplicates the top, [[op:drop]] throws it away,
  [[op:swap]] exchanges the top two, [[op:over]] copies the second one
  to the top (`a b → a b a`) and [[op:clear]] empties the stack.
- [[op:*]] reads memory at the address on top: `740 *` is the
  same as `*740`, but the address can be calculated.

A few oddities worth knowing, because that is how 2.48.32 behaved:

- `div` doesn't truncate: it rounds to the nearest integer and, on a tie, to the even one.
  `7 2 div` gives 4, `5 2 div` gives 2 and `100 7 div` gives 14. Dividing by zero gives 0.
- `mod` keeps the sign of the dividend: `-7 3 mod` gives −1 and `7 -3 mod` gives 1.
- `dup` on an empty stack pushes two zeros.

An example with [[op:rnd]] and [[op:mod]]: the bot changes heading at random every
20 cycles of life ([[.robage]]) and always moves forward. A full turn is 1256
angle units, so `1256 rnd` is any direction at all.

```adn
' Changes heading at random every 20 cycles and moves forward
cond
*.robage 20 mod 0 =
start
1256 rnd .setaim store
stop

cond
start
10 .up store
stop
```

## Advanced {#avanzados}
<!-- 20-VM §6.2; opcodes.yaml (avanzados); §1 (ADCMDCOST solo si value < 13: debugint/debugbool gratis) -->

More elaborate calculations, almost all of them meant for getting around the world:

- [[op:angle]] takes a point `x y` and gives the angle from the bot to that
  point, in the same units as [[.aim]] (0 to 1256). [[op:dist]] gives the
  distance to the point.
- [[op:anglecmp]] compares two angles and gives the signed difference, between
  −628 and 628: how far you need to turn, with the sign telling you which way.
- [[op:sin]] and [[op:cos]] take an angle in those units and return the
  sine or cosine multiplied by 32000: `314 sin` (a quarter turn)
  gives 32000.
- [[op:sqr]] (square root; 0 if the number isn't positive), [[op:pow]]
  (power: `2 10 pow` gives 1024; the exponent is limited to ±10),
  [[op:root]] (`27 3 root` gives 3), [[op:logx]] (logarithm in base `b`:
  `1000 10 logx` gives 3) and [[op:pyth]] (`3 4 pyth` gives 5, the hypotenuse).
- [[op:ceil]] sets a ceiling and [[op:floor]] a floor: `x 100 ceil` leaves `x`
  but never more than 100, and `x 0 floor` leaves it but never less than 0.
- [[op:debugint]] and [[op:debugbool]] leave a trace for debugging, which the
  `debug` command in the [[app/inspector]] console displays. They charge no
  energy and almost never change the stack (`debugbool` on an empty boolean
  stack pushes a _true_).

The Bestiary bot 4-d_Swarmer uses `angle` with [[.refxpos]] and [[.refypos]]
(the position of what it is looking at) to turn toward a vegetable:
`*.refxpos *.refypos angle .setaim store`. It looks just as good with a fixed point:
this bot aims at (3000, 2500) and moves toward it (if it doesn't brake,
it overshoots).

```adn
' Aims at the point (3000, 2500) and moves toward it
cond
start
3000 2500 angle .setaim store
10 .up store
stop
```

## Bitwise {#bit-a-bit}
<!-- 20-VM §6.3 -->

They treat the number as 32 bits. [[op:&]], [[op:|]] and [[op:^]] do the
bitwise _and_, _or_ and _exclusive or_ of the top two; [[op:~]]
inverts all the bits; [[op:<<]] and [[op:>>]] shift the bits one place
(multiplying or dividing by 2, and `>>` keeps the sign: `-5 >>` gives −3);
[[op:++]] and [[op:--]] add or subtract 1.

:::cuidado
The bare minus sign is an operator of this family: [[op:-]] changes the
sign of the top (`5 -` gives −5). It doesn't subtract. To subtract you use `sub`, and a negative
number is written with the sign attached: `-5`.
:::

They are useful for keeping several flags in a single cell. `*740 4 | 740 store`
turns on the bit with value 4 in cell 740, and `*740 4 &` gives 4 if it is on
or 0 if it isn't.

## Comparisons {#comparaciones}
<!-- 20-VM §6.4 (incluido %= y ~= con referencia negativa), §5.2 (AND implícito en start) -->

These are the questions of the DNA. Each one pops integers from the integer stack and
leaves _one_ result, true or false, on the boolean one. With `a b` on the stack:

| Operator | It is true if… |
|---|---|
| [[op:<]] · [[op:>]] | `a` is less than · greater than `b` |
| [[op:<=]] · [[op:>=]] | `a` is less than or equal to · greater than or equal to `b` |
| [[op:=]] · [[op:!=]] | `a` is equal to · different from `b` |
| [[op:%=]] · [[op:!%=]] | `b` is · is not within 10% of `a` |
| [[op:~=]] · [[op:!~=]] | with `a b d`: `b` is · is not within `d`% of `a` |

`100 105 %=` is true and `100 115 %=` is false; `100 115 20 ~=` is
true. An inherited oddity: if `a` is negative, `%=` and `~=` always give
false.

In a gene's condition you can put several comparisons in a row: on
reaching `start`, all of them are required to be true. This bot moves forward only
while it has more than 1000 energy ([[.nrg]]):

```adn
' Moves forward while it has more than 1000 energy
cond
*.nrg 1000 >
start
10 .up store
stop
```

A comparison can also go in the body, and then it decides whether the
writes that follow it are carried out; that is [[adn/condiciones]].

## Logic {#logicos}
<!-- 20-VM §6.5, §6.6 -->

They work only on the boolean stack. [[op:and]], [[op:or]] and [[op:xor]]
combine the top two results; [[op:not]] inverts the top;
[[op:true]] and [[op:false]] push a constant. And the boolean stack has its
own set of tools: [[op:dupbool]], [[op:dropbool]],
[[op:swapbool]], [[op:overbool]] and [[op:clearbool]].

Since `start` already joins all the conditions with an _and_, `or` is the one
you write most: without it there is no direct way to ask for “this or that”.

```adn
' Moves forward if cell 740 is 0 or cell 741 is 0
cond
*740 0 =
*741 0 =
or
start
10 .up store
stop
```

If an operand is missing, it counts as true (the empty boolean stack is
_true_). That is why `not` on the empty stack gives false, and a `cond start`
with no conditions always runs its body.

## Writing to memory {#escritura-en-memoria}
<!-- 20-VM §7 -->

These are the only ones that change anything outside the stacks: they write to the bot's
memory, and writing to certain addresses is giving a command (move,
shoot, reproduce). The most common is [[op:store]]: `10 .up store` stores
10 at the address of [[.up]] and the bot moves forward. There are variants that operate on
what is already in the cell: [[op:inc]] and [[op:dec]] add or subtract 1,
[[op:addstore]] adds a value, [[op:negstore]] changes its sign, and so on
up to fourteen.

They run only in a gene's body and only if the top of the boolean stack is
true (or it is empty). Address 0 writes nothing. All the details,
including how the written value is clipped, are in [[adn/stores]].

## Flow {#flujo}
<!-- 20-VM §1 (tipo 9 sin gate, FLOWCOST), §2.2 (end agregado), §5 -->

They don't calculate anything: they mark the structure. [[op:cond]] opens a gene and its
condition, [[op:start]] opens the body that runs if the condition came out
true, [[op:else]] the one that runs if it came out false, and [[op:stop]] closes the
gene. [[op:end]] ends the reading of the DNA; the loader adds it by itself at the
end, so you don't need to write it. How they combine is in
[[adn/genes]].

Unlike the rest, these markers always run, even in a
gene that is being skipped, and each one charges its cost.

## A Bestiary trick: calculations instead of conditions {#un-truco-del-bestiario-cuentas-en-lugar-de-condiciones}
<!-- 20-VM §6.1 (div por 0 → 0); Bestiario: Bardus_1S_Moonfisher.txt -->

Some authors write entire bots without conditions, using arithmetic. The
trick relies on the fact that dividing by zero gives 0: `x dup div` is 1 if `x` is not
zero and 0 if it is. And `x dup div 1 sub abs` is the other way around: 1 if `x` is zero.
Multiplying by that “turns on” or “turns off” a value. Bardus, by Moonfisher,
takes the idea to the extreme: the whole bot is a single `store` on one very
long line.

A small version: move forward 10 if the central eye ([[.eye5]]) sees nothing, and
stay still if it sees something.

```adn
' Moves forward only if the central eye sees nothing, no conditions
cond
start
*.eye5 dup div 1 sub abs 10 mult .up store
stop
```

It is harder to read than the `cond` version, so when you are starting out, stick with that one. What
each operator costs is covered in [[adn/ejecucion]].
