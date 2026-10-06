---
titulo: .in1
resumen: "Primer canal de entrada por la vista: el valor que publica en su .out1 el bot que tenés en el ojo con foco."
etiquetas: [comunicacion, in, out, vision, especie]
estado: revisada
---
`.in1` te dice qué tiene escrito en su [[.out1]] el bot que estás mirando con el
ojo con foco (normalmente [[.eye5]]; se cambia con [[.focuseye]]). Es el mismo
bot que describen los sentidos [[sysvars/ref|ref*]]: si en ese ojo hay varios, el
más cercano. Si otro bot te choca, también recibís su `.out1`, aunque no lo veas.
<!-- sysvars.yaml .in1; 32-VISION §1 (lastopp = bot del ojo con foco con mayor eyevalue), §4 (lookoccurr en visión y en colisión) -->

Llega con un ciclo de atraso: el motor la llena después de que corrió tu ADN, y
la borra después de la próxima ejecución. Por eso vale 0 cuando no estás viendo
ningún bot, cuando lo que tenés enfrente es un obstáculo, y también cuando el otro
nunca escribió su `.out1`. Esos tres casos no se distinguen entre sí: para saber
si hay alguien adelante mirá `*.eye5`, no `*.in1`.
<!-- 21-MEMORIA §3 (régimen A: escrito tras el ADN, borrado en el paso 12); lookoccurrShape pone in* en 0 ante una forma -->

El valor llega tal cual. El ±1 al azar del original, que nombra la nota del cuadro «Datos» de arriba, es de
un modo de evolución del programa que este port no incluye.
<!-- 32-VISION §4 (fudge = capa evo); el core no lo implementa -->

La comparación típica es con tu propia salida, para reconocer a los tuyos:

```adn
' anoto en la 51 cuántas veces vi a alguien que no es de los míos
start
555 .out1 store
stop

cond
*.eye5 0 >
*.in1 *.out1 !=
start
51 inc
stop
```

La idea completa está en [[tutoriales/reconoce-especie]]. Hay diez
canales iguales, de `.in1` a [[.in10]]; ver [[sysvars/entradas-salidas]].
