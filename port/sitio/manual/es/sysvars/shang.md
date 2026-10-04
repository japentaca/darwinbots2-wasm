---
titulo: .shang
resumen: "Desde qué ángulo llegó el disparo que te pegó, medido desde tu frente hacia la derecha: escribilo en .aimdx y quedás mirando al tirador."
etiquetas: [disparos, sentidos, defensa, ángulos]
estado: revisada
---
<!-- 32-VISION §5 (shang = dang·200); sysvars.yaml 209; core senses.hpp taste; probado: gira.txt (tras girar, el eye5 ve al tirador); revisor: tira.txt contra blanco.txt, golpes de frente con shang 10, 19 y 1238 (32-VISION §5: de frente dang ≈ 6.28); shflav nunca 0 con golpe: tipos de memoria (t-1) Mod 1000 + 1 (33-SHOTS §3.4) -->
<!-- 32-VISION §5 tabla de sectores: derecha 0.78-2.36 rad (156-472), atrás 2.36-3.92, izquierda 3.92-5.49 -->
`.shang` dice de dónde vino el último disparo que te pegó, como un ángulo
entre 0 y 1256 medido desde tu frente y girando hacia la derecha: 314 es de
la derecha, 628 de atrás y 942 de la izquierda. Un golpe de frente da un
valor cerca de 0 o cerca de 1256, según de qué lado del centro llegue.
Como [[.shflav]], llega con un ciclo de atraso, dura un ciclo y vale 0 si no
te pegó nada.

Como está medido en el mismo sentido que [[.aimdx]], copiarlo ahí te hace
girar justo hacia el tirador:

```adn
cond
*.shflav -1 =
start
*.shang .aimdx store
stop
```

En la prueba, un bot que recibió un disparo con `.shang` en 835 giró y en el
ciclo siguiente ya tenía al tirador en su [[.eye5]].

Para saber si hubo golpe, no mires `.shang`: un 0 o un valor muy chico
puede ser «no me pegaron» o «me pegaron de frente». Mirá `.shflav`, que
nunca vale 0 cuando hubo golpe. Si solo te importa el lado
y no el ángulo exacto, están [[.shup]], [[.shdn]], [[.shdx]] y [[.shsx]].
