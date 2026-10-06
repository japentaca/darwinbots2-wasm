---
titulo: .refxpos
resumen: "La coordenada x de lo que estás viendo: junto con .refypos y el operador angle, sirve para apuntarle justo."
etiquetas: [visión, refvars, posición, puntería]
estado: revisada
---
<!-- sysvars.yaml 689; 32-VISION §4 (copia de mem 219 del visto, asimetría por índice); README B2-4; core senses.hpp lookoccurr/lookoccurrShape; probado: apunta.txt contra lateral.txt; 32-VISION §3.5 (lastopppos solo con el ojo frontal); opcodes.yaml angle -->
`.refxpos` es la coordenada horizontal del bot que ve tu ojo con foco, en las
mismas unidades que tu propia [[.xpos]]. Su pareja es [[.refypos]].

Con las dos coordenadas, el operador [[op:angle]] calcula hacia dónde está el
otro, y escribiendo ese ángulo en [[.setaim]] quedás apuntándole de frente.
Es la manera más precisa de no perder un blanco que se mueve: girar a ciegas
con [[.aimdx]] lo deja escapar del ojo frontal, que es angosto.

```adn
cond
*.eye5 0 =
start
40 .aimdx store
stop

' lo tengo a la vista: le apunto al centro
cond
*.eye5 0 >
start
*.refxpos *.refypos angle .setaim store
stop
```

En una prueba contra un bot que se desplazaba de costado, un bot con estos dos genes lo mantuvo
en el [[.eye5]] durante todo el recorrido.

Lo que llega es la posición que el otro _publicó_, no la exacta de este
momento: según el orden en que el motor procesa a los bots, puede tener un
ciclo de atraso. Cuando lo que ves es una forma ([[.reftype]] en 1), es un
punto de la forma, y solo es confiable si el ojo con foco es el frontal: con
otro ojo ([[.focuseye]]) la posición de una forma queda vieja o en 0. Si no
ves nada, vale 0.
