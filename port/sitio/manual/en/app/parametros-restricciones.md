---
titulo: "Parameters: Restrictions"
resumen: "Three prohibitions that apply to all bots: tying to another bot, reproducing alone and anchoring in place."
etiquetas: [restrictions, ties, reproduction, fixpos]
estado: revisada
---
<!-- engine/opciones.js grupo 'restricciones' (opt:70-72); core robots.hpp FireTies (DisableTies), Reproduce (DisableTypArepro), UpdateBots P1 (DisableFixing salta ManageFixed) -->

These three switches take away a DNA tool from all bots. They are useful for
experiments (“what evolves if nobody can tie?”) and for tournament rules. All
three are off by default in the app and in the **F1 league**, and can be turned
on or off while the simulation is running.

They do not make the DNA fail: the bot keeps writing the command, and the
command simply has no effect. A DNA that depends on it does not find out, unless
it looks at the result (for example, [[.numties]] or [[.fixed]]).

:::parametro opt:70
<!-- 34-TIES; core robots.hpp FireTies (b.mem[mtie] != 0 && lastopp > 0 && !DisableTies); lazos.md «Cómo se crea un lazo»; comprobado: ata.txt (2 bots en 700x700) → .numties 1 sin la opción, 0 con ella; Reproduce maketie(…, 100, 0) sin guarda; ties.hpp: last > 1 cuenta hacia el borrado, solo last < 0 endurece (regang); revisor: repro + .tie con opt:70=1 → .numties 1 hasta el ciclo ~100 y después 0 -->
Nobody can tie to another bot with [[.tie]]: the command is cleared without
doing anything and costs nothing. Birth ties, the ones that join a parent to its
child, still form as usual, but they last 100 cycles and never stiffen: without
`.tie` there are no multicellular bots. See [[simulacion/lazos#crear|how a tie is created]]
and [[simulacion/lazos#nacimiento|the birth tie]].

In one test, two bots that looked for each other and wrote to `.tie` ended up
tied within a few cycles; with this option on they kept reading [[.numties]] as
0.
:::

:::parametro opt:71
<!-- 36-REPRO (guarda DisableTypArepro para no vegetales; sin guarda en la sexual); core robots.hpp Reproduce (sirve a repro y mrepro); comprobado: repro.txt → 2 bots sin la opción, 1 con ella, 2 si es vegetal -->
Bots that are not vegetables cannot reproduce on their own: [[.repro]] and
[[.mrepro]] do nothing. Vegetables keep cloning themselves, and sexual
reproduction is still allowed for everyone (see
[[simulacion/reproduccion#sexual|sexual reproduction]]). With this option, an
animal species only leaves children if it finds a mate.

In one test, a bot that asked for a child in its cycle 2 got one without the
option and did not with it; marked as a vegetable, it got one anyway.
:::

:::parametro opt:72
<!-- core robots.hpp UpdateBots P1: if (!DisableFixing) ManageFixed (Fixed = mem(216) > 0); comprobado: fija.txt → quieto con .fixed 1 sin la opción; con ella se mueve y lee .fixed 0 -->
Nobody can anchor with [[.fixpos]]: the engine stops reading that address, and
the bot stays loose even if it writes to it. In one test, a bot that wrote 1 to
`.fixpos` at birth and then pushed ended up pinned without the option; with it,
it moved and read [[.fixed]] as 0. See [[simulacion/fisica#fijos|fixed bots]].

What the engine stops doing is updating the state, and that goes both ways: a
bot that was already anchored when the option is turned on stays anchored for as
long as it remains on, whatever it does with `.fixpos`. Its children, which
inherit the anchor, are born anchored too.
:::
