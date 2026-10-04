---
titulo: "Parámetros: Modo evolución"
resumen: "Los modos de evolución dirigida del original (depredador oculto, ZeroBot, prueba) y el peso con el que la app elige al bot más apto."
etiquetas: [evolución, depredador oculto, más apto, Base, Mutate, parámetros]
estado: revisada
---
<!-- opciones.js «Modo evolución»; core gamemodes.hpp (HidePredStep, HandicapStep, RestartModesStep, Fittest, calc_handycap), master.hpp paso 3; sim.hpp BaseHidden; 50-MUNDO §5 (capa de torneo); web2/engine/sim.js checkGameState (eventos evo/zerobot/seeding solo al registro) -->

El DarwinBots original tenía un _modo evolución_: un procedimiento automático para
hacer evolucionar un bot a partir de otro, que arrancaba simulaciones, guardaba
archivos y se reiniciaba solo durante horas. De todo eso, la app conserva lo que
pasa _dentro_ de la simulación, que es lo que controlan los tres primeros
parámetros de este grupo. El procedimiento de afuera (los archivos, las etapas,
el reinicio automático) no está: cuando una de estas simulaciones llega a su fin,
se detiene y nada más.

Son modos para experimentar con cuidado: dependen de especies con nombres fijos y
de valores que la app deja en 0. El cuarto parámetro, en cambio, es de uso diario:
decide qué bot elige **Buscar el mejor** en Observar.

## Los modos {#modos}
<!-- gamemodes.hpp: 1 seeding (DQ como F1; evento en el ciclo 2000), 4/5 hidepred, 7/8 ZeroBot (Fittest cada 50 ciclos; calculateZB: LastMut > 0 y robid distinto del anterior → ×1,15, mismo robid con Mx mayor → ×1,75 y parada; si no, solo evento), 9 test (Test.txt, ciclo 1 vs 8000); el resto no hace nada en el core -->

[[param:opt:92]] elige el modo. Los valores con efecto dentro de la simulación son
estos; los demás se comportan como el 0.

| Valor | Modo | Qué hace en la simulación |
|---|---|---|
| 0 | Normal | Nada: una simulación común. |
| 1 | Siembra | [[param:opt:93|Las reglas de descalificación]] se aplican como en un concurso F1. |
| 4 y 5 | Depredador oculto | Alterna épocas en que la especie **Base** desaparece del mundo y la especie **Mutate** recibe ayuda de energía (ver abajo). La simulación se detiene si se extingue una de las dos. |
| 7 y 8 | ZeroBot | Cada 50 ciclos busca al bot más apto; si es de la especie **Mutate**, ya mutó y es otro bot que la vez anterior o mejoró su puntaje, le sube las tasas de mutación. Se detiene si se extingue Mutate, o si el mejor sigue siendo el mismo bot y mejoró su puntaje (en el original, ahí pasaba a la etapa de prueba). |
| 9 | Prueba | Compara la energía de la especie **Test** en el ciclo 1 y en el 8000: si se duplicó y hay más de 10 animales, la prueba pasa. En el ciclo 8000 se detiene. |

Las especies se reconocen por el nombre exacto: tienen que llamarse `Base`,
`Mutate` o `Test` en el escenario.

## El depredador oculto {#depredador-oculto}
<!-- HidePredStep: alterna hidepred cuando ModeChangeCycles > hidePredCycl/1,2 + offset (offset al azar hasta hidePredCycl/3); al alternar borra disparos −1 y −6 y aparta a los Mutate de los Base; HandicapStep: Mutate con LastMut > 0 recibe el handicap entero, el resto la mitad; BaseHidden filtra a Base de ADN, física, visión, disparos y vegetales; Base extinto → evo_won_best = Fittest, que ni dbcore_api ni sim.js usan (solo log «evo: Base extinct») -->

La idea del modo 4 es entrenar a una especie, **Mutate**, contra un rival fijo,
**Base**, sin que el rival la extermine mientras aprende. Para eso, la simulación
alterna dos épocas:

1. **Con el depredador a la vista.** Las dos especies conviven y compiten
   normalmente.
2. **Con el depredador oculto.** Los bots de Base quedan congelados y fuera del
   mundo: no ejecutan su ADN, no se mueven, nadie los ve y no se les puede
   disparar. Mientras tanto, los bots de Mutate reciben en cada ciclo una
   compensación de energía, entera para los que acaban de mutar y la mitad para
   los demás.

Cuando termina una época oculta, antes de que Base vuelva, se borran los
disparos para comer que están en vuelo y los bots de Mutate que quedaron
demasiado cerca de uno de Base se apartan, para que la época nueva no empiece con
un ataque a quemarropa.

El modo termina mal si Mutate se extingue y bien si se extingue Base. En los dos
casos la simulación se detiene; en el original, al ganar se guardaba el bot más
apto (con el criterio de [[param:opt:96]]), y en la app ese paso no está.

:::parametro opt:92
<!-- u8; 0 normal; ver la tabla de arriba -->
Elige el modo de evolución dirigida de la tabla de arriba. De fábrica vale 0, una
simulación normal, y es lo que conviene salvo que estés reproduciendo un
experimento del original. Los modos 4 y 5 hacen lo mismo dentro de la
simulación, igual que el 7 y el 8: en el original se distinguían por lo que hacía
el procedimiento de afuera. Si las especies no se llaman como el modo espera, el
modo 4 se detiene en el primer ciclo porque no encuentra a Mutate.
:::

:::parametro opt:94
<!-- HidePredStep: umbral hidePredCycl/1,2 + hidePredOffset (Round(hidePredCycl/3 × rnd)); calc_handycap: rampa hasta hidePredCycl × 8 ciclos; con 0 alterna en cada ciclo -->
Cuánto dura cada época del depredador oculto, en ciclos: cada una dura entre 0,83
y 1,17 veces este valor, con una parte al azar para que los bots no puedan
aprenderse el reloj. También fija la rampa de la ayuda de energía, que crece
desde 0 hasta su valor completo durante los primeros 8 × este valor ciclos de la
simulación. Con 0 (de fábrica), las épocas cambian en cada ciclo y el modo no
sirve; para usarlo poné algunos miles.
:::

:::parametro opt:95
<!-- HidePredStep: holdXP = (...)/LFOR; con LFOR = 0 no se calcula (err11 registrado); LFOR = 150 y Mutate < Base con hidepred: la época oculta se estira -->
El divisor de la ayuda de energía de Mutate. El motor compara cuánto cambia por
ciclo la energía de los bots recién mutados en una época y en la otra, y mientras
el depredador está oculto les da esa diferencia dividida por este número: con un
valor más grande, la ayuda es menor y la evolución, más exigente. Con 0 (de
fábrica) la ayuda no se calcula y Mutate no recibe nada. En el tope, 150, la
época oculta se estira mientras haya menos bots de Mutate que de Base.
:::

:::parametro opt:96
<!-- gamemodes.hpp Fittest: s = (nrg + 10·body propios + de la descendencia viva hasta 10 generaciones); s' = (descendientes + 1)^p × s^e; e = min(v,100)/100, p = (v < 100 ? 1 : (200 − v)/100); database.hpp SnapshotFitness (misma cuenta); i18n observar.mejor -->
Cómo se elige al bot más apto. Para cada bot que no es vegetal ni cadáver, el
motor suma su _energía invertida_ (energía más 10 por punto de cuerpo) y la de
todos sus descendientes vivos, hasta diez generaciones, y combina ese total con la
cantidad de descendientes:

- en **100** (de fábrica), cuentan las dos cosas por igual: el puntaje es la
  energía invertida de la familia por la cantidad de descendientes más uno;
- por **debajo de 100**, la energía pesa menos, y en **0** solo cuenta la cantidad
  de descendientes;
- por **encima de 100**, los descendientes pesan menos, y en **200** solo cuenta
  la energía de la familia.

Este valor decide qué bot selecciona **Buscar el mejor** en Observar
([[app/observar]]) y la columna _Fitness_ de la instantánea de los vivos y del
registro de muertos ([[app/parametros-registro]]). En los modos ZeroBot y de
depredador oculto es también el criterio con el que el motor elige al mejor.
:::
