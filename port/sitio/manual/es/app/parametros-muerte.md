---
titulo: "Parámetros: Muerte y descomposición"
resumen: "Qué queda de un bot que muere y cómo se pudre, si los regalos de energía y los desechos se gastan en el viaje y desde cuántos desechos un bot se intoxica."
etiquetas: [muerte, cadáver, descomposición, desechos, disparos]
estado: revisada
---
<!-- engine/opciones.js grupo 'muerte' (opt:50-56); CONTROLES_BASICOS 'cadaveres'; core robots.hpp ManageDeath, Decay, HandleWaste/altzheimer; shots.hpp updateshots (NoShotDecay/NoWShotDecay) -->

Este grupo decide qué pasa con lo que sobra: los bots muertos, los disparos
que quedan volando y los desechos que se acumulan. Son tres temas:

- **Los cadáveres** (los cuatro primeros): si un bot que se
  muere de hambre deja su cuerpo como comida, y si ese cuerpo se pudre. La
  mecánica está en [[simulacion/muerte]].
- **Los disparos que no se gastan** ([[param:opt:54]] y [[param:opt:55]]): si
  los regalos de energía y los de desechos pierden fuerza en el viaje (ver
  [[simulacion/disparos#alcance|cuánto viaja un disparo]]).
- **La intoxicación** ([[param:opt:56]]): desde cuántos desechos un bot
  empieza a perder la memoria (ver [[simulacion/energia#desechos|los desechos]]).

Juntos regulan cuánto se recicla. Con cadáveres que no se pudren, la energía de
los muertos queda en el mundo hasta que alguien se la come; sin cadáveres, se
pierde. En el modo básico de Experimentar, el primero aparece como
**Cadáveres**.

:::parametro opt:50
<!-- core robots.hpp ManageDeath (CorpseEnabled: nrg < 15 y age > 0 → Corpse; si no, nrg < 0,5 o body < 0,5 → Dead); muerte.md probado: alcancia.txt con y sin opt:50 -->
Si está encendido (como arranca la app), un bot cuya energía baja de 15 se
convierte en cadáver: conserva el cuerpo, que otros pueden comer con
disparos −6 o por un lazo, y deja de correr su ADN. Apagado, el bot aguanta
hasta que su energía baja de 0,5 y entonces desaparece sin dejar nada. La
**Liga F1** lo apaga.

Solo afecta a los que mueren de hambre o por un shock: los que vacía un
disparo y los que se quedan sin cuerpo nunca dejan cadáver. La tabla
completa está en [[simulacion/muerte#causas|las causas de muerte]] y qué es un cadáver, en
[[simulacion/muerte#cadaveres|los cadáveres]].
:::

:::parametro opt:51
<!-- core robots.hpp Decay (body -= Decay/10 cada Decaydelay ciclos, sin piso); comprobado: muere.txt (350 de energía) con 51=1000, 52=2 → 1040 de cuerpo, −100 cada dos ciclos, sale tras llegar a −60 -->
Cuánto se pudre un cadáver en cada paso: pierde **la décima parte** de este
valor en cuerpo. Con 0, el valor de la app, los cadáveres no se pudren nunca y
quedan en el mundo hasta que alguien se los come.

En una prueba, con 1000 y un paso cada 2 ciclos, un cadáver de 1040 de cuerpo
perdió 100 cada dos ciclos y desapareció a los veinte y pico. Pudrir rápido
limpia el campo de cadáveres que tapan la luz y estorban; pudrir lento
alimenta a los carroñeros. Ver [[simulacion/muerte#descomposicion|la descomposición]].
:::

:::parametro opt:52
<!-- core robots.hpp Decay (DecayTimer >= Decaydelay) -->
Cada cuántos ciclos da un paso la descomposición. La app arranca con 100: con
eso, aun con [[param:opt:51]] distinto de 0, un cadáver dura mucho. Con 1 se
pudre en cada ciclo. Solo cuenta si [[param:opt:51]] no es 0.
:::

:::parametro opt:53
<!-- core robots.hpp Decay (DecayType 2 → newshot −4, 3 → newshot −2, valor Decay si body > Decay/10 y si no body, rumbo al azar) -->
Si el cadáver suelta algo en cada paso de la descomposición, en una dirección
al azar:

- **sin disparo** (el valor de la app): solo pierde cuerpo.
- **disparo de residuos**: suelta un disparo de desechos (−4), que ensucia
  al vecino que le toque.
- **disparo de energía**: suelta un regalo de energía (−2), una pequeña
  ración para el que pase cerca.

El disparo sale con el valor de [[param:opt:51]] mientras al cuerpo le quede
más de su décima parte; en el último paso sale con lo que quede de cuerpo. Como
el cuerpo vale 10 de energía, en los pasos normales lo que suelta equivale a lo
que pierde. Solo cuenta si [[param:opt:51]] no es 0. Ver
[[simulacion/disparos#tipos|qué hace cada disparo]].
:::

:::parametro opt:54
<!-- core shots.hpp updateshots (NoShotDecay && shottype −2: sin decaimiento de nrg ni envejecimiento) -->
Los regalos de energía (disparos −2) no pierden fuerza en el viaje ni
envejecen: vuelan con todo su valor hasta que le pegan a alguien. Eso incluye
la energía que devuelve cada disparo −1 o −6 al tirador: si no lo alcanza,
sigue volando y se la puede comer otro. Apagado en la app y en la **Liga F1**.

Con este parámetro encendido no se pierde energía en el aire, pero en un mundo
con paredes los regalos perdidos rebotan sin fin hasta que alguien se cruza.
:::

:::parametro opt:55
<!-- core shots.hpp updateshots (NoWShotDecay && shottype −4) -->
Lo mismo para los disparos de desechos (−4): no pierden fuerza ni envejecen,
y siguen volando hasta que le pegan a alguien. Un bot que tira sus desechos
para limpiarse ya no puede contar con que se esfumen: tarde o temprano le
llegan a otro. Apagado en la app y en la **Liga F1**.
:::

:::parametro opt:56
<!-- core robots.hpp HandleWaste (0 → 400; > 0 y Pwaste + Waste > nivel → altzheimer: (exceso)/4 escrituras al azar en 1..1000 salvo mkchlr/rmchlr); comprobado: sucio.txt con cost 29=1, 54=1 → basura en la memoria desde 600 de desechos con 400, nada con 5000 -->
Desde cuántos desechos un bot se intoxica. Si [[.waste]] más los desechos
permanentes ([[.pwaste]]) pasan de este valor, en cada ciclo el motor le
escribe números al azar en direcciones al azar de la memoria, una vez por cada
4 unidades de exceso. Cualquier dirección del 1 al 1000 puede tocarle, incluidas
órdenes como [[.repro]] o [[.shoot]]; solo se salvan [[.mkchlr]] y [[.rmchlr]].

La app arranca con 400 y la **Liga F1** lo sube a 10000. En una prueba, un bot
que fabricaba caparazón sin tirar los desechos tenía la memoria limpia con el
nivel en 5000 y llena de basura a los pocos ciclos con 400. Si ponés 0, el
motor lo toma como 400; un valor negativo apaga la intoxicación.
:::
