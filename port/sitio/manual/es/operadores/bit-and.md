---
titulo: &
resumen: "Y bit a bit de los dos números del tope: deja prendidos solo los bits que están prendidos en los dos. Sirve para consultar y apagar marcas."
etiquetas: [bits, banderas, máscaras, paridad]
estado: revisada
---
<!-- 20-VM §6.3 (&: AND bit a bit); comprobado en el port -->

`a b &` saca dos números y deja otro que tiene prendidos solo los bits que
están prendidos en `a` _y_ en `b`. `12 10 &` da 8: en binario, 1100 y 1010
comparten solo el bit de valor 8.

| Pila antes | Después de `&` |
|---|---|
| `12 10` | `8` |
| `7 4` | `4` |
| `5 2` | `0` |

Tiene dos usos principales:

- **Consultar una marca**: `*50 4 &` deja 4 si el bit de valor 4 de la celda
  50 está prendido y 0 si no. Se completa con una comparación:
  `*50 4 & 0 !=`.
- **Apagar una marca**: con una máscara hecha con [[op:~]],
  `*50 4 ~ & 50 store` apaga ese bit y respeta los demás.

Un caso particular útil: `x 1 &` deja 1 si `x` es impar y 0 si es par. Con
[[.robage]] da un gen que corre un ciclo sí y uno no:

```adn
' avanza solo en los ciclos de edad par
cond
  *.robage 1 & 0 =
start
  10 .up store
stop
```

Con negativos trabaja sobre el complemento a dos: `-1` tiene todos los bits
prendidos, así que `x -1 &` deja `x` tal cual. Con la pila vacía opera sobre
ceros y da 0. El _o_ y el _o exclusivo_ son [[op:|]] y [[op:^]]; para
combinar verdaderos y falsos (no números) está [[op:and]].
