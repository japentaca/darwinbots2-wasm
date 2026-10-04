---
titulo: .mrepro
resumen: "Como .repro, pero el hijo nace con una probabilidad de mutar mucho mayor: reproducción para explorar."
etiquetas: [reproducción, asexual, mutaciones, acción]
estado: revisada
---
<!-- 36-REPRO §2 (régimen de mutación: sin Delta2, tasas ÷10 y Mutations forzado solo para ese parto); 40-MUTACIONES (mutate no corre con las mutaciones apagadas en la simulación) -->
Funciona igual que [[.repro]]: el número es el porcentaje que se lleva el hijo, se
toma módulo 100, la orden queda escrita hasta que el parto sale bien y se cancela
escribiendo 0. La diferencia está en el hijo: con la configuración habitual, sus
probabilidades de mutar al nacer son diez veces más altas que las normales, y muta
aunque su especie tenga las mutaciones apagadas. Si las mutaciones están apagadas
para toda la simulación, no muta igual. Las mutaciones se explican en
[[simulacion/mutaciones]].

Para qué sirve: un bot que se reproduce casi siempre con `.repro` y de vez en cuando
con `.mrepro` mantiene un linaje estable con algunos hijos que prueban cosas
nuevas.

```adn
' Uno de cada diez partos es exploratorio
cond
 *.nrg 6000 >
 *.timer 10 mod 0 =
start
 50 .mrepro store
stop
cond
 *.nrg 6000 >
 *.timer 10 mod 0 !=
start
 50 .repro store
stop
```

<!-- 36-REPRO §1 (moneda entre los dos porcentajes); el régimen mirado es mem(mrepro) > 0 -->
Si `.repro` y `.mrepro` están escritas a la vez, una moneda decide qué porcentaje se
usa, y el hijo muta de más igual, porque basta con que `.mrepro` tenga algo. Ojo en
el ejemplo: como las dos órdenes persisten hasta el parto, un pedido que falla en un
ciclo puede quedar escrito junto con el del otro gen.
