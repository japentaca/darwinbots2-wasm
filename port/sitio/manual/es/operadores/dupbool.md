---
titulo: dupbool
resumen: "Duplica el valor de arriba de la pila booleana. Sirve para guardar una condición y usarla de nuevo, por ejemplo para anidar condiciones en el cuerpo."
etiquetas: [pila booleana, condiciones, duplicar, anidar]
estado: revisada
---
<!-- 20-VM §6.5 (dupbool: vacía no-op), §3 (asimetría con dup); Bestiario: This_n_That_1.01_F2_Peksa_-_12.05.08.txt; comprobado en el port -->

`dupbool` apila una copia del valor de arriba de la pila booleana. Con la pila
vacía no hace nada.

Su uso es anidar condiciones dentro del cuerpo: guardás una copia de la
condición de afuera, la combinás con una de adentro usando [[op:and]], y al
terminar un [[op:dropbool]] te devuelve la de afuera intacta para la siguiente.
El bot _This'n'That 1.01_ (Peksa), del Bestiario, lo hace para equilibrar
energía ([[.nrg]]) y cuerpo ([[.body]]):

```adn
' This'n'That 1.01 (Peksa): equilibra energía y cuerpo
cond
start
  *.nrg *.body !%= dupbool
  *.nrg *.body > and
  *.nrg *.body sub 100 ceil .strbody store dropbool
  *.body *.nrg > and
  *.body *.nrg sub 100 ceil .fdbody store
stop
```

La condición de afuera es «energía y cuerpo difieren en más de un 10 %»
([[op:!%=]]). La pila booleana pasa por:

| Después de | Pila booleana (tope a la derecha) |
|---|---|
| `!%= dupbool` | difieren, difieren |
| `> and` | difieren, (difieren y sobra energía) |
| `dropbool` | difieren |
| `> and` | (difieren y sobra cuerpo) |

Así, si sobra energía la pasa al cuerpo ([[.strbody]]) y si sobra cuerpo lo
pasa a energía ([[.fdbody]]), de a 100 como mucho ([[op:ceil]] se queda con el
menor). Un bot que arranca con 3000 de energía y 1000 de cuerpo se detiene en
1300 y 1170.

:::nota
`dupbool` no es simétrico con [[op:dup]]: sobre la pila entera vacía, `dup`
apila dos ceros; sobre la booleana vacía, `dupbool` no apila nada.
:::
