---
titulo: Advanced
resumen: "Angles, distances, roots, powers, trigonometry, caps and debugging: the math that is not plain arithmetic."
etiquetas: [geometry, angles, math, advanced, debugging]
estado: revisada
---
<!-- 20-VM §6.2, §1 (ADCMDCOST solo value < 13); opcodes.yaml avanzados; conteo de uso en el Bestiario -->

The advanced operators take numbers from the [[adn/pilas#entera|integer stack]]
and leave one, just like the [[operadores/basicos|basic ones]], but they do
more elaborate math. They are grouped like this:

- **Geometry**: [[op:angle]] (which way a point lies), [[op:dist]] (how far
  away it is), [[op:anglecmp]] (how much to turn from one angle to another) and
  [[op:pyth]] (the length of a vector).
- **Caps**: [[op:ceil]] sets a maximum and [[op:floor]] a minimum. The names
  are confusing: `ceil` is the _ceiling_, so it gives the smaller of the two.
- **Math**: [[op:sqr]], [[op:pow]], [[op:root]] and [[op:logx]], all with a
  rounded integer result.
- **Trigonometry**: [[op:sin]] and [[op:cos]], with the result multiplied by
  32000 so it is not lost to rounding.
- **Debugging**: [[op:debugint]] and [[op:debugbool]], which leave the stack as
  it is and note its value so you can look at it from the console.

Angles use the same units as [[.aim]]: a full turn is about 1256 units
(2π × 200), 0 points right and the angle grows counterclockwise, so 314 is
up.

In the Bestiary, the ones that appear in the most bots, by far, are `angle`,
`floor` and `ceil`. The first, for aiming at what a bot sees; the other two,
to keep a value from leaving a range.
<!-- conteo de bots del Bestiario: angle 284, floor 212, ceil 149; 1_3.txt (Saber) línea 559; sysvars.yaml .venval (836) -->
_Saber_, by abyaly, computes the value that its venom writes to the victim
([[.venval]]) and keeps it between 5 and 50 in a single line:

```adn
cond
start
  1000 *.refbody div 50 ceil 5 floor .venval store
stop
```

Every advanced operator executed costs [[param:cost:3]] (free under the F1
rules), except `debugint` and `debugbool`, which never cost anything.
