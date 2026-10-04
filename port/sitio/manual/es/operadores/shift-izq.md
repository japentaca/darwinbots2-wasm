---
titulo: <<
resumen: "Corre los bits del número del tope un lugar a la izquierda, o sea lo multiplica por 2: 5 << deja 10."
etiquetas: [bits, multiplicar, máscaras]
estado: revisada
---
<!-- 20-VM §6.3 (<<: shift de 1 bit; edge 2^30 << → 0); comprobado en el port -->

`x <<` saca un número, corre todos sus bits un lugar a la izquierda (entra un
0 por la derecha) y apila el resultado. En la práctica es multiplicar por 2:
`5 <<` da 10 y `-3 <<` da −6. Corre un solo lugar; para multiplicar por 8 hay
que escribirlo tres veces:

| Pila antes | Palabra | Pila después |
|---|---|---|
| `1` | `<<` | `2` |
| `2` | `<<` | `4` |
| `4` | `<<` | `8` |

Sirve para fabricar la potencia de 2 que corresponde a una marca, la máscara
que después usan [[op:|]] y [[op:&]]:

```adn
' prende el bit de valor 8 de la celda 50
cond
start
  *50 1 << << << | 50 store
stop
```

La diferencia con `2 mult` aparece recién con números de más de mil millones,
lejos de lo que entra en la memoria: [[op:mult]] se planta en dos mil
millones, mientras que `<<` puede cambiar el signo del número, y sobre
1073741824 (2³⁰) da 0, una rareza heredada del DarwinBots 2.48.32. Recordá
también que el resultado se recorta a ±32000 recién al guardarlo (ver
[[adn/numeros#recorte]]).

Con la pila vacía deja 0. El corrimiento a la derecha es [[op:>>]].
