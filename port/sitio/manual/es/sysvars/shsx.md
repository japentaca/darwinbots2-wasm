---
titulo: .shsx
resumen: "El tipo del disparo que te pegó por la izquierda en el ciclo anterior; 0 si no te pegó ninguno por ese lado."
etiquetas: [disparos, sentidos, defensa]
estado: revisada
---
<!-- 32-VISION §5 (sector izquierda: dang 3.92-5.49); sysvars.yaml 213; core senses.hpp taste; probado: tira.txt contra blanco.txt (golpe por la izquierda: shsx -1, shang 835) -->
`.shsx` guarda el tipo del disparo (el mismo número que [[.shflav]]) cuando
ese disparo te pegó por la izquierda, dentro de un cuarto de vuelta centrado
en tu costado izquierdo. Si te pegó por otro lado, o no te pegó nada, vale 0.
Sus compañeras son [[.shup]], [[.shdn]] y [[.shdx]].

Llega con un ciclo de atraso y dura un ciclo. En la prueba, un bot al que le
disparaban desde su izquierda leyó `.shsx` en −1, y [[.shang]] en 835.

```adn
' me pegan por la izquierda: giro hacia ese lado
cond
*.shsx 0 !=
start
314 .aimsx store
stop
```

Para apuntar con más precisión, usá el ángulo exacto de `.shang`.
