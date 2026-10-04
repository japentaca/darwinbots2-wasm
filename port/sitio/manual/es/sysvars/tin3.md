---
titulo: .tin3
resumen: "Canal de entrada por lazo número 3: el valor que publica en su .tout3 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
Funciona igual que [[.tin1]]: trae lo que tiene escrito en su [[.tout3]] el bot
del otro extremo del lazo que estás leyendo (el que elegís con [[.readtie]] o, si
no elegiste, el último creado). Llega con un ciclo de atraso y el motor la vuelve
a cargar en cada ciclo mientras el lazo exista; vuelve a 0 cuando te quedás sin
lazos. Todos los canales `.tin` vienen del mismo lazo en el mismo ciclo.
<!-- sysvars.yaml .tin3 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

Si el compañero publica en `.tout3` lo que ve adelante, lo leés así:

```adn
' si el compañero ve algo y yo no, lo anoto en la 53
cond
*.tin3 0 >
*.eye5 0 =
start
*.tin3 53 store
stop
```

Ver [[sysvars/entradas-salidas]].
