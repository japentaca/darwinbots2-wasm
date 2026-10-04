---
titulo: .tin5
resumen: "Canal de entrada por lazo número 5: el valor que publica en su .tout5 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
Funciona igual que [[.tin1]]: trae lo que tiene escrito en su [[.tout5]] el bot
del otro extremo del lazo que estás leyendo (el que elegís con [[.readtie]] o, si
no elegiste, el último creado). Llega con un ciclo de atraso y el motor la vuelve
a cargar en cada ciclo mientras el lazo exista; vuelve a 0 cuando te quedás sin
lazos. Todos los canales `.tin` vienen del mismo lazo en el mismo ciclo.
<!-- sysvars.yaml .tin5 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

Si el compañero publica en `.tout5` la posición vertical de lo que tiene enfrente, lo leés así:

```adn
' guardo en la 55 la y de lo que ve el compañero
cond
*.tin5 0 !=
start
*.tin5 55 store
stop
```

Ver [[sysvars/entradas-salidas]].
