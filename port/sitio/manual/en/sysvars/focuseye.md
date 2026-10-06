---
titulo: .focuseye
resumen: "Chooses which of the nine eyes has the focus: the one copied into .eyef and the one that decides what the ref* cells describe."
etiquetas: [eyes, vision, focuseye, ref]
estado: revisada
---
A number that chooses the focus eye. At 0 the focus is [[.eye5]]; each unit
moves the focus one eye to the right and each negative unit one eye to the
left:

| `.focuseye` | −4 | −3 | −2 | −1 | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|---|---|---|
| Focus eye | [[.eye1]] | [[.eye2]] | [[.eye3]] | [[.eye4]] | `.eye5` | [[.eye6]] | [[.eye7]] | [[.eye8]] | [[.eye9]] |

Outside that range it does not raise an error, but the arithmetic is odd: the
engine adds 4, drops the sign and keeps the remainder of dividing by 9. So 5
goes back to `.eye1`, and −5 gives `.eye2`, the same as −3. It is better to stay
between −4 and 4.
<!-- 32-VISION §2.6 y notas: Abs(x+4) Mod 9 -->

The focus eye does two things. Its value is copied into [[.eyef]], and the
closest thing it sees is what the cells of [[sysvars/ref|what it sees]]
describe ([[.refeye]], [[.refnrg]], [[.refxpos]]…). If the focus eye sees
nothing, those cells stay at 0 even if another eye is seeing something (unless
the bot is colliding with another: a collision fills them too).
<!-- 32-VISION §1, §4; sysvars.yaml .refup (borra EraseLookOccurr) -->

It is configuration: the engine reads it but never clears it, so writing it once
is enough.<!-- sysvars.yaml .focuseye (persiste) --> This bot puts the focus on the left eye and
saves in cell 50 the energy of what that eye sees:

```adn
cond
*.robage 0 =
start
-4 .focuseye store
stop

cond
*.eyef 0 >
start
*.refnrg 50 store
stop
```
