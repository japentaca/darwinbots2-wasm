---
titulo: *<numero> | *.<sysvar>
resumen: "Un asterisco pegado a un número o a una sysvar apila el contenido de esa celda de memoria: es la forma de leer los sentidos y tus propias variables."
etiquetas: [lectura, memoria, asterisco, sentidos]
estado: revisada
---
<!-- 20-VM §1 (tipo 1), §4 (normalización Abs Mod 1000, 0 → 1000), §2.4 (.nombre desconocido = 0); 21-MEMORIA (latencia) -->

`*50` apila lo que hay en la celda 50; `*.nrg` apila lo que hay en la celda
de [[.nrg]], es decir la energía del bot. Es la palabra con la que un bot se
entera de todo: sus sentidos, su estado y lo que guardó en memoria libre.

Algunas cosas que conviene saber:

- **Los sentidos llegan con un ciclo de atraso.** El motor los publica
  después de que corre el ADN, así que en el primer ciclo de vida de un bot
  casi todo se lee en 0 (ver [[adn/ejecucion#retraso]]).
- **La dirección se normaliza.** Si está fuera de 1 a 1000, se le saca el
  signo y se toma el resto de dividir por 1000: `*1050` lee la celda 50 y
  `*0` lee la 1000.
- **Una sysvar mal escrita lee la celda 1000.** `*.nrgg` no existe, vale como
  `*0`, y apila lo que haya en la 1000 sin avisar (el [[app/editor|editor]] sí te lo
  marca).
- **La dirección va escrita en el ADN.** Si tiene que salir de una cuenta,
  usá el operador [[op:*]]: `60 *` lee lo mismo que `*60`, pero el 60 puede
  venir de la pila.

Este bot avanza solo cuando el ojo central ([[.eye5]]) ve algo:

```adn
cond
  *.eye5 0 >
start
  10 .up store
stop
```

Cada lectura cuesta [[param:cost:1]], que con las reglas F1 es 0. Más
en [[adn/numeros#leer]] y [[adn/memoria]].
