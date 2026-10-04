---
titulo: .tout2
resumen: "Canal de salida por lazo número 2: lo que escribís acá lo lee en su .tin2 el bot atado a vos."
etiquetas: [comunicacion, lazos, tout, tin]
estado: revisada
---
Funciona igual que [[.tout1]]: lo que guardás en `.tout2` el motor lo copia en
el [[.tin2]] del bot del otro extremo del lazo, siempre que él esté leyendo
ese lazo (el que elige con [[.readtie]] o, si no eligió, el último creado). Lo lee
en el ciclo siguiente. El motor no la borra: el valor queda publicado hasta que lo
cambies, y un hijo nace con `.tout2` en 0.
<!-- sysvars.yaml .tout2 (borra: no); 34-TIES §2 (readtie → ReadTRefVars en P1); 36-REPRO §2 (el hijo no hereda mem) -->

Con diez canales podés mandarle al compañero varias cosas a la vez. Por ejemplo,
un bot puede publicar acá cuánta energía perdió en el último ciclo ([[.pain]]), como pedido de ayuda:

```adn
start
*.pain .tout2 store
stop
```

Ver [[sysvars/entradas-salidas]] y, para lo que el compañero percibe por el lazo
sin que vos publiques nada, [[sysvars/tref]].
