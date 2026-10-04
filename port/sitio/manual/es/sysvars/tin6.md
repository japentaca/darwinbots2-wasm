---
titulo: .tin6
resumen: "Canal de entrada por lazo número 6: el valor que publica en su .tout6 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
Funciona igual que [[.tin1]]: trae lo que tiene escrito en su [[.tout6]] el bot
del otro extremo del lazo que estás leyendo (el que elegís con [[.readtie]] o, si
no elegiste, el último creado). Llega con un ciclo de atraso y el motor la vuelve
a cargar en cada ciclo mientras el lazo exista; vuelve a 0 cuando te quedás sin
lazos. Todos los canales `.tin` vienen del mismo lazo en el mismo ciclo.
<!-- sysvars.yaml .tin6 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

Si el compañero publica en `.tout6` el tipo del disparo que le acaba de pegar, lo leés así:

```adn
' si al compañero le pegaron, guardo el aviso en la 56
cond
*.tin6 0 !=
start
*.tin6 56 store
stop
```

Ver [[sysvars/entradas-salidas]].
