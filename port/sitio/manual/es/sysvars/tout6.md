---
titulo: .tout6
resumen: "Canal de salida por lazo número 6: lo que escribís acá lo lee en su .tin6 el bot atado a vos."
etiquetas: [comunicacion, lazos, tout, tin]
estado: revisada
---
Funciona igual que [[.tout1]]: lo que guardás en `.tout6` el motor lo copia en
el [[.tin6]] del bot del otro extremo del lazo, siempre que él esté leyendo
ese lazo (el que elige con [[.readtie]] o, si no eligió, el último creado). Lo lee
en el ciclo siguiente. El motor no la borra: el valor queda publicado hasta que lo
cambies, y un hijo nace con `.tout6` en 0.
<!-- sysvars.yaml .tout6 (borra: no); 34-TIES §2 (readtie → ReadTRefVars en P1); 36-REPRO §2 (el hijo no hereda mem) -->

Con diez canales podés mandarle al compañero varias cosas a la vez. Por ejemplo,
un bot puede publicar acá el tipo del disparo que le acaba de pegar ([[.shflav]]; 0 si no le pegó ninguno), como alarma para el resto del organismo:

```adn
start
*.shflav .tout6 store
stop
```

Ver [[sysvars/entradas-salidas]] y, para lo que el compañero percibe por el lazo
sin que vos publiques nada, [[sysvars/tref]].
