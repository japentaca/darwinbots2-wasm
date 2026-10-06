---
titulo: .shflav
resumen: "The type of the shot that hit you in the previous cycle (−1, −2, −3…, or the address of a memory shot); 0 if nothing hit you."
etiquetas: [shots, senses, defense]
estado: revisada
---
<!-- 32-VISION §5 (taste); 33-SHOTS §3.4; sysvars.yaml 202; core senses.hpp taste/EraseSenses; probado: tira.txt contra blanco.txt (-1 en el blanco, -2 en el tirador), memshot.txt (50), sperm.txt (-8) -->
`.shflav` is the “flavor” of the last shot that hit you: its type, the same
number the shooter wrote in its [[.shoot]]. −1 is someone stealing your
energy, −3 venom, −6 someone stealing your body, and so on. For a memory
shot it is the address that was written to; for sperm, −8. If nothing
hit you, it is 0.

The engine writes it when the shot arrives, after your DNA has run, so
you read it in the next cycle; after that it is cleared. If several hit you in the
same cycle, the last one is what remains.

:::cuidado
A hunter that uses −1 also feels its own gains. The energy shot
comes back toward the shooter as a −2, and on arrival it sets `.shflav` to
−2. In the test, the target read −1 and the shooter −2, in the same cycle. If your
bot reacts to any `.shflav` other than 0, it will also react to
its own meals.
:::

To find out where it came from, look at [[.shang]] or at the four direction ones
([[.shup]], [[.shdn]], [[.shdx]], [[.shsx]]).

```adn
' they're stealing my energy: I run
cond
*.shflav -1 =
start
628 .aimdx store
40 .up store
stop
```
