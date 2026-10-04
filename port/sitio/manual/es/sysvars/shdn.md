---
titulo: .shdn
resumen: "El tipo del disparo que te pegó por la espalda en el ciclo anterior; 0 si no te pegó ninguno por atrás."
etiquetas: [disparos, sentidos, defensa]
estado: revisada
---
<!-- 32-VISION §5 (sector atrás: dang 2.36-3.92); sysvars.yaml 211; core senses.hpp taste -->
`.shdn` guarda el tipo del disparo (el mismo número que [[.shflav]]) cuando
ese disparo te pegó por atrás, dentro de un cuarto de vuelta centrado en tu
espalda. Si te pegó por otro lado, o no te pegó nada, vale 0. Es la pareja de
[[.shup]]; las de los costados son [[.shdx]] y [[.shsx]].

Llega con un ciclo de atraso y dura un ciclo. Contra un ataque por la espalda hay
dos respuestas típicas:
darse vuelta para pelear o devolverle el tiro sin frenar, con
[[.backshot]].

```adn
' me pegan por atrás: media vuelta
cond
*.shdn 0 !=
start
628 .aimdx store
stop
```

Para el ángulo exacto, en vez del lado, está [[.shang]].
