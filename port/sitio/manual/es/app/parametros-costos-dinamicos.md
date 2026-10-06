---
titulo: "Parámetros: Costos dinámicos"
resumen: "El multiplicador que escala todos los costos, el ajuste que lo mueve solo para llevar la población a un objetivo y el freno que pone todo gratis cuando quedan pocos bots."
etiquetas: [costos, multiplicador, población, parámetros, costos dinámicos]
estado: revisada
---
<!-- opciones.js «Costos dinámicos»; core master.hpp DynamicCostsStep (Master.bas:240-300); 10-CICLO §2 pasos 6-7 -->

Todos los precios del grupo [[app/parametros-costos]] se multiplican por un mismo
número, el [[param:cost:54]]. Este grupo trae ese multiplicador y dos mecanismos
que lo mueven solos mientras la simulación corre:

- **El ajuste dinámico**, un termostato: sube el multiplicador cuando sobran bots
  y lo baja cuando faltan, para acercar la población a un objetivo. Sirve para
  corridas largas de evolución, donde querés que la población no explote ni se
  extinga sin estar vos encima.
- **El freno de emergencia**: si la población cae por debajo de un umbral, todo
  pasa a ser gratis hasta que se recupere. Funciona aunque el ajuste esté
  apagado.

Con los valores de fábrica los dos están apagados y el multiplicador queda anclado en
1. El mecanismo paso a paso, con las cuentas, está en
[[simulacion/ciclo#costos-dinamicos]]; acá va qué hace cada perilla y cómo
combinarlas.

## Qué población cuenta {#poblacion}
<!-- master.hpp: totnvegsDisplayed (+ totvegsDisplayed con 61); PopulationLast10Cycles se desplaza cada 10 ciclos (10 casillas); DynamicCountdown 10 (ajusta con la población igual a la de hace cien ciclos solo cuando llega a 0); comprobado: en los dos primeros ciclos la cuenta vale 0 -->

Los dos mecanismos miran la misma cifra: los bots que no son vegetales (más los
vegetales, si activás [[param:cost:61]]). La cuenta llega con un par de ciclos de
atraso, así que en los primeros ciclos de una simulación vale 0 aunque el mundo
esté lleno.

El ajuste, además, compara esa cifra con la de unos cien ciclos atrás. Solo sube
el multiplicador si la población, además de estar por encima de la banda, creció;
y solo lo baja si, además de estar por debajo, bajó. Si la población queda
anclada en el mismo número que hace cien ciclos, ajusta igual, pero recién
después de diez ciclos así.

## Cómo usarlo {#como-usarlo}
<!-- comprobado: 5 bots, store a 1, objetivo 1, sensibilidad 100000 → el gasto por ciclo sube 0,04 por ciclo; con margen superior 500 % no cambia -->

1. Poné precios en [[app/parametros-costos]]: si todo cuesta 0, mover el
   multiplicador no cambia nada.
2. Elegí la [[param:cost:53|población objetivo]], la población que querés sostener.
3. Si no te molesta que la población oscile, dejá una banda tranquila con
   [[param:cost:57]] y [[param:cost:58]].
4. Activá [[param:cost:56]].
5. Si el multiplicador reacciona muy lento o muy brusco, ajustá
   [[param:cost:55]].

Cada ciclo fuera de la banda, el multiplicador se mueve 0,0000001 × (bots de
más o de menos, contados desde el borde de la banda) × [[param:cost:55]]. Con la
sensibilidad de fábrica (50) y 200 bots sobre un objetivo de 100, sube 0,0005 por
ciclo: medio punto cada mil ciclos. Es un termostato lento a propósito, porque
la población tarda en responder a los precios.

Para ver cuánto vale el multiplicador en cada momento, la interfaz clásica lo
muestra en su barra de estado (como _CostX_) cuando no vale 1. Los bots no lo
pueden leer: lo notan en lo rápido que les baja la energía.

Si la simulación juega por rondas ([[app/parametros-modos]]), la ronda nueva
arranca con el multiplicador tal como lo dejó el ajuste, no con el valor que
pusiste al principio.

:::parametro cost:56
<!-- master.hpp: C[USEDYNAMICCOSTS] != 0; la UI escribe -1 -->
Enciende el termostato: a partir de ahí el motor ajusta [[param:cost:54]] al
principio de cada ciclo, antes de que corra el ADN, así que ese mismo ciclo ya se
paga con el precio nuevo. Apagarlo deja el multiplicador donde estaba, no lo
devuelve al valor inicial. Con la [[param:cost:53|población objetivo]] en 0 (como viene), cualquier
población que no sea 0 está por encima del objetivo, y encenderlo solo sirve para
que los precios suban y suban.
:::

:::parametro cost:53
<!-- AmountOff = población − objetivo -->
La población, en bots, a la que apunta el ajuste. Cuenta solo los que no son
vegetales, salvo que actives [[param:cost:61]]. Sin [[param:cost:56]] encendido no
hace nada. Elegila pensando en el tamaño del campo y en cuánta comida hay: si el
mundo no puede alimentar a tantos bots, el multiplicador va a bajar hasta 0 y
quedarse ahí.
:::

:::parametro cost:55
<!-- corrección = 0,0000001 × exceso × sensibilidad; comprobado con 100000 → 0,04 por ciclo con 4 de exceso -->
Qué tan fuerte reacciona el ajuste: cada paso es 0,0000001 × los bots fuera de la
banda × este número. Con 0, el termostato está encendido pero no mueve nada. Con
valores muy altos el multiplicador se dispara en pocos ciclos y la población
oscila, porque el motor sigue corrigiendo antes de que los bots alcancen a
responder.
:::

:::parametro cost:57
<!-- UpperRange = % × 0,01 × objetivo; comprobado: objetivo 1, margen 500 %, 5 bots → sin ajuste -->
Un margen por encima del objetivo, en porcentaje del objetivo, dentro del cual el
ajuste no sube el multiplicador. Con el objetivo en 200 y el margen en 10, la
población puede llegar a 220 sin que cambie nada. Lo que se corrige es solo el
exceso sobre el borde de la banda, no sobre el objetivo.
:::

:::parametro cost:58
<!-- LowerRange = % × 0,01 × objetivo -->
El margen por debajo del objetivo, en porcentaje del objetivo, dentro del cual el
ajuste no baja el multiplicador. Con el objetivo en 200 y el margen en 25, la
población puede caer hasta 150 sin que los precios bajen. Con los dos márgenes en
0 (de fábrica) el termostato corrige con un solo bot de diferencia.
:::

:::parametro cost:61
<!-- master.hpp: CurrentPopulation += totvegsDisplayed si != 0 -->
Suma los vegetales a la población que cuentan el ajuste y el freno. Tiene sentido
cuando los vegetales son parte de lo que querés regular, por ejemplo en un mundo
de solo vegetales. Si los vegetales se repueblan solos (ver
[[app/parametros-energia]]), contarlos hace que el termostato reaccione a algo que
los bots no controlan.
:::

:::parametro cost:54
<!-- vm.hpp Costs::of; comprobado: store a 1 con multiplicador 2 → −2, 0 → 0, −1 → +1 por ciclo -->
El número por el que se multiplican todos los costos de [[app/parametros-costos]]:
en 1 (de fábrica) los precios valen lo que dicen, en 0 todo es gratis, en 2 todo
cuesta el doble. Escrito a mano, puede ser negativo y convertir los costos en
pagos: con −1, cada `store` le da energía al bot en lugar de cobrarle. Si el
ajuste dinámico está encendido, el valor que pongas es el punto de partida y el
motor lo va moviendo desde ahí.
:::

:::parametro cost:62
<!-- master.hpp: piso en 0 salvo ALLOWNEGATIVECOSTX == 1 exacto (la app escribe 1) -->
Deja que el ajuste dinámico lleve el multiplicador por debajo de 0. Apagado (de
fábrica), el termostato nunca baja de 0: en el peor caso todo es gratis. Encendido,
si la población sigue cayendo, los costos se vuelven pagos y cada acción le da
energía al bot. Es una forma extrema de rescatar una población, que también
premia a los bots que más gastan.
:::

:::parametro cost:52
<!-- master.hpp :293-300: corre siempre, fuera del gate; población < nivel y multiplicador != 0 → guarda y pone 0 -->
El umbral del freno de emergencia: si la población baja de este número, el
multiplicador pasa a 0 y nada cuesta. El valor anterior queda guardado para
reponerlo cuando la población supere
[[param:cost:59|el nivel de reposición]]. Funciona aunque
[[param:cost:56]] esté apagado. Con −1 (de fábrica) no actúa nunca, porque la
población no puede ser negativa. Como la cuenta vale 0 en los primeros ciclos, con
cualquier valor positivo la simulación arranca con los costos en 0.
:::

:::parametro cost:59
<!-- comprobado: 3 bots, freno en 10 y reposición en 0 → el store cobra un ciclo sí y otro no; reposición en 20 → nunca cobra -->
La población que tiene que superarse para que vuelvan los costos después de que
actuó [[param:cost:52|el freno]]; el multiplicador vuelve al valor que tenía antes del freno.
Ponelo **por encima** del umbral del freno, para dejar que la población se
recupere antes de cobrarle de nuevo. Si queda por debajo, el freno y la reposición
se pisan: en una prueba con 3 bots, el freno en 10 y la reposición en 0 (como
viene), los costos se cobraron un ciclo sí y otro no.
:::
