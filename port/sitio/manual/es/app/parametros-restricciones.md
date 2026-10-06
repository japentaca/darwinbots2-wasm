---
titulo: "Parámetros: Restricciones"
resumen: "Tres prohibiciones que valen para todos los bots: atarse a otro, reproducirse solo y anclarse en el lugar."
etiquetas: [restricciones, lazos, reproducción, fixpos]
estado: revisada
---
<!-- engine/opciones.js grupo 'restricciones' (opt:70-72); core robots.hpp FireTies (DisableTies), Reproduce (DisableTypArepro), UpdateBots P1 (DisableFixing salta ManageFixed) -->

Estos tres interruptores le quitan a todos los bots una herramienta del ADN.
Sirven para experimentos («¿qué evoluciona si nadie puede atarse?») y para
reglas de torneo. Los tres vienen apagados en la app y en la **Liga F1**, y se
pueden prender o apagar con la simulación corriendo.

No hacen fallar al ADN: el bot sigue escribiendo la orden, y la orden
simplemente no tiene efecto. Un ADN que depende de ella no se entera, salvo
que mire el resultado (por ejemplo, [[.numties]] o [[.fixed]]).

:::parametro opt:70
<!-- 34-TIES; core robots.hpp FireTies (b.mem[mtie] != 0 && lastopp > 0 && !DisableTies); lazos.md «Cómo se crea un lazo»; comprobado: ata.txt (2 bots en 700x700) → .numties 1 sin la opción, 0 con ella; Reproduce maketie(…, 100, 0) sin guarda; ties.hpp: last > 1 cuenta hacia el borrado, solo last < 0 endurece (regang); revisor: repro + .tie con opt:70=1 → .numties 1 hasta el ciclo ~100 y después 0 -->
Nadie puede atarse a otro con [[.tie]]: la orden se borra sin hacer nada y no
cobra. Los lazos de nacimiento, los que unen a un padre con su hijo, se siguen
formando igual, pero duran 100 ciclos y nunca se endurecen: sin `.tie` no hay
multicelulares. Ver [[simulacion/lazos#crear|cómo se crea un lazo]] y
[[simulacion/lazos#nacimiento|el lazo de nacimiento]].

En una prueba, dos bots que se buscaban y escribían en `.tie` quedaron atados
en pocos ciclos; con esta opción encendida siguieron leyendo [[.numties]] en 0.
:::

:::parametro opt:71
<!-- 36-REPRO (guarda DisableTypArepro para no vegetales; sin guarda en la sexual); core robots.hpp Reproduce (sirve a repro y mrepro); comprobado: repro.txt → 2 bots sin la opción, 1 con ella, 2 si es vegetal -->
Los bots que no son vegetales no pueden reproducirse solos: [[.repro]] y
[[.mrepro]] no hacen nada. Los vegetales siguen clonándose, y la
reproducción sexual sigue permitida para todos (ver
[[simulacion/reproduccion#sexual|la reproducción sexual]]). Con esta opción, una especie animal solo
deja hijos si encuentra pareja.

En una prueba, un bot que pedía un hijo en su ciclo 2 lo tuvo sin la opción y
no lo tuvo con ella; marcado como vegetal, lo tuvo igual.
:::

:::parametro opt:72
<!-- core robots.hpp UpdateBots P1: if (!DisableFixing) ManageFixed (Fixed = mem(216) > 0); comprobado: fija.txt → quieto con .fixed 1 sin la opción; con ella se mueve y lee .fixed 0 -->
Nadie puede anclarse con [[.fixpos]]: el motor deja de leer esa dirección, y el
bot sigue suelto aunque escriba en ella. En una prueba, un bot que escribía 1
en `.fixpos` al nacer y después empujaba quedó anclado sin la opción; con ella
se movió y leyó [[.fixed]] en 0. Ver [[simulacion/fisica#fijos|los bots anclados]].

Lo que el motor deja de hacer es actualizar el estado, y eso vale para los dos
lados: un bot que ya estaba anclado cuando se enciende la opción se queda anclado
mientras siga encendida, haga lo que haga con `.fixpos`. Sus hijos, que
heredan el ancla, nacen anclados también.
:::
