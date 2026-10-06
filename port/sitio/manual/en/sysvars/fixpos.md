---
titulo: .fixpos
resumen: "Anchors the bot in place while it is greater than 0; with 0 or a negative it releases it."
etiquetas: [fixed, command, movement]
estado: revisada
---
<!-- sysvars.yaml .fixpos (latch, nunca la borra el motor) -->
`.fixpos` is a switch: with a value greater than 0 the bot is anchored, with 0 or a
negative it is free. Unlike the movement commands, the engine never clears it:
what you write stays until you change it, so writing it once is enough. The
effective state is read in [[.fixed]].

<!-- 30-FISICA §2 (gate Not Fixed), §4.3 (fijo = masa 32000; separación posicional), §7 -->
An anchored bot receives no force at all: neither its own pushes with [[.up]] (which
do not cost it energy either) nor gravity. In a collision its velocity does not
change and it counts as a very heavy body, although the engine may still nudge
it a little to separate the two bots if they overlap. It can still turn with
[[.aimsx]], [[.aimdx]] or [[.setaim]], and see or shoot normally.

<!-- sysvars.yaml .fixpos (DisableFixing; semilla 1 si la especie es Fixed) -->
The simulation can have anchoring disabled; in that case `.fixpos` does nothing.
Some species start with `.fixpos` at 1 because whoever loaded them into the
simulation marked them that way.

```adn
' stays still from 100 cycles of age on
cond
*.robage 100 >
start
1 .fixpos store
stop
```

To release it again, `0 .fixpos store` is enough.
