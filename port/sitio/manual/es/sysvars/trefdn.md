---
titulo: .trefdn
resumen: "Cuántas veces el ADN del bot atado escribe en .dn: parte de su firma."
etiquetas: [tref, lazos, firma, especie]
estado: revisada
---
<!-- sysvars.yaml .trefdn (occurr del atado); core senses.hpp makeoccurrlist (número 1..7 seguido de un store, tipo 7; cuenta el texto del ADN) y ties.hpp ReadTRefVars -->
Cuenta cuántas veces aparece en el ADN del bot atado una escritura en [[.dn]] (la
dirección 2): el número 2, o `.dn`, seguido de cualquier palabra de escritura como
[[op:store]] o [[op:inc]]. Solo cuenta esa forma literal: si el ADN calcula la dirección, no suma. Es el [[.mydn]] del otro: lo que él lee de sí mismo, leído
desde tu lado del lazo.

Es un dato del ADN, no de lo que pasa: cuenta las escrituras aunque su gen nunca se ejecute, y
solo cambia si el ADN del otro muta. Por eso sirve como parte de una _firma_ para
reconocer especies: dos bots con el mismo ADN tienen las mismas cuentas. Un valor distinto de 0 dice que el otro sabe frenar o retroceder.

```adn
' Si el atado tiene tantas escrituras en .dn como yo, la celda 50 vale 1
cond
*.numties 0 >
*.trefdn *.mydn =
start
1 50 store
stop
```

Las demás cuentas de la firma son [[.trefup]], [[.trefsx]],
[[.trefdx]], [[.trefaimdx]], [[.trefaimsx]], [[.trefshoot]] y [[.trefeye]]; las del
bot que ves, las [[sysvars/ref|ref*]] como [[.refup]].
