---
titulo: .tout7
resumen: "Canal de salida por lazo número 7: lo que escribís acá lo lee en su .tin7 el bot atado a vos."
etiquetas: [comunicacion, lazos, tout, tin]
estado: revisada
---
Funciona igual que [[.tout1]]: lo que guardás en `.tout7` el motor lo copia en
el [[.tin7]] del bot del otro extremo del lazo, siempre que él esté leyendo
ese lazo (el que elige con [[.readtie]] o, si no eligió, el último creado). Lo lee
en el ciclo siguiente. El motor no la borra: el valor queda publicado hasta que lo
cambies, y un hijo nace con `.tout7` en 0.
<!-- sysvars.yaml .tout7 (borra: no); 34-TIES §2 (readtie → ReadTRefVars en P1); 36-REPRO §2 (el hijo no hereda mem) -->

Con diez canales podés mandarle al compañero varias cosas a la vez. Por ejemplo,
un bot puede publicar acá lo que le llega por su [[.in1]], o sea, el código de especie de lo que tiene enfrente:

```adn
start
*.in1 .tout7 store
stop
```

Ver [[sysvars/entradas-salidas]] y, para lo que el compañero percibe por el lazo
sin que vos publiques nada, [[sysvars/tref]].
