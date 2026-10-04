---
titulo: Avanzados
resumen: "Ángulos, distancias, raíces, potencias, trigonometría, topes y depuración: las cuentas que no son simple aritmética."
etiquetas: [geometría, ángulos, matemática, avanzados, depuración]
estado: revisada
---
<!-- 20-VM §6.2, §1 (ADCMDCOST solo value < 13); opcodes.yaml avanzados; conteo de uso en el Bestiario -->

Los avanzados toman números de la [[adn/pilas#entera|pila entera]] y dejan
uno, igual que los [[operadores/basicos|básicos]], pero hacen cuentas más
elaboradas. Se agrupan así:

- **Geometría**: [[op:angle]] (hacia dónde queda un punto), [[op:dist]] (a
  qué distancia), [[op:anglecmp]] (cuánto girar de un ángulo a otro) y
  [[op:pyth]] (el largo de un vector).
- **Topes**: [[op:ceil]] pone un máximo y [[op:floor]] un mínimo. Los nombres
  confunden: `ceil` es el _techo_, así que da el menor de los dos.
- **Matemática**: [[op:sqr]], [[op:pow]], [[op:root]] y [[op:logx]], todas
  con resultado entero redondeado.
- **Trigonometría**: [[op:sin]] y [[op:cos]], con el resultado multiplicado
  por 32000 para no perderlo en el redondeo.
- **Depuración**: [[op:debugint]] y [[op:debugbool]], que dejan la pila como
  está y anotan su valor para mirarlo desde la consola.

Los ángulos usan las mismas unidades que [[.aim]]: un giro completo son unas
1256 unidades (2π × 200), 0 apunta a la derecha y el ángulo crece en sentido
antihorario, así que 314 es hacia arriba.

En el Bestiario, los que aparecen en más bots, lejos, son `angle`, `floor` y
`ceil`. El primero, para apuntar a lo que se ve; los otros dos, para que un valor no se
salga de un rango.
<!-- conteo de bots del Bestiario: angle 284, floor 212, ceil 149; 1_3.txt (Saber) línea 559; sysvars.yaml .venval (836) -->
_Saber_, de abyaly, calcula el valor que su veneno le escribe a la
víctima ([[.venval]]) y lo deja entre 5 y 50 en una sola línea:

```adn
cond
start
  1000 *.refbody div 50 ceil 5 floor .venval store
stop
```

Cada avanzado ejecutado cuesta [[param:cost:3]] (gratis con las reglas F1),
salvo `debugint` y `debugbool`, que no cuestan nunca.
