---
titulo: .eye5
resumen: "El ojo frontal: vale 0 si no hay nada adelante y más cuanto más cerca está lo que el bot tiene enfrente; es el sentido más usado del ADN."
etiquetas: [ojos, visión, sentidos, eye5]
estado: revisada
---
El ojo del medio de los nueve [[sysvars/ojos|ojos]]: con la configuración de
fábrica mira justo hacia donde apunta el bot ([[.aim]]), con un campo de 10
grados. Vale 0 si no ve nada; si ve algo, un número que crece al acercarse: 1
en el límite del alcance (unas 1440 unidades), 100 a unas 134 unidades de borde
a borde y 32000 cuando se tocan. La tabla completa está en
[[sysvars/ojos#valor]].
<!-- 32-VISION §0.2, §0.3, §0.4; sysvars.yaml .eye5 -->

Es además el ojo con foco de fábrica: mientras [[.focuseye]] valga 0, su valor
se repite en [[.eyef]] y lo que ve es lo que describen las celdas de
[[sysvars/ref|lo que se ve]], como [[.refeye]] o [[.refnrg]]. Por eso casi todos
los bots lo usan para decidir: avanzar si hay algo, disparar si está cerca,
comer si es de otra especie.
<!-- 32-VISION §2.6; sysvars.yaml .focuseye -->

Lo escribe el motor al final de cada ciclo, después de mover a todos los bots,
así que va con un ciclo de atraso: si girás ahora, lo que hay en la nueva
dirección lo leés en el ciclo siguiente. Ve bots vivos, vegetales y cadáveres
por igual; para saber qué es, mirá las celdas `ref*`.
<!-- 32-VISION §0.1, §2 (notas: los cadáveres se ven) -->

El ejemplo empuja hacia lo que tiene enfrente mientras esté lejos y deja de
empujar cuando el valor llega a 100. Ojo: dejar de empujar no es frenar; el bot
conserva la velocidad que traía y puede terminar chocando:

```adn
' acercarse a lo que se ve adelante
cond
*.eye5 0 >
*.eye5 100 <
start
20 .up store
stop
```

El ojo frontal también se puede reapuntar con [[.eye5dir]] y ensanchar con
[[.eye5width]].
