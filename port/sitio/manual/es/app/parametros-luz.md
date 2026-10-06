---
titulo: "Parámetros: Luz y día/noche"
resumen: "Cuándo y dónde hay sol: el ciclo de día y noche, la franja de sol al azar, los umbrales que prenden o apagan el sol según la energía del mundo y el modo estanque."
etiquetas: [luz, sol, día y noche, estanque, umbrales]
estado: revisada
---
<!-- engine/opciones.js grupo 'luz' (opt:30-41); CONTROLES_BASICOS 'dia-noche'; 50-MUNDO §2.2; core vegs.hpp feedvegs -->

[[param:base:maxEnergy]] dice cuánto da el sol; este grupo dice **cuándo** y
**dónde** lo da. Hay cuatro mecanismos, que se pueden combinar:

| Mecanismo | Parámetros | Qué hace |
|---|---|---|
| Día y noche | [[param:opt:33]], [[param:opt:34]] | El sol se prende y se apaga con un reloj. |
| Sol al azar | [[param:opt:40]] | Solo una franja vertical del campo recibe luz, y se mueve. |
| Umbrales | [[param:opt:35]], [[param:opt:37]] y sus ajustes | El sol se prende o se apaga según la energía total del mundo. |
| Estanque | [[param:opt:30]], [[param:opt:31]], [[param:opt:32]] | La luz se debilita con la profundidad. |

Sin tocar nada, la app arranca con sol pleno siempre, en todo el campo. La base
**Liga F1** enciende solo el sol al azar. De noche ningún bot fotosintetiza,
pero los costos se siguen cobrando, así que las noches largas son una presión
fuerte sobre los vegetales y sobre los animales que viven de ellos. Los bots
se enteran por [[.daytime]].

La mecánica completa está en la página de los cloroplastos, en
[[simulacion/cloroplastos#dia-y-noche|Día y noche]] y
[[simulacion/cloroplastos#franja|La franja del sol]]. En el modo básico de Experimentar, el
control **Día y noche** maneja a la vez los dos primeros parámetros: 0 apaga
el reloj y cualquier otro número lo prende con esa duración.

:::parametro opt:33
<!-- core vegs.hpp reloj (DayNightCycleCounter > CycleLength → !Daytime); comprobado: planta.txt con opt:33=1, opt:34=3 → 3 ciclos de sol, 4 de noche, 4 de sol -->
Prende el reloj del día y la noche: el sol se apaga y se prende solo, con
tramos que duran [[param:opt:34]] ciclos más uno. Apagado (como arranca la
app), el estado queda anclado en lo que diga [[param:opt:41]], que normalmente es
de día.

En una prueba con 3 de medio período, un vegetal comió tres ciclos, pasó
cuatro a oscuras y volvió a comer cuatro: solo el primer día dura uno menos.
:::

:::parametro opt:34
<!-- core vegs.hpp (contador > CycleLength); opciones.js ent(500, 1, 32000) -->
Cuánto dura cada tramo de luz o de oscuridad, en ciclos: en realidad dura uno
más que este número, así que con 500, el valor de la app, hay 501 ciclos de sol
y 501 de noche. Solo cuenta con [[param:opt:33]] encendido.

Un período corto alterna rápido y un vegetal con reservas casi no lo nota; uno
largo obliga a guardar energía para la noche o a adaptarse, como hace
_Chloroplastus_ del Bestiario (ver [[simulacion/cloroplastos#tener|tener cloroplastos]]).
:::

:::parametro opt:40
<!-- 50-MUNDO §0.3, §2.2 (banda móvil); core vegs.hpp feedvegs (SunPosition/SunRange); wasm db_sim_options_ok (al apagarlo, el sol vuelve al campo entero) -->
Con este parámetro solo recibe sol una franja vertical del campo, de arriba
abajo, que se corre despacio y cambia de rumbo y de ancho cada tanto (en
promedio, una vez cada 2000 ciclos). Su ancho va de un cuarto del campo al
campo entero. Fuera de la franja ningún cloroplasto produce, aunque sea de día.
La app lo trae apagado; la **Liga F1** lo enciende.

Crea estaciones: un vegetal quieto pasa por épocas largas de sol y de sombra,
y uno que se mueve puede seguir a la luz. Si lo apagás en una simulación que
está corriendo, el sol vuelve a cubrir el campo entero. Ver
[[simulacion/cloroplastos#franja|la franja del sol]].
:::

:::parametro opt:35
<!-- core vegs.hpp (TotalSimEnergyDisplayed < SunUpThreshold && SunUp); robots.hpp (nrg + 10·body de todo bot que existe) y shots.hpp (energía de los −2 en vuelo); master.hpp paso 5 (valor del ciclo anterior) -->
Prende el sol cuando la energía total del mundo baja de [[param:opt:36]]. Sirve
para rescatar a una población que se está muriendo: si se acaba la comida,
llega luz aunque sea de noche. Qué hace exactamente con el reloj lo decide
[[param:opt:39]]. Apagado en la app.

La energía total suma la energía y diez veces el cuerpo de todos los bots,
cadáveres incluidos, más la energía de los regalos (disparos −2) en vuelo. Se
mide al final de un ciclo y se usa en el siguiente.
:::

:::parametro opt:36
<!-- opciones.js ent(500000, 0, 2147483647, 1000, 'i32') -->
El umbral de [[param:opt:35]], en unidades de energía; la app arranca con
500000. Para tener una escala: un bot recién sembrado con 3000 de energía y
1000 de cuerpo cuenta 13000, así que 500000 equivale a unos 38 bots así.
Conviene que quede por debajo de [[param:opt:38]].
:::

:::parametro opt:37
<!-- core vegs.hpp (TotalSimEnergyDisplayed > SunDownThreshold && SunDown); comprobado: planta.txt con 37=1, 38=5000 → come el primer ciclo y después no -->
Apaga el sol cuando la energía total del mundo pasa de [[param:opt:38]]. Es el
freno de una población que crece demasiado: sin luz, los vegetales dejan de
producir y la cadena entera adelgaza. Se cuenta igual que en
[[param:opt:35]]. Apagado en la app.

En una prueba con un solo vegetal (13000 de energía total) y el umbral en
5000, el vegetal comió en el primer ciclo, cuando todavía no había medida, y
después no volvió a ver el sol.
:::

:::parametro opt:38
<!-- opciones.js ent(1000000, 0, 2147483647, 1000, 'i32') -->
El umbral de [[param:opt:37]], en unidades de energía; la app arranca con
1000000, unos 77 bots recién sembrados. Si también usás [[param:opt:35]],
dejá este más alto que [[param:opt:36]]: entre los dos queda la franja de
energía en la que el sol sigue su curso normal.
:::

:::parametro opt:39
<!-- core vegs.hpp TEMPSUNSUSPEND (0: fuerza y OverrideDayNight, el reloj no avanza), PERMSUNSUSPEND (1: fija Daytime; con SunUp y SunDown a la vez, ignora el reloj), ADVANCESUN (2: contador a 0 y fija Daytime) -->
Qué hace un umbral cuando se cruza. Solo importa con [[param:opt:35]] o
[[param:opt:37]] encendidos:

- **suspende hasta el próximo ciclo** (0, el valor de la app): mientras la
  energía esté del otro lado del umbral, cada ciclo se fuerza el sol (o la
  oscuridad) y el reloj del día queda en pausa. Cuando la energía vuelve,
  el reloj sigue desde donde estaba.
- **suspende del todo** (1): el umbral cambia el estado del sol y el estado
  queda así hasta que lo cambie otra cosa (el reloj, si está prendido).
  Con los dos umbrales encendidos el reloj se ignora por completo: el sol se prende al bajar de [[param:opt:36]] y no se apaga hasta pasar
  [[param:opt:38]], como un termostato.
- **adelanta el sol** (2): el umbral pone el día (o la noche) y reinicia el
  reloj; cuando la energía vuelve, ese tramo dura entero (con el reloj
  apagado, el estado simplemente queda así).
:::

:::parametro opt:30
<!-- core vegs.hpp (Pondmode: depth = round(pos.y/2000 + 1), tok = LightIntensity / depth^Gradient); physics.hpp GravityForces (flotabilidad); comprobado: planta.txt con 30=1 y 31=0 → no come -->
El modo estanque: la luz entra por arriba con la fuerza de [[param:opt:31]] y
se debilita con la profundidad, según [[param:opt:32]]. En este modo
[[param:base:maxEnergy]] no se usa. Además, con gravedad hacia abajo
([[param:opt:20]]) y sin conectar arriba con abajo ([[param:opt:2]]), los bots
pueden flotar a la altura que elijan con [[.setboy]] (ver
[[simulacion/mundo#gravedad|gravedad, estanque y mareas]]).
:::

:::parametro opt:31
<!-- core vegs.hpp tok = LightIntensity / depth^Gradient, después /3,5 como MaxEnergy; comprobado: 31=100, vegetal a 12031 de profundidad (escalón 7) → +4,65 de energía por ciclo -->
La luz en la superficie del estanque, en las mismas unidades que
[[param:base:maxEnergy]]: en la franja de arriba del campo, un valor de 10 da lo
mismo que la energía solar en 10. Solo cuenta con [[param:opt:30]] encendido.

La app la trae en 0, y eso significa que **al encender el estanque sin tocar
este valor, nadie fotosintetiza**. En una prueba con 100, un vegetal de 16000
cloroplastos a 12000 de profundidad ganaba 4,65 de energía por ciclo, y uno
más cerca de la superficie, más.
:::

:::parametro opt:32
<!-- core vegs.hpp pow(depth, Gradient); profundidad en escalones de 2000 (1 arriba, 17 al fondo de 32000) -->
Cuánto se apaga la luz al bajar. La profundidad se cuenta en escalones de 2000
(1 arriba de todo, 17 en el fondo de un campo de 32000), y la luz de cada
escalón es [[param:opt:31]] dividido por el escalón elevado a este número. Con
1,02, el valor de la app, a 2000 de profundidad llega la mitad de la luz y al
fondo, alrededor de una dieciochava parte. Con 0 la luz es igual en todo el
estanque; con 2, al fondo llega 1/289. Solo cuenta con [[param:opt:30]]
encendido.
:::

:::parametro opt:41
<!-- core vegs.hpp FeedThisCycle = Daytime; reloj lo invierte; PERMSUNSUSPEND y ADVANCESUN escriben Daytime, TEMPSUNSUSPEND solo FeedThisCycle; comprobado: planta.txt con 41=0 → no come, .daytime 0 -->
El estado del sol en este momento: de día o de noche. Con el reloj
([[param:opt:33]]), o con un umbral que actúa en los modos **suspende del todo**
o **adelanta el sol** ([[param:opt:39]]), el motor lo cambia solo y este
parámetro sirve para leerlo o para forzar un cambio en una simulación que está
corriendo. En el modo **suspende hasta el próximo ciclo**, el umbral prende o
apaga el sol sin tocar este estado. Sin reloj, en cambio, se queda donde lo pongas: apagado es **noche
para siempre**. En una prueba, un vegetal con este parámetro en «no» no ganó
nada y leyó [[.daytime]] en 0 todo el tiempo.
:::
