---
titulo: mod
resumen: "Deja el resto de dividir el número de abajo por el de arriba, con el signo del dividendo; con divisor 0 da 0."
etiquetas: [aritmética, resto, ciclos, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (mod: truncado, signo del dividendo; b = 0 → 0 consumiendo a); comprobado en el port -->

`a b mod` deja el resto de la división entera de `a` por `b`. `17 5 mod` da
2, `20 5 mod` da 0.

Su uso estrella es hacer cosas cada tantos ciclos: `*.robage 20 mod` vale 0
una vez cada 20 ciclos de vida ([[.robage]]). Este bot da un cuarto de
vuelta a la izquierda ([[.aimsx]]) cada 20 ciclos:

```adn
cond
  *.robage 20 mod 0 =
start
  314 .aimsx store
stop
```

También sirve para que un contador dé la vuelta: `*50 1 add 10 mod 50 store`
hace que la celda 50 recorra 0, 1… 9 y vuelva a 0.

Con negativos, **el resto lleva el signo del dividendo** (el de abajo):
`-7 3 mod` da −1 y `7 -3 mod` da 1. Si `a` puede ser negativo y necesitás un
resto entre 0 y `b − 1`, sumale `b` y volvé a aplicar `mod`:
`a 3 mod 3 add 3 mod`.

Dividir por cero no da error: `7 0 mod` saca los dos números y deja 0.
