---
titulo: .shdx
resumen: "El tipo del disparo que te pegó por la derecha en el ciclo anterior; 0 si no te pegó ninguno por ese lado."
etiquetas: [disparos, sentidos, defensa]
estado: revisada
---
<!-- 32-VISION §5 (sector derecha: dang 0.78-2.36); sysvars.yaml 212; core senses.hpp taste -->
`.shdx` guarda el tipo del disparo (el mismo número que [[.shflav]]) cuando
ese disparo te pegó por la derecha, dentro de un cuarto de vuelta centrado en
tu costado derecho. Si te pegó por otro lado, o no te pegó nada, vale 0. Sus
compañeras son [[.shup]], [[.shdn]] y [[.shsx]].

Llega con un ciclo de atraso y dura un ciclo. Un cuarto de vuelta son 314
unidades de giro, así que la respuesta directa es girar eso hacia la derecha
con [[.aimdx]]:

```adn
' me pegan por la derecha: giro hacia ese lado
cond
*.shdx 0 !=
start
314 .aimdx store
stop
```

Para apuntar con más precisión, usá el ángulo exacto de [[.shang]].
