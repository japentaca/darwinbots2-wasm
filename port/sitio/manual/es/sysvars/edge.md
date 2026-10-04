---
titulo: .edge
resumen: "Vale 1 cuando el bot está apoyado contra el borde del mundo; sirve para no quedarse pegado a la pared."
etiquetas: [borde, sentido, posición, choque]
estado: revisada
---
<!-- sysvars.yaml .edge; 30-FISICA §5; 10-CICLO §7 -->
`.edge` avisa que el bot llegó al borde del mundo: el motor la pone en 1 cuando el
bot quedó apoyado contra la pared en el paso de física, y la borra después de que
corre el ADN del ciclo siguiente. Es decir que tu ADN la ve en 1 durante un solo
ciclo, el que sigue al contacto; si el bot se queda empujando contra la pared, se
vuelve a encender en cada ciclo.

Solo existe en los mundos con paredes. Si la simulación conecta los bordes (el bot
que sale por un lado entra por el opuesto), `.edge` no se enciende en esos bordes;
si conecta solo los de un eje, la encienden los otros dos.

<!-- 30-FISICA §5 (clamp + amortiguador 0,05); probado con el ejemplo -->
Un bot contra la pared no rebota: el motor lo deja apoyado en el borde, y si sigue
empujando hacia afuera se queda ahí, a veces trabado en una esquina. Peor: su
[[.velscalar]] sigue diciendo que va rápido. Por eso conviene reaccionar a `.edge`
girando, como hace _Anon Terifica 2_, del Bestiario:

```adn
cond
*.edge 0 !=
start
100 .aimsx store
stop
```

Conviene que el giro sea chico: como `.edge` sigue encendida mientras el bot esté
contra la pared, un giro de un cuarto de vuelta por ciclo puede dejarlo dando
vueltas en una esquina, mientras que de a 100 termina apuntando hacia afuera.

Los choques con otros bots no la encienden; para eso están [[.hit]] y sus
direcciones.
