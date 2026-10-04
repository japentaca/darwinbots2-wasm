---
titulo: Posición y entorno
resumen: "Dónde está el bot en el mundo, si toca el borde, si es de día y cuántos bots hay: los sentidos que lo ubican."
etiquetas: [posición, mundo, sol, población]
estado: revisada
---
<!-- sysvars.yaml .xpos .depth .edge .daytime .sun .totalbots .totalmyspecies -->
Estas sysvars le cuentan al bot dónde está parado y cómo está el mundo a su
alrededor. Todas las escribe el motor; escribir en ellas no sirve, porque el motor
las vuelve a publicar en cada ciclo. Y como las publica después de que corre el ADN,
en el primer ciclo de vida valen 0.

- **Dónde está.** [[.xpos]] y [[.depth]] (también `.ypos`) son sus coordenadas:
  la horizontal y la vertical, con el 0 arriba a la izquierda y la profundidad
  creciendo hacia abajo.
- **El borde.** [[.edge]] vale 1 cuando el bot está apoyado contra el borde del
  mundo.
- **La luz.** [[.daytime]] dice si es de día (o, para un bot con cloroplastos, si
  le está dando el sol). [[.sun]], pese al nombre, no tiene que ver con la luz:
  vale 1 cuando el bot apunta hacia arriba.
- **La población.** [[.totalbots]] cuenta todos los bots del mundo y
  [[.totalmyspecies]] los de su especie.

Las más usadas son `.edge`, para no quedarse pegado a la pared, y
`.totalmyspecies`, para regular la reproducción: no tener más hijos cuando la
especie ya llenó el mundo. Este bot solo se reproduce mientras su especie tenga
menos de 50 integrantes:

```adn
cond
*.totalmyspecies 50 <
*.nrg 5000 >
start
50 .repro store
stop
```

La posición sirve para quedarse en una zona (por ejemplo, la parte iluminada de
un estanque, ver [[simulacion/cloroplastos]]) o, junto con [[.refxpos]] y
[[.refypos]], para calcular hacia dónde está lo que ve.
