---
titulo: .tin10
resumen: "Canal de entrada por lazo número 10: el valor que publica en su .tout10 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
Funciona igual que [[.tin1]]: trae lo que tiene escrito en su [[.tout10]] el bot
del otro extremo del lazo que estás leyendo (el que elegís con [[.readtie]] o, si
no elegiste, el último creado). Llega con un ciclo de atraso y el motor la vuelve
a cargar en cada ciclo mientras el lazo exista; vuelve a 0 cuando te quedás sin
lazos. Todos los canales `.tin` vienen del mismo lazo en el mismo ciclo.
<!-- sysvars.yaml .tin10 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

Si el compañero publica en `.tout10` cuántos lazos tiene, lo leés así:

```adn
' si el compañero tiene más lazos que yo, lo cuento en la 60
cond
*.tin10 *.numties >
start
60 inc
stop
```

Ver [[sysvars/entradas-salidas]].
