---
titulo: .robage
resumen: "La edad del bot en ciclos: 0 en su primer ciclo de vida, sube de a 1 y se detiene en 32000."
etiquetas: [edad, sentido, reloj]
estado: revisada
---
<!-- sysvars.yaml .robage (Ageing P5, tope 32000); comprobado: sembrado e hijo leen 0 en su primer ciclo -->
Cuenta cuántos ciclos lleva vivo el bot. El motor la publica al final de cada ciclo,
así que en el primer ciclo de vida el ADN lee 0, en el segundo 1, y así. Vale lo
mismo para un bot recién cargado que para un hijo recién nacido. Al llegar a 32000
se queda ahí: no vuelve a empezar.

El uso más común es hacer algo una sola vez, al nacer:

```adn
' Al nacer, una sola vez, da media vuelta
cond
 *.robage 0 =
start
 628 .aimdx store
stop
```

Este bot gira 628 (media vuelta) en su primer ciclo y después no vuelve a girar.
También sirve para esperar antes de reproducirse (`*.robage 10 >`) o para darle
a un hijo unos ciclos de gracia.

No la podés cambiar: si escribís en `.robage`, el motor pisa tu valor en el mismo
ciclo (ver [[adn/stores]]). Si necesitás un reloj que puedas poner a cero, o que
sigan compartiendo padre e hijo, usá [[.timer]]. La edad de lo que estás mirando
está en [[.refage]].
