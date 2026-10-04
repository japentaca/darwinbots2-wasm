---
titulo: .tin2
resumen: "Canal de entrada por lazo número 2: el valor que publica en su .tout2 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
Funciona igual que [[.tin1]]: trae lo que tiene escrito en su [[.tout2]] el bot
del otro extremo del lazo que estás leyendo (el que elegís con [[.readtie]] o, si
no elegiste, el último creado). Llega con un ciclo de atraso y el motor la vuelve
a cargar en cada ciclo mientras el lazo exista; vuelve a 0 cuando te quedás sin
lazos. Todos los canales `.tin` vienen del mismo lazo en el mismo ciclo.
<!-- sysvars.yaml .tin2 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

Si el compañero publica en `.tout2` cuánta energía perdió en el último ciclo, lo leés así:

```adn
' si el compañero está perdiendo energía, guardo cuánto en la 52
cond
*.tin2 0 >
start
*.tin2 52 store
stop
```

Ver [[sysvars/entradas-salidas]].
