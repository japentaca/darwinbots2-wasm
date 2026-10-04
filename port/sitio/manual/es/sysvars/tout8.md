---
titulo: .tout8
resumen: "Canal de salida por lazo número 8: lo que escribís acá lo lee en su .tin8 el bot atado a vos."
etiquetas: [comunicacion, lazos, tout, tin]
estado: revisada
---
Funciona igual que [[.tout1]]: lo que guardás en `.tout8` el motor lo copia en
el [[.tin8]] del bot del otro extremo del lazo, siempre que él esté leyendo
ese lazo (el que elige con [[.readtie]] o, si no eligió, el último creado). Lo lee
en el ciclo siguiente. El motor no la borra: el valor queda publicado hasta que lo
cambies, y un hijo nace con `.tout8` en 0.
<!-- sysvars.yaml .tout8 (borra: no); 34-TIES §2 (readtie → ReadTRefVars en P1); 36-REPRO §2 (el hijo no hereda mem) -->

Con diez canales podés mandarle al compañero varias cosas a la vez. Por ejemplo,
un bot puede publicar acá cuánto desecho tiene acumulado ([[.waste]]):

```adn
start
*.waste .tout8 store
stop
```

Ver [[sysvars/entradas-salidas]] y, para lo que el compañero percibe por el lazo
sin que vos publiques nada, [[sysvars/tref]].
