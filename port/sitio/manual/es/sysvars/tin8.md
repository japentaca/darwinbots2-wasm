---
titulo: .tin8
resumen: "Canal de entrada por lazo número 8: el valor que publica en su .tout8 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
Funciona igual que [[.tin1]]: trae lo que tiene escrito en su [[.tout8]] el bot
del otro extremo del lazo que estás leyendo (el que elegís con [[.readtie]] o, si
no elegiste, el último creado). Llega con un ciclo de atraso y el motor la vuelve
a cargar en cada ciclo mientras el lazo exista; vuelve a 0 cuando te quedás sin
lazos. Todos los canales `.tin` vienen del mismo lazo en el mismo ciclo.
<!-- sysvars.yaml .tin8 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

Si el compañero publica en `.tout8` cuánto desecho tiene acumulado, lo leés así:

```adn
' guardo en la 58 el desecho del compañero
start
*.tin8 58 store
stop
```

Ver [[sysvars/entradas-salidas]].
