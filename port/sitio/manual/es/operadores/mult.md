---
titulo: mult
resumen: "Multiplica los dos números de arriba de la pila entera; si el producto pasa de 2000 millones, se queda en ese tope."
etiquetas: [aritmética, producto, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (mult satura ±2·10⁹), §7 (mod32000 al guardar); comprobado en el port -->

`a b mult` deja `a · b`. Sirve para escalar una lectura (`*.eye5 2 mult`),
para armar números más grandes que el literal máximo (`200 200 mult` da
40000) y, junto con [[op:div]], para cuentas proporcionales.

| Palabra | Pila después |
|---|---|
| `300` | 300 |
| `300` | 300 300 |
| `mult` | 90000 |

A diferencia de [[op:add]] y [[op:sub]], que dan la vuelta, `mult`
**satura**: si el producto pasa de 2000 millones (para un lado o para el
otro), deja exactamente ±2000000000.

Lo que sí hay que tener en cuenta es el recorte al guardar. La pila aguanta
el 90000, pero una celda de memoria no:

```adn
cond
start
  300 300 mult 50 store
  300 300 mult 300 div 51 store
stop
```

La celda 50 termina en 26000 (el resto de dividir 90000 por 32000) y la 51 en
300, porque la división achicó el número antes de guardarlo. Ver
[[adn/numeros#recorte]].
