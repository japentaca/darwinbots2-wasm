---
titulo: .refypos
resumen: "La coordenada y de lo que estás viendo: junto con .refxpos y el operador angle, sirve para apuntarle justo."
etiquetas: [visión, refvars, posición, puntería]
estado: revisada
---
<!-- sysvars.yaml 690; 32-VISION §4; core senses.hpp lookoccurr (mem 217 del visto); 30-FISICA §7 (Y invertida, convención de pantalla) -->
`.refypos` es la coordenada vertical del bot que ve tu ojo con foco, en las
mismas unidades que tu propia [[.ypos]]. Como en la pantalla, crece hacia
abajo. Se usa siempre junto con [[.refxpos]], que tiene la explicación
completa y un ejemplo.

Las dos sirven también para recordar dónde viste algo. Si guardás la
posición en memoria libre, podés volver a buscarlo aunque lo pierdas de
vista:

```adn
' anoto dónde vi la última presa
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refxpos 50 store
*.refypos 51 store
stop
```

Como `.refxpos`, trae la posición publicada por el otro, que puede tener un
ciclo de atraso, y vale 0 si no ves nada.
