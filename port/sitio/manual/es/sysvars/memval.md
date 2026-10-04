---
titulo: .memval
resumen: "El contenido de una celda de la memoria del bot que estás viendo; la celda la elegís con .memloc."
etiquetas: [memoria, espionaje, vista, especie]
estado: revisada
---
<!-- sysvars.yaml .memval (lookoccurr = mem(memloc) del visto; EraseLookOccurr paso 12); 21-MEMORIA §3 régimen A (también desde colisiones); core senses.hpp (memval = 0 al ver una forma) -->
Si en [[.memloc]] pusiste una dirección entre 1 y 1000, `.memval` trae lo que tiene
esa celda en la memoria del bot que estás viendo: el mismo bot cuyos datos llegan a
las [[sysvars/ref|ref*]], como [[.refnrg]] o [[.refage]]. También se llena cuando
chocás con otro bot.

Es un sentido como los ojos: el motor lo escribe después de tu ADN, lo leés en el
ciclo siguiente y se borra solo. Vale 0 cuando no ves ningún bot, cuando lo que ves
es un obstáculo, y también cuando la celda espiada vale 0, así que
conviene combinarla con [[.eye5]] u otra señal de que hay alguien delante.

```adn
' Espia la celda 61 del bot que veo
cond
start
61 .memloc store
stop

' Si su celda 61 vale 7 (la contraseña de mi especie), la celda 50 vale 1
cond
*.eye5 0 >
*.memval 7 =
start
1 50 store
stop
```

El uso más común es reconocer especies, comparando con [[.dnalen]] o con una
contraseña guardada en una celda propia (ver [[sysvars/memoria]]). Para espiar al
bot atado por un lazo, la pareja equivalente es [[.tmemloc]] y [[.tmemval]].
