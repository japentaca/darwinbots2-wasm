---
titulo: Básicos
resumen: "La aritmética del ADN (suma, resta, producto, división, resto, signo, azar) y las herramientas para acomodar la pila entera."
etiquetas: [aritmética, pila, operadores, básicos]
estado: revisada
---
<!-- 20-VM §6, §6.1, §3; opcodes.yaml basicos -->

Los básicos son de dos clases, y todos trabajan solo con la
[[adn/pilas#entera|pila entera]]: sacan de ahí sus operandos y dejan ahí el
resultado.

- **Cuentas**: [[op:add]], [[op:sub]], [[op:mult]], [[op:div]], [[op:mod]],
  [[op:sgn]], [[op:abs]] y [[op:rnd]], más [[op:*]], que lee la memoria en
  una dirección calculada.
- **Manejo de la pila**: [[op:dup]], [[op:drop]], [[op:swap]], [[op:over]] y
  [[op:clear]]. No calculan nada, solo reacomodan lo que hay.

Las que más vas a escribir son `add`, `sub`, `mult` y `div`, casi siempre
para ajustar una lectura antes de guardarla (`*.nrg 10 div`), y `rnd` para
darle al bot algo de azar. Las de pila sirven cuando un valor hace falta dos
veces: `dup` evita leer dos veces la misma celda.

Como en todo el ADN, el orden es _operandos primero_: `a b sub` es `a − b`, y
el que está más abajo en la pila es el primer operando. Ninguno falla: con la
pila vacía trabajan con ceros. Y en la pila entera caben números mucho más
grandes que en la memoria, así que un resultado intermedio de 90000 no es
problema mientras lo achiques antes de guardarlo (ver
[[adn/numeros#recorte]]).

Una idea de uso que combina varios: un contador que va de 0 a 9 y vuelve a
empezar, guardado en la celda 50, y un gen que aprovecha la vuelta para
hacer algo cada 10 ciclos.

```adn
cond
start
  *50 1 add 10 mod 50 store
stop

cond
  *50 0 =
start
  1256 rnd .setaim store
stop
```

Cada operador básico ejecutado cuesta [[param:cost:2]] (gratis con las
reglas F1). El panorama de todas las familias está en [[adn/operadores]].
