---
titulo: Common mistakes
resumen: "The most common stumbles when programming a bot, with their symptom, their cause and how to fix them."
etiquetas: [errors, debugging, dna, tips]
estado: revisada
---
DNA almost never complains. The loader doesn't reject a bot for being badly
written: any word it doesn't understand becomes the number 0, and no
operation can break execution (dividing by zero gives 0, popping from an empty
stack gives 0). The consequence is that a mistake rarely looks like a mistake: it
looks like a bot that _does nothing_, or that does something else.

This page gathers the most common stumbles. For each one you'll find the
symptom, the cause, and a wrong and a right example. Some are caught by the
[[app/editor|DNA editor]], which warns you as you type; most aren't.

| Symptom | See |
|---|---|
| The bot doesn't move or do anything | [[adn/errores#nombre|misspelled name]], [[adn/errores#start-stop|start or stop]], [[adn/errores#direccion|.up and *.up]] |
| An action repeats every cycle, or gets forgotten | [[adn/errores#accion|action sysvars]] |
| A store “sometimes” doesn't write | [[adn/errores#booleana|conditions on the stack]] |
| A condition is never met | [[adn/errores#pila-vacia|empty stack]], [[adn/errores#direccion|.up and *.up]] |
| Odd numbers in memory | [[adn/errores#division|division by zero]], [[adn/errores#rango|out of range]] |
| The population kills itself | [[adn/errores#especie|shooting your own species]] |

## A misspelled sysvar {#nombre}
<!-- 20-VM §0.4, §2.4 (palabra desconocida = 0; privadas case-sensitive y resueltas al leer), §7 (store a 0 sin costo); lint de db_dna_lint -->

**Symptom:** the bot loads, but the action never happens.

**Cause:** a dotted name that is neither a sysvar nor a
[[adn/def|def]] variable is 0. A [[op:store]] to address 0 does nothing (and costs
nothing), so `30 .upp store` vanishes without a trace. The same
happens if you forget the dot: `up` without a dot isn't a name, it's a word that
is 0.

```adn sin-lint
cond
start
30 .upp store
30 up store
stop
```

The editor flags both: “Did you mean .up?” and “missing dot?”. Right:

```adn
cond
start
30 .up store
stop
```

Something similar happens with a variable of your own if you use it before its `def`: the
loader reads the file from top to bottom and at that moment the name doesn't
exist yet. Put the `def` lines at the top. Watch out for case too: sysvars
are recognized regardless of uppercase or lowercase, but `def`
names are not.

```adn sin-lint
cond
start
.contador inc
stop

def contador 50
```

```adn
def contador 50

cond
start
.contador inc
stop
```

The first one counts nothing; the second adds 1 per cycle at address 50.

## Forgetting the start or the stop {#start-stop}
<!-- 20-VM §1 (stores solo en body/ELSEBODY), §2.5 (sin validación estructural), §5.5 -->

**Symptom:** a gene doesn't run, or runs only when the
condition of _another_ gene is met.

**Cause:** the only thing that enables execution is a `start` (or an `else`). What
goes between `cond` and `start` are the conditions: a `store` there doesn't write. And what
comes after a `stop` and before the next `cond` or `start` never
runs. All of that loads without warnings. The complete rules are in
[[adn/genes]].

This bot wants to move forward, but it's missing the `start`, so it stays still:

```adn
cond
30 .up store
stop
```

This other one wants to move forward when it's more than 5 cycles old and always turn. Since the
second block is left after the `stop` without a `start` of its own, it never turns:

```adn
cond
*.robage 5 >
start
30 .up store
stop

' always turn
40 .aimdx store
```

If you delete the `stop` instead, the turn becomes part of the first gene and only
happens when [[.robage]] exceeds 5. The right thing is to give it its own gene. A
`start` with no `cond` in front always runs:

```adn
cond
*.robage 5 >
start
30 .up store
stop

' always turn
start
40 .aimdx store
stop
```

## Expecting an action sysvar to keep its value {#accion}
<!-- 21-MEMORIA §3 (régimen B: publicadas; régimen C: órdenes consumidas en el mismo ciclo) -->

**Symptom:** you want something to happen just once and it happens every cycle, or
you want to accumulate a value and it doesn't grow.

**Cause:** many sysvars are commands for the engine: [[.up]], [[.aimdx]],
[[.shoot]] and company. The engine applies them and sets them back to 0 in the same cycle,
so in the next cycle you read 0. Others, like [[.nrg]] or [[.aim]], are
rewritten by the engine every cycle with the real value: whatever you store there gets
lost. Neither kind works as memory. [[simulacion/ciclo]] has the
order in which each thing happens.

This bot wants to turn once, “while .aimdx is 0”. Since the engine sets it
back to 0 after each turn, it turns 100 units in _every_ cycle:

```adn
cond
*.aimdx 0 =
start
100 .aimdx store
stop
```

To remember something use free memory (for example address 50, see
[[adn/memoria]]). This one turns once and records that it already did:

```adn
cond
*50 0 =
start
100 .aimdx store
1 50 store
stop
```

## .up is not *.up {#direccion}
<!-- 20-VM §2.4 (.nombre = dirección), §1 (tipo 1 lee); sysvars.yaml 310; 21-MEMORIA §0.3 -->

**Symptom:** a condition that should be met never is (or always
is).

**Cause:** `.nrg` is the _address_ of the energy (310), not the energy. To
read what's at that address you have to put an asterisk: `*.nrg`. This bot
compares 310 with 1000, so it never moves forward, whatever energy it has:

```adn
cond
.nrg 1000 >
start
30 .up store
stop
```

Right:

```adn
cond
*.nrg 1000 >
start
30 .up store
stop
```

The rule is simple: with an asterisk to _read_ (`*.eye5`, `*.nrg`), without an
asterisk to say _where_ to write (`30 .up store`). More details in
[[adn/numeros]] and [[adn/stores]].

:::nota
What the engine writes for the bot arrives one cycle late: a freshly
seeded bot reads `*.nrg` as 0 during its first cycle. That's why the good example
starts moving in the second cycle (see [[adn/ejecucion#retraso]]).
:::

## The empty stack {#pila-vacia}
<!-- 20-VM §3 (pop vacío = 0; booleana vacía = verdadero; dup apila dos ceros), §6.4 -->

**Symptom:** a store writes 0, or a comparison always gives the same result.

**Cause:** popping a number from an empty [[adn/pilas|stack]] isn't an error: it gives 0.
If an operand is missing, the operation carries on with a 0 in its place. This bot
wanted to move forward, but the [[op:store]] has no value to write and writes 0
to `.up`:

```adn
cond
start
.up store
stop
```

The same happens in conditions. Here the number to compare against is missing,
so [[op:>]] compares `0 > age`, which is always false:

```adn
cond
*.robage >
start
30 .up store
stop
```

Right: `*.robage 0 >`. Two more quirks worth knowing: [[op:dup]] with an
empty stack pushes two zeros, and an empty _boolean_ stack counts as
true, which is why a `cond start` with no conditions always runs.

## Conditions that stay on the boolean stack {#booleana}
<!-- 20-VM §4 (tipo 7: CondStateIsTrue sin consumir), §6.6 -->

**Symptom:** inside a gene, a store that has no condition doesn't run.

**Cause:** a condition written inside the body (after the `start`) leaves
its result on the boolean stack, and that result governs _all_ the stores
that follow until the `stop`, not just the first one. Nothing removes it from there unless
you do it yourself. That's the idea behind [[adn/condiciones]].

This bot wants to shoot when it sees something and always move forward. Since the condition
from [[.eye5]] stays on the stack, with nothing in sight it doesn't move forward either:

```adn
cond
start
*.eye5 0 >
-1 .shoot store
30 .up store
stop
```

Two fixes: pop the result with [[op:dropbool]] after using it, or
put the unconditional part first.

```adn
cond
start
30 .up store
*.eye5 0 >
-1 .shoot store
stop
```

In the condition section (between `cond` and `start`) the opposite happens: everything
left on the stack is joined with “and”. If you want “or”, you have to write
[[op:or]].

## The else after the start {#else}
<!-- 20-VM §5.4 (original); core vm.hpp ExecuteFlowCommands (A2-1); README del port -->

In the original DarwinBots 2.48.32, an `else` that came after a `start`
never ran its body, whether or not the condition was met. The authors
documented it as “same as start but active if the condition is false”,
but the program didn't do that. This port fixes it: the `else` runs when the
gene's conditions are false.

```adn
cond
*.robage 30000 >
start
30 .up store
else
30 .dn store
stop
```

This bot goes backward (the condition is false and the `else` runs); in the original
it stayed still. If you load an old bot from the forum that uses `start … else`,
keep in mind that here it will behave differently than it did back then. More in
[[adn/genes]] and [[tecnico/diferencias]].

## Divisions by zero {#division}
<!-- 20-VM §6.1 (div y mod por 0 → 0; div bancario), §7 (divstore v=0 → 0) -->

**Symptom:** a calculation gives 0 for no apparent reason.

**Cause:** [[op:div]], [[op:mod]] and [[op:divstore]] with a divisor of 0 don't fail:
they give 0. If the divisor comes from memory (and memory starts at 0), the
result is 0 until someone writes there. Also, `div` doesn't truncate: it rounds
to the nearest integer and, on a tie, to the even one, so `7 2 div` gives 4 and
`5 2 div` gives 2.

If a 0 in the divisor means something else to you, check first:

```adn
cond
*51 0 !=
start
1000 *51 div 50 store
stop
```

## Out-of-range values {#rango}
<!-- 20-VM §2.4 (literal fuera de rango: no carga), §7 (mod32000; Abs Mod 1000) -->

**Symptom:** the bot doesn't load, or a stored value shows up changed.

**Cause:** there are three limits (all in [[adn/numeros]]):

- A number written in the DNA has to be between −32768 and 32767. Otherwise the
  whole bot fails to load.
- What a store writes to memory is adjusted to the ±32000 range by wrapping
  around: storing 40000 leaves 8000, and [[op:inc]] on 32000 leaves 1.
- Addresses wrap around every 1000: `30 1001 store` writes to
  address 1, which is `.up`, and the bot moves forward.

```adn sin-lint
cond
start
40000 50 store
stop
```

This one doesn't load. If you need the big number, compute it:
`20000 20000 add 50 store` loads, but leaves 8000 because of the ±32000 wraparound.
Also, each sysvar has its own useful range: it's on its page in
[[sysvars/todas|the reference]].

## Long DNA that burns energy {#adn-largo}
<!-- 20-VM §1, §4 (FLOWCOST siempre), §5.2 (AddupCond sin cortocircuito), §7; 31-ENERGIA §1 -->

**Symptom:** the bot loses energy even though it barely moves.

**Cause:** depending on how the world is configured, DNA costs. Every word
that runs has a cost according to its type, every store that writes charges its
own, and there can also be a per-cycle cost proportional to the length of the DNA and
another one when copying it as the bot reproduces. The costs and how they're configured
are in [[adn/ejecucion]].

What's worth knowing when writing:

- The conditions of a `cond` are evaluated _all_ of them, every cycle, even if the
  first one is already false: there's no shortcut.
- The body of a gene that doesn't run isn't charged, but `cond`, `start`, `else`
  and `stop` are always charged.
- A store only charges if it writes: the ones an inline condition blocks
  cost nothing.
- Dead genes (whose conditions are never met) keep paying for their conditions and the
  length. If you don't use them, delete them. [[.dnalen]] tells you how long your DNA is.

## Shooting your own species {#especie}
<!-- 33-SHOTS §0.2-0.3; core shots.hpp (inmunidad filial corregida B3-1, age <= 1); comprobado en el port: 4 bots, campo 1000x1000, 60 ciclos -->

**Symptom:** your own population shrinks on its own, especially if there are few
vegetables.

**Cause:** a shot doesn't tell species apart. A bot never hits itself with its
own shot, but it does hit any other bot that crosses its path, including its siblings
(a newborn is only protected from its parent's shots during its
first instants). A bot that shoots everything it sees ends up eating
its own. See [[simulacion/disparos]].

Wrong: it turns until it sees something and shoots it.

```adn
cond
*.eye5 0 =
start
50 .aimdx store
stop

cond
*.eye5 0 >
start
-1 .shoot store
stop
```

Right: compare [[.refeye]] with [[.myeye]], a signature that depends on the DNA and that
bots of the same species share. It's the trick of _Animal Minimalis_, by
Numsgil, one of the Bestiary bots:

```adn
cond
*.eye5 0 =
*.refeye *.myeye = or
start
50 .aimdx store
stop

cond
*.eye5 0 >
*.refeye *.myeye !=
start
-1 .shoot store
stop
```

In a test with four identical bots in a small world, with no food, the
first version lost two in 60 cycles; with the second all four were still there
with their energy intact. The step-by-step is in
[[tutoriales/reconoce-especie]].
