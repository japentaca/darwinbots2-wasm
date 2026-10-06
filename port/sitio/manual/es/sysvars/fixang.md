---
titulo: .fixang
resumen: "Orden para fijar el ángulo de un lazo endurecido respecto de hacia dónde apunta el bot (en la escala de 1256 por vuelta); un negativo lo suelta."
etiquetas: [lazos, tie, multicelular, ángulo]
estado: revisada
---
Fija en qué dirección, vista desde el bot, tiene que quedar el lazo elegido con
[[.tienum]] (o el de [[.tiepres]]). La escala es la de siempre: 0 es justo
adelante, 314 un cuarto de vuelta, 628 atrás, y los valores se toman módulo 1256.
Desde ese ciclo el motor hace girar al bot y empuja a los dos de costado para
sostener ese ángulo, como una articulación. Deja una holgura de 5 grados (unos 17
en la escala de 1256) sin corregir, así que el ángulo real queda cerca del
pedido pero no exacto. Un valor negativo suelta el ángulo y el lazo vuelve a
girar libre.

<!-- sysvars.yaml .fixang (≥ 0 fija ángulo Mod 1256 /200; < 0 libera); 30-FISICA §3.2 (TieTorque, holgura de 5°); comprobado con probar-adn: con 314 el lazo se sostiene en ~333 -->

Solo actúa sobre lazos endurecidos de un bot multicelular ([[.multi]]). Al
endurecerse, el lazo del bot que lo creó ya queda anclado en el ángulo que tenía en
ese momento; `.fixang` sirve para cambiarlo.

<!-- 34-TIES §0.4 (regang fija el ángulo actual; solo el lado no-back) -->

Su valor de reposo es **32000**, no 0: el bot nace con 32000 y el motor la vuelve
a 32000 después de usarla. Escribir 0 no es «nada», es «el lazo adelante». Si el
bot no tiene lazos, el valor que escribas queda ahí.

<!-- 21-MEMORIA §9.8 (centinela 32000; reset tras el gate tienum/tiepres) -->

```adn
' una vez multicelular, llevar al compañero a un costado
cond
*.multi 1 =
start
314 .fixang store
stop
```

Para manejar los cuatro primeros lazos sin elegirlos uno por uno están
[[.tieang1]]…`.tieang4`.
