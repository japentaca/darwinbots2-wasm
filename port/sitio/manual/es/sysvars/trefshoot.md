---
titulo: .trefshoot
resumen: "Cuántas veces el ADN del bot atado escribe en .shoot: parte de su firma."
etiquetas: [tref, lazos, firma, especie]
estado: revisada
---
<!-- sysvars.yaml .trefshoot (occurr del atado); core senses.hpp makeoccurrlist (número 1..7 seguido de un store, tipo 7; cuenta el texto del ADN) y ties.hpp ReadTRefVars -->
Cuenta cuántas veces aparece en el ADN del bot atado una escritura en [[.shoot]] (la
dirección 7): el número 7, o `.shoot`, seguido de cualquier palabra de escritura como
[[op:store]] o [[op:inc]]. Solo cuenta esa forma literal: si el ADN calcula la dirección, no suma. Es el [[.myshoot]] del otro: lo que él lee de sí mismo, leído
desde tu lado del lazo.

Es un dato del ADN, no de lo que pasa: cuenta las escrituras aunque su gen nunca se ejecute, y
solo cambia si el ADN del otro muta. Por eso sirve como parte de una _firma_ para
reconocer especies: dos bots con el mismo ADN tienen las mismas cuentas. Un 0 casi siempre quiere decir que el otro no dispara: ni ataca ni come a tiros.

```adn
' Si el atado no tiene genes de disparo, la celda 50 vale 1
cond
*.numties 0 >
*.trefshoot 0 =
start
1 50 store
stop
```

Las demás cuentas de la firma son [[.trefup]], [[.trefdn]], [[.trefsx]],
[[.trefdx]], [[.trefaimdx]], [[.trefaimsx]] y [[.trefeye]]; las del
bot que ves, las [[sysvars/ref|ref*]] como [[.refup]].
