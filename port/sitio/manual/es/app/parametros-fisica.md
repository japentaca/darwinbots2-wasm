---
titulo: "Parámetros: Física"
resumen: "El medio en que se mueven los bots: velocidad máxima, eficiencia del empuje, rozamiento, fluido, gravedad, rebote de los choques, empujones al azar, inercia y tamaño."
etiquetas: [física, movimiento, rozamiento, fluido, gravedad, choques]
estado: revisada
---
<!-- engine/opciones.js grupo 'fisica' (opt:10-21), MEDIOS, F1_OPTS; 30-FISICA; core physics.hpp -->

Estos parámetros definen el medio en que se mueven los bots: cuánto pueden
correr, qué los frena, qué los empuja y cómo chocan. Cambian mucho el tipo
de estrategia que conviene. En un mundo sin rozamiento, un bot que dejó de
empujar sigue andando para siempre; en uno con rozamiento fuerte, quedarse
quieto es gratis y moverse es caro.

En el modo básico de Experimentar, el control **Medio** fija de una vez cinco
de estos parámetros con los valores del DarwinBots original:

| Medio | [[param:opt:14]] | [[param:opt:15]] | [[param:opt:16]] | [[param:opt:17]] | [[param:opt:19]] |
|---|---|---|---|---|---|
| **Espacio** (como arranca la app) | 0 | 0 | 0 | 0 | 0 |
| **Fluido** | 0,0000001 | 0,0005 | 0 | 0 | 0 |
| **Sólido** (el de la **Liga F1**) | 0 | 0 | 0,6 | 0,4 | 2 |

Si cambiás alguno a mano, el control pasa a **Personalizado**. Todo lo que
pasa en las fases de _fuerzas y choques_ y de _movimiento_ está en
[[simulacion/fisica]], con ejemplos medidos; acá va lo que cambia cada
parámetro. Lo que cuesta moverse no está en este grupo sino en los costos
([[param:cost:20]], [[param:cost:21]]).

:::parametro opt:11
<!-- 30-FISICA §2.1, §6; core physics.hpp (recorte del empujón y de la velocidad en UpdatePosition; mem maxvel); comprobado: empuje.txt con 11=20, 12=1 → .velscalar y .maxvel 20 -->
El tope de la velocidad de un bot, en unidades por ciclo; los bots lo leen en
[[.maxvel]]. La app arranca con 40 y la **Liga F1** lo sube a 180. Recorta dos
cosas: la velocidad final de cada ciclo y el empujón que el bot puede darse
con [[.up]] y compañía, así que el costo de moverse tampoco pasa de este tope
(ver [[simulacion/fisica#empuje|el empuje voluntario]]).

Con 40, cruzar un campo de 32000 lleva al menos 800 ciclos.
:::

:::parametro opt:12
<!-- 30-FISICA §2.1 (VoluntaryForces: × PhysMoving después del recorte), GravityForces (flotabilidad / PhysMoving); comprobado: empuje.txt, 40 .up → .velscalar 26 con 0,66 -->
Qué fracción del empuje pedido se convierte en movimiento. Con 0,66, el valor
de la app y de la **Liga F1**, `40 .up store` le da a un bot liviano unos 26
de velocidad en el primer ciclo. El costo se calcula sobre el empuje pedido,
no sobre lo que rinde: bajar este valor encarece moverse sin abaratar nada.

Con 1 todo el empuje se aprovecha; con 0 los bots no se pueden mover por su
cuenta (la gravedad, los choques y los lazos los siguen moviendo). En el
modo estanque, flotar cuesta más cuanto más bajo es este valor.
:::

:::parametro opt:13
<!-- 30-FISICA §2 (BrownianForces: impulso = PhysBrown·0,5·rnd, dirección al azar, giro al azar); core robots.hpp mareas (pisa PhysBrown) -->
Empujones al azar: en cada ciclo, cada bot recibe un empujón en una dirección
al azar, de hasta la mitad de este valor, y un pequeño giro también al azar.
Como todo empujón, se divide por la masa, así que a los bots pesados apenas
los mueve. La app lo trae en 0.

Sirve para que nada quede del todo quieto: mezcla poblaciones y saca a los
vegetales de las posiciones fijas donde nacieron. Con mareas
([[param:opt:64]]) el motor lo reescribe en cada ciclo. Ver
[[simulacion/fisica#browniano|el movimiento browniano]].
:::

:::parametro opt:14
<!-- 30-FISICA §1.1 (AddedMass), §2 (SphereDragForces: sin arrastre con Density o Viscosity en 0) -->
La densidad del fluido. Junto con [[param:opt:15]], decide el arrastre: una
resta de velocidad que crece con la rapidez y con el radio del bot, y que no
depende de su masa. Si cualquiera de los dos vale 0, no hay arrastre. La
densidad además agrega _masa añadida_: el fluido que el bot arrastra consigo
le da más inercia, sin hacerlo más pesado para la gravedad.

La app la trae en 0; el agua del original es 0,0000001 (1e-7), que es lo que
pone el medio **Fluido**. Los valores útiles son muy chicos: el rango habitual
llega a 0,001. Ver [[simulacion/fisica#fluido|el fluido]].
:::

:::parametro opt:15
<!-- 30-FISICA §2 (SphereCd: Viscosity = 0 → Cd 0); fisica.md tabla «Fluido suave» (1e-7 / 0,00005) y «Agua» (1e-7 / 0,0005) -->
La viscosidad del fluido, la otra mitad del arrastre (ver
[[param:opt:14]]). La app la trae en 0; el agua del original, la del medio
**Fluido**, es 0,0005. Con esos valores un bot con el tope de 40 no pasa de 20
mientras empuja y se clava en cuanto deja de hacerlo; con una viscosidad diez
veces menor, se desliza varios ciclos. La tabla de
[[simulacion/fisica#fluido|el fluido]] compara los dos.
:::

:::parametro opt:16
<!-- 30-FISICA §2 (FrictionForces: solo con Zgravity ≠ 0; umbral masa·Zgravity·coef) -->
El rozamiento para arrancar. Si un bot está quieto y lo que lo empuja en ese
ciclo no supera masa × [[param:opt:19]] × este coeficiente, no se mueve, y el
empuje se cobra igual. Si ya se está moviendo, solo frena los empujes de
costado. Sin gravedad Z no hace nada.

La app lo trae en 0 y la **Liga F1** en 0,6: con eso, un bot de masa 1 necesita
pedir más de 1,8 de empuje (`2 .up store`) para arrancar. El umbral crece con
la masa, así que los bots muy pesados quedan clavados. Ver
[[simulacion/fisica#rozamiento|el rozamiento]].
:::

:::parametro opt:17
<!-- 30-FISICA §2 (FrictionForces: resta masa·Zgravity·coef de la rapidez, sin pasar de 0); fisica.md tabla «Rozamiento F1» -->
El rozamiento en movimiento: en cada ciclo le resta a la rapidez del bot masa
× [[param:opt:19]] × este coeficiente, sin dejarla negativa. No se divide por
la masa, así que frena mucho más a los pesados. Sin gravedad Z no hace nada.

La app lo trae en 0 y la **Liga F1** en 0,4: un bot de masa 1 pierde 0,8 de
rapidez por ciclo y, si deja de empujar a 40, se detiene en unos 50 ciclos.
:::

:::parametro opt:18
<!-- 30-FISICA §4.2, §4.3 (Repel3: corrección parcial de la superposición y choque con coeficiente e) -->
Cuánto rebotan los bots al chocar entre sí. Con 0, el valor de la app y de la
**Liga F1**, el choque es blando: en la dirección del golpe los dos terminan
con la misma velocidad, como si uno empujara al otro. Con 1 rebotan como bolas
de billar. También cambia cuánto se separan por ciclo dos bots superpuestos:
con 0 se deshace cerca de un cuarto de la superposición, con 1 casi toda.

Con rebote alto, un bot que embiste sale despedido; con choques blandos,
puede empujar a otro. Ver [[simulacion/fisica#choques|los choques entre bots]].
:::

:::parametro opt:19
<!-- 30-FISICA §2 (FrictionForces: Zgravity = 0 → sin rozamiento) -->
Una gravedad que no mueve a nadie: aprieta a los bots contra el «suelo» y es
la que hace funcionar el rozamiento. Los dos coeficientes ([[param:opt:16]] y
[[param:opt:17]]) se multiplican por ella, así que con 0 (como arranca la app)
no hay rozamiento aunque los coeficientes no sean 0. La **Liga F1** usa 2.
:::

:::parametro opt:20
<!-- 30-FISICA §2 (GravityForces: impulso Ygravity·masa → +Ygravity de velocidad por ciclo); comprobado en fisica.md (+1 por ciclo con 1) -->
La gravedad hacia abajo: en cada ciclo le suma este valor a la velocidad
vertical de cada bot, pese lo que pese. Con 1, un bot quieto cae a 1, 2, 3…
hasta el tope de velocidad. La app la trae en 0.

Con paredes, todo termina en el fondo; si arriba y abajo están conectados
([[param:opt:2]]), los bots caen para siempre. En el modo estanque
([[param:opt:30]]) es la que permite flotar con [[.setboy]]. Con mareas
([[param:opt:64]]) el motor la reescribe en cada ciclo. Ver
[[simulacion/fisica#gravedad|gravedad y flotabilidad]].
:::

:::parametro opt:10
<!-- 30-FISICA §6 (ZeroMomentum: vel = 0 al final de UpdatePosition); comprobado: empuje.txt con 10=1 → avanza 26 por ciclo mientras empuja y se frena en seco; .velscalar 26, .velup 0 -->
Sin inercia: al final de cada ciclo el motor anula la velocidad de todos. Un
bot avanza solo mientras empuja y se frena en seco cuando deja de hacerlo.
Nada se acumula de un ciclo para el otro: con gravedad 1, un bot cae siempre
1 por ciclo en lugar de ir cada vez más rápido. Apagado en la app.

En una prueba, un bot que empujaba 40 con la eficiencia por defecto avanzó 26
por ciclo, siempre lo mismo, y quedó quieto en el ciclo en que dejó de
empujar. Mientras se movía, [[.velscalar]] informaba 26, pero [[.velup]] y
[[.veldx]] leían 0.
:::

:::parametro opt:21
<!-- 30-FISICA §1.2 (FindRadius: FixedBotRadii → half = 60); vegs.hpp (el área de los bots tapa la luz) -->
Todos los bots miden lo mismo, 60 de radio, tengan el cuerpo o los
cloroplastos que tengan. La masa sigue cambiando como siempre; solo cambia el
tamaño, que decide cuándo dos bots se tocan, cuánto los frena el fluido y
cuánta luz tapan. Sin esta opción, un bot de 1000 de cuerpo mide 114 y uno
lleno de cloroplastos se acerca a 415 (ver [[simulacion/fisica#estado|el estado físico de un bot]]).
Apagado en la app.

Con radios fijos, engordar no te hace más fácil de alcanzar ni le quita luz a
los vecinos.
:::
