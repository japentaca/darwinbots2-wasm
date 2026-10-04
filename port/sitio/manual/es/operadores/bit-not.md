---
titulo: ~
resumen: "Invierte todos los bits del número del tope: x ~ deja −x − 1, así que 5 ~ da −6 y 0 ~ da −1."
etiquetas: [bits, banderas, máscaras]
estado: revisada
---
<!-- 20-VM §6.3 (~: complemento a uno); comprobado en el port -->

`~` saca un número, le da vuelta cada uno de sus 32 bits (los 0 pasan a 1 y
los 1 a 0) y apila el resultado. En complemento a dos eso equivale siempre a
`−x − 1`:

| Pila antes | Después de `~` |
|---|---|
| `5` | `-6` |
| `0` | `-1` |
| `-1` | `0` |
| `4` | `-5` |

Su uso típico es armar una _máscara_ para apagar un bit con [[op:&]]: `4 ~`
tiene prendidos todos los bits menos el de valor 4, y al hacer `&` con la
celda deja todo igual salvo ese bit.

```adn
' apaga el bit de valor 4 de la celda 50, sin tocar los demás
cond
start
  *50 4 ~ & 50 store
stop
```

Si la celda 50 valía 5 (bits de valor 1 y 4), queda en 1.

:::cuidado
`~` no es [[op:not]]. `not` invierte un verdadero o falso de la pila
booleana; `~` trabaja con números en la pila entera. `1 ~` da −2, que para
una comparación sigue siendo un número distinto de cero.
:::

Con la pila vacía opera sobre 0 y deja −1. Las otras operaciones de bits
están en [[operadores/bits]].
