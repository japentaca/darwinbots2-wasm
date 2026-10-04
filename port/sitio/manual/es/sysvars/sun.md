---
titulo: .sun
resumen: "Vale 1 cuando el bot apunta hacia arriba de la pantalla (con unos 10 grados de margen); no tiene que ver con la luz."
etiquetas: [rumbo, sentido, brújula]
estado: revisada
---
<!-- sysvars.yaml .sun (aim entre 1,39 y 1,75 rad = 278..350) -->
Pese al nombre, `.sun` no mide luz ni sol: es una brújula. Vale 1 cuando el bot
apunta hacia arriba de la pantalla, con un margen de unos 10 grados para cada
lado, y 0 en cualquier otra dirección. En la escala de [[.aim]], se enciende entre
278 y 350 (314 es arriba exacto).

Para saber si es de día o si le da el sol a un vegetal, la que sirve es
[[.daytime]].

El motor la publica al final del ciclo, con el rumbo ya girado, y en el primer
ciclo de vida vale 0. Es una forma barata de orientarse sin hacer cuentas con
`.aim`, por ejemplo para buscar el norte girando de a poco:

```adn
' gira hasta quedar mirando hacia arriba
cond
*.sun 0 =
start
20 .aimsx store
stop
```

<!-- probado: se para en .aim 280 con .sun 1 -->
Este bot se detiene en el primer rumbo que cae dentro de la franja (cerca de 280,
si arrancó más abajo). Para apuntar exactamente hacia arriba es más directo
`314 .setaim store`.
