---
titulo: .setboy
resumen: "Raises or lowers the bot's buoyancy, which in pond mode with gravity decides what height it settles at."
etiquetas: [buoyancy, pond, gravity, action]
estado: revisada
---
<!-- sysvars.yaml .setboy .rdboy (ManageBouyancy P5: += valor/32000, clamp 0..1) -->
Buoyancy is a number between 0 and 1 that the bot carries with it. `.setboy` changes
it: whatever you write is divided by 32000 and added to what it already had, so
`8000 .setboy store` raises it by a quarter and `-8000 .setboy store` lowers it by a quarter. The
result never leaves the range 0 to 1. It applies in the same cycle and the engine
clears the order. The new value is read in [[.rdboy]].

<!-- 31-ENERGIA §1 (flotabilidad en pondmode: costo ∝ min(masa,192)·Bouyancy); 36-REPRO §2 (Bouyancy heredada) -->
It only has an effect with the [[param:opt:30]] option on, gravity
([[param:opt:20]]) and a field with no connection between the top edge and the
bottom edge. In that case buoyancy sets a height, measured from the bottom as a
fraction of the field height: if the bot is above it, gravity sinks it; if
it is below, gravity pushes it up. With buoyancy 0 it goes to the bottom, and with 1
it rises to the top. Keeping buoyancy above 0 costs energy every cycle,
proportional to it and to the bot's mass (mass counts up to 192).

```adn
' It tries to float at mid height
cond
 *.rdboy 16000 <
start
 1000 .setboy store
stop
```

<!-- comprobado: .rdboy sube de a 1000 y se queda en 16000 -->
In 16 cycles this bot reaches a buoyancy of 16000 and stops. Children
inherit their parent's buoyancy, although their [[.rdboy]] starts at 0 (see that
page). More on the physics in [[simulacion/fisica]].
