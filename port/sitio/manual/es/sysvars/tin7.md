---
titulo: .tin7
resumen: "Canal de entrada por lazo número 7: el valor que publica en su .tout7 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
Funciona igual que [[.tin1]]: trae lo que tiene escrito en su [[.tout7]] el bot
del otro extremo del lazo que estás leyendo (el que elegís con [[.readtie]] o, si
no elegiste, el último creado). Llega con un ciclo de atraso y el motor la vuelve
a cargar en cada ciclo mientras el lazo exista; vuelve a 0 cuando te quedás sin
lazos. Todos los canales `.tin` vienen del mismo lazo en el mismo ciclo.
<!-- sysvars.yaml .tin7 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

Si el compañero publica en `.tout7` el código de especie de lo que tiene enfrente, lo leés así:

```adn
' si el compañero tiene enfrente a alguien que no es de los nuestros, lo cuento en la 57
cond
*.tin7 0 !=
*.tin7 *.out1 !=
start
57 inc
stop
```

Ver [[sysvars/entradas-salidas]].
