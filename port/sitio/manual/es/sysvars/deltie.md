---
titulo: .deltie
resumen: "Orden para cortar los lazos que tengan ese puerto; el motor la borra después de usarla."
etiquetas: [lazos, tie]
estado: revisada
---
Escribí el puerto del lazo que querés cortar: el número que pusiste en [[.tie]]
si lo creaste vos, o su número de orden si te ataron (el que te mostró
[[.tiepres]] cuando se formó). El lazo desaparece de los dos lados y el motor
deja la orden en 0. Si no tenés ningún lazo, la orden queda escrita.

<!-- sysvars.yaml .deltie (Update_Ties P3: borra las ties cuyo puerto = mem(467); =0 al consumir); port/core ties.hpp (con numties = 0, Update_Ties sale antes del bloque de deltie) -->

Funciona desde cualquiera de los dos extremos. Pero un 0 no es una orden, y eso
tiene una consecuencia: el padre ve el lazo de nacimiento con el puerto 0, así
que no lo puede cortar con `.deltie`. El hijo sí, porque para él ese lazo tiene
el puerto 1. De todos modos el lazo de nacimiento se corta solo a los 100 ciclos.

<!-- 34-TIES §0.2, §0.4, §1 (puerto 0 del padre en el nacimiento) -->

```adn
' recién nacido: soltarse del padre
cond
*.robage 1 =
start
1 .deltie store
stop
```

<!-- comprobado con probar-adn: al ciclo siguiente padre e hijo quedan con .numties 0 -->
