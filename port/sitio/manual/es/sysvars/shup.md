---
titulo: .shup
resumen: "El tipo del disparo que te pegó de frente en el ciclo anterior; 0 si no te pegó ninguno por adelante."
etiquetas: [disparos, sentidos, defensa]
estado: revisada
---
<!-- 32-VISION §5 (sector frente: dang > 5.49 o < 0.78); sysvars.yaml 210; core senses.hpp taste; probado: tira.txt (el -2 de vuelta llega de frente) -->
`.shup` guarda el tipo del disparo (el mismo número que [[.shflav]]) cuando
ese disparo te pegó por adelante: dentro de un cuarto de vuelta centrado en tu
frente, unos 45 grados para cada lado. Si te pegó por otro lado, o no te pegó
nada, vale 0. Sus compañeras son [[.shdn]] (atrás), [[.shdx]] (derecha) y
[[.shsx]] (izquierda); en cada golpe se llena una sola.

Llega con un ciclo de atraso y dura un ciclo. Un detalle: lo que más se
registra en `.shup` suele ser la energía que te devuelven tus propios
disparos de −1, que vuelve desde el blanco que tenés enfrente y marca −2.

```adn
' alguien me ataca de frente: le devuelvo el tiro
cond
*.shup -1 =
start
-1 .shoot store
stop
```

Para el ángulo exacto, en vez del lado, está [[.shang]].
