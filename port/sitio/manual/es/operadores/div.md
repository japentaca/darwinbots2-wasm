---
titulo: div
resumen: "Divide el número de abajo por el de arriba y redondea al entero más cercano (al par en el empate); dividir por cero da 0."
etiquetas: [aritmética, división, redondeo, básicos]
estado: revisada
---
<!-- 20-VM §0.5, §6.1 (div: real con redondeo bancario; b = 0 → 0); comprobado en el port -->

`a b div` deja `a / b` redondeado. Tiene dos particularidades que conviene
saber de memoria:

- **No trunca, redondea** al entero más cercano, y cuando el resultado cae
  justo en el medio, al par: `7 2 div` da 4, `5 2 div` da 2, `100 7 div` da
  14 y `-7 2 div` da −4.
- **Dividir por cero da 0**, sin error.

```adn
cond
start
  7 2 div 50 store
  5 2 div 51 store
  10 0 div 52 store
stop
```

Las celdas 50, 51 y 52 terminan en 4, 2 y 0.

Lo de dividir por cero tiene un uso conocido en el Bestiario: `x dup div` vale
1 si `x` no es cero y 0 si lo es, y con eso se arman condiciones sin
condiciones (lo cuenta [[adn/operadores]], con el ejemplo de Bardus). Lo de
redondear importa al convertir unidades: `*.nrg 3 div` no es la división
entera de otros lenguajes. Si necesitás el resto, está [[op:mod]].
