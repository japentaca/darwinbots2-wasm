---
titulo: .repro
resumen: "Ordena una reproducción asexual: el número es el porcentaje de energía, cuerpo y cloroplastos que se lleva el hijo."
etiquetas: [reproducción, asexual, acción]
estado: revisada
---
<!-- 36-REPRO §2 (reparto: hijo nnrg·0,999, padre nrg − nnrg − nnrg·0,001); comprobado: 30 % de 3000/1000 deja 899,1/300 al hijo y 2099,1/700 al padre -->
Escribí un porcentaje y, si se puede, el bot tiene un hijo al final de ese mismo
ciclo. Con `30 .repro store` y 3000 de energía y 1000 de cuerpo, el hijo nace con
unos 900 de energía y 300 de cuerpo, y el padre se queda con unos 2100 y 700 (en el
traspaso se pierde una milésima parte). Los cloroplastos y los desechos se reparten
igual.

```adn
' Se divide en dos cuando junta energía
cond
 *.nrg 6000 >
start
 50 .repro store
stop
```

<!-- 36-REPRO §0.4, §0.5, §2 (guardas en orden; colisión en el punto de parto) -->
Lo que tenés que saber:

- **Módulo 100.** Se usa el resto de dividir por 100: `100` es 0 (nunca hay hijo) y
  `150` vale 50. Un valor de 0 o negativo no hace nada.
- **Persiste hasta el éxito.** El motor borra `.repro` solo cuando nace el hijo. Si
  el parto falla, la orden sigue ahí y se reintenta cada ciclo, aunque el gen que la
  escribió ya no corra. Para cancelarla, escribí `0 .repro store`.
- **Por qué puede fallar.** Si el bot tiene menos de 5 de cuerpo, si no tiene
  energía, o si el lugar donde tiene que aparecer el hijo está ocupado por otro bot,
  por un obstáculo o queda fuera del campo. Le pasa, por ejemplo, a un hijo
  que quiere reproducirse apenas nace, todavía pegado al padre.
- **Costo.** Además de la milésima que se pierde, el parto puede cobrar por el largo
  del ADN ([[param:cost:25]]).

<!-- 36-REPRO §1 (1 RNG entre repro y mrepro); port/README A1-5 (si procede la sexual, la asexual espera) -->
Si en el mismo ciclo hay `.repro` y [[.mrepro]], una moneda decide cuál de los dos
porcentajes se usa. Si el bot está fecundado y tiene [[.sexrepro]] escrita, ese
ciclo solo intenta la reproducción sexual y la asexual espera, aunque la sexual
termine fallando. El resto del
proceso está en [[sysvars/reproduccion]] y [[simulacion/reproduccion]].
