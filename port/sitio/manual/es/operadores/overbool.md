---
titulo: overbool
resumen: "Apila una copia del segundo valor de la pila booleana: a b pasa a a b a. Con un solo valor apila verdadero."
etiquetas: [pila booleana, condiciones, copiar]
estado: revisada
---
<!-- 20-VM §6.5 (overbool: vacía no-op; un elemento → verdadero), §3; comprobado en el port -->

`overbool` copia el valor que está segundo desde arriba en la pila booleana y
lo pone encima: `a b` pasa a `a b a`. Sirve para combinar dos condiciones
sin perder ninguna:

```adn
cond
start
  *.robage 3 >
  *.robage 6 <
  overbool and
  50 inc
  dropbool
  51 inc
  clearbool
stop
```

| Después de | Pila booleana (tope a la derecha) |
|---|---|
| las dos comparaciones | mayor que 3, menor que 6 |
| `overbool` | mayor que 3, menor que 6, mayor que 3 |
| `and` | mayor que 3, (menor que 6 y mayor que 3) |
| `dropbool` | mayor que 3 |

La celda 50 cuenta los ciclos con edad ([[.robage]]) 4 o 5, y la 51 todos los
de edad mayor que 3: después de 10 ciclos valen 2 y 6.

:::cuidado
Con **un solo** valor en la pila, `overbool` no lo copia: apila un
_verdadero_ (el segundo valor no existe, y lo que falta en la pila booleana
cuenta como verdadero). Con la pila vacía no hace nada. Es una asimetría con
[[op:over]], que en el mismo caso apila un 0.
:::

Para tener dos copias del de arriba está [[op:dupbool]].
