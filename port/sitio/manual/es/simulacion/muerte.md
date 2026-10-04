---
titulo: Muerte y cadáveres
resumen: "Cuándo muere un bot (sin energía, sin cuerpo, por un disparo, por un shock o por presión de memoria), qué es un cadáver, cómo se descompone y qué pasa con sus lazos."
etiquetas: [muerte, cadáver, energía, descomposición, lazos]
estado: revisada
---
En DarwinBots no hay vejez ni enfermedad: un bot muere porque se le acaba algo.
Casi siempre es la energía; a veces el cuerpo, un disparo que lo vacía de golpe o
una regla del mundo que poda la población. Lo que queda depende de cómo murió y de
la configuración: un _cadáver_ que sigue ahí como comida, o nada.

Esta página cuenta las causas de muerte, en qué momento del ciclo ocurren, qué es
un cadáver y cómo desaparece.

## Las causas {#causas}
<!-- 31-ENERGIA §1 (ManageDeath, Shock); 33-SHOTS §5 (-1/-6: Dead); 10-CICLO §5 P4, §6, §8; core robots.hpp ManageDeath, UpdateCounters; port/README A1-1, A1-3; probado: alcancia.txt con y sin opt:50, cazador.txt contra quieto.txt, shock.txt -->

| Causa | Cuándo | ¿Deja cadáver? |
|---|---|---|
| Sin energía | [[.nrg]] por debajo de 15, con [[param:opt:50]] activado; por debajo de 0,5 si está apagado | Sí, si los cadáveres están activados |
| Sin cuerpo | [[.body]] por debajo de 0,5 | No |
| Un disparo que lo vacía | un disparo de energía (−1) o de cuerpo (−6) lo deja con 0,5 o menos de energía o de cuerpo | No |
| Shock | pierde más de la mitad de su energía en un ciclo y aun así le quedan más de 3000 | Sí: la energía que le quedaba pasa al cuerpo |
| Presión de memoria | el ADN de todo el mundo junto pasa de 4 millones de palabras | No |

### Sin energía

Es la muerte de todos los días. Todo cuesta energía (ver
[[simulacion/energia]]), y la cuenta se lleva sin piso: dentro de un ciclo la
energía puede quedar negativa, aunque tu ADN nunca lea un número menor que 0. Al
final del ciclo, si quedó por debajo de 15, el bot se convierte en cadáver.

Este bot pasa su energía al cuerpo de a 100 por ciclo con [[.strbody]], sin
fijarse en cuánto le queda:

```adn
' Pasa toda su energia al cuerpo, de a 100 por ciclo
cond
start
 100 .strbody store
stop
end
```

Sembrado con 350 de energía, termina el ciclo 3 con 50 y el 4 con −50: en ese
ciclo se convierte en cadáver, con 1040 de cuerpo. Si [[param:opt:50]] está
apagado, en el mismo ciclo 4 desaparece sin dejar nada.

### Sin cuerpo

Un bot vivo cuyo cuerpo baja de 0,5 muere aunque tenga energía de sobra, y no deja
cadáver: no hay nada que dejar.

### Muerto por un disparo

Cuando un disparo de energía o de cuerpo deja a la víctima con 0,5 o menos de
energía o de cuerpo, el motor la marca como muerta, le suma una muerte a
[[.kills]] del tirador y al final del ciclo la saca del mundo **sin cadáver**. En
una prueba, un cazador que se acercaba disparando −1 a un bot quieto de 300 de
energía le hizo llegar dos disparos en el mismo ciclo: el primero le sacó 198 y
el segundo, el resto. El bot desapareció en ese ciclo y el cazador quedó con
`.kills` en 1.
<!-- comprobado con probar-adn: quieto.txt (300 de energía) contra cazador.txt, campo 1500x1500, opt:50=1: muere en el ciclo 20 y el cazador gana 305,8 = 0,95·(220 + 102) -->

Un bot que queda flaco pero por encima de esa raya (entre 0,5 y 15 de energía) sí
termina como cadáver al final del ciclo.

### Shock

Si un bot que no es vegetal pierde en un solo ciclo más de la mitad de la energía
que tenía, y aun así le quedan más de 3000, sufre un _shock_: toda la energía que
le quedaba se le pasa al cuerpo, a razón de 10 por 1, y queda en 0. Como eso lo
deja por debajo de 15, en el mismo ciclo se convierte en cadáver. Un bot con
20000 de energía que gasta 12000 de una vez en un disparo termina como cadáver con
1800 de cuerpo (tenía 1000, más 8000 / 10). Cómo era en el original y otro
ejemplo, en [[simulacion/energia#shock]].

### Ni vejez ni gigantismo

No hay una edad máxima. Lo que sí puede haber es un costo por edad, que crece con
[[.robage]] y termina matando de hambre: [[param:cost:31]], a partir de
[[param:cost:32]] ciclos de vida, constante, logarítmico ([[param:cost:51]]) o
lineal ([[param:cost:60]], con pendiente [[param:cost:33]]).

El código tiene también una regla para matar a los gigantes (cuerpo enorme con
pocos cloroplastos, o más de cinco víctimas), pero su umbral es un cuerpo mayor que
32100, y el cuerpo nunca pasa de 32000: en la práctica no actúa nunca, ni en el
original ni en el port.

## La presión de memoria {#memoria}
<!-- 10-CICLO §8; core master.hpp MemoryPressureKill; port/README A1-3 -->

El último paso de cada ciclo suma el largo del ADN de todos los bots del mundo,
cadáveres incluidos. Si pasa de 4.000.000 de palabras, el motor mata de una vez a
los más pobres: busca el bot con menos energía más diez veces su cuerpo, lo saca,
y repite. Cuántos depende de la población y del largo medio del ADN: con un ADN
medio de 425 palabras son unos 1500, y menos si el ADN medio es más largo.

Es una regla para que la simulación no se quede sin memoria, pero también es
presión selectiva: en un mundo enorme castiga a los pobres justo cuando el genoma
de la población crece. Pasa en simulaciones muy pobladas y largas, con miles de
bots.

## En qué momento del ciclo {#momento}
<!-- 10-CICLO §5 (P2, P5 ManageDeath, P6 ReproduceAndKill), §6 consecuencias; port/README «Conservados» A1-7 -->

Las fases del ciclo (ver [[simulacion/ciclo]]) son: el ADN → se borran los
sentidos → los disparos → fuerzas y choques → movimiento → acciones →
nacimientos y muertes → el sol. La muerte toca varias:

- Los **disparos** marcan como muerta a la víctima que vacían, pero no la sacan
  todavía.
- Al final de las **acciones** cada bot vivo cumple un ciclo de edad y se revisa:
  si tiene menos de 15 de energía se convierte en cadáver, y si está marcado como
  muerto (o sin cuerpo) queda en la lista para salir.
- En **nacimientos y muertes** primero nacen todos los hijos del ciclo y después
  salen todos los muertos.

De ahí sale algo poco intuitivo: un bot que muere en este ciclo **todavía puede
tener un hijo**, porque su pedido de reproducción se atiende antes que su muerte.
El bot marcado por un disparo incluso corre sus acciones de ese ciclo (dispara, se
reproduce) antes de salir. Es así también en el original, y los bots evolucionados
pudieron aprovecharlo.

Un cadáver sale del mundo cuando su cuerpo llega a 0, en el recuento que se hace
entre fuerzas y choques y el movimiento: en el mismo ciclo si se lo terminaron de
comer con un disparo, o en el siguiente si se le acabó por la descomposición o
por un lazo.
<!-- core robots.hpp UpdateCounters (P2: corpse con body <= 0 → KillRobot; si no, Decay), ManageDeath no corre para cadáveres -->

## Los cadáveres {#cadaveres}
<!-- core robots.hpp ManageDeath (Corpse: FName, occurr, DisableDNA, CantSee, VirusImmune, chloroplasts 0, ojos a 0); 30-FISICA §9.5 (colisionan); 32-VISION §2 notas; 33-SHOTS §5 (solo −6 afecta a corpses; ×4) -->

Un cadáver es un bot que dejó de vivir pero sigue en el mundo. Conserva su cuerpo,
su posición, su velocidad y sus lazos, y pierde todo lo demás:

- No corre su ADN, no se mueve por su cuenta, no ve (sus ojos quedan en 0) y no
  cumple años.
- Queda con 0 de energía y sin cloroplastos. Si era un vegetal, deja de serlo: el
  sol ya no lo alimenta.
- Se llama `Corpse`: no cuenta para la población de su especie (ver
  [[.totalmyspecies]]) y los virus no lo infectan.
- Sigue siendo un cuerpo físico: choca, lo empujan y lo arrastra la gravedad.

Los demás lo ven como a cualquier bot. [[.refbody]] trae su cuerpo real, pero
[[.refnrg]] vale 0 y toda su firma ([[.refeye]] y compañía) también: frente a un
cadáver, `*.refeye *.myeye !=` da verdadero, como si fuera de otra especie (ver
[[sysvars/my]]).

### Comerse un cadáver

Lo que vale de un cadáver es el cuerpo, y la única manera de sacárselo es por el
cuerpo: con disparos −6 (ver [[.shoot]]), que contra un cadáver rinden cuatro
veces más que contra un bot vivo, o chupándole cuerpo por un lazo (ver
[[simulacion/lazos]]). Un disparo de energía (−1) no le saca nada, porque no le
queda energía.

_Ursus Detrivoris_, del Bestiario, tiene un gen para eso, comentado «eat
corpses (or harmless bots)»: si lo que ve no dispara (su [[.refshoot]] vale 0,
como la firma de todo cadáver), le dispara al cuerpo.
<!-- Ursus_Detrivoris_F2_Jerry_-07.05.04.txt, gen «eat corpses» -->

```adn
' Come cadaveres (o bots inofensivos)
cond
 *.eye5 30 >
 *.refshoot 1 <
start
 -6 .shoot store
stop
```

## La descomposición {#descomposicion}
<!-- 33-SHOTS §5 (Decay); core robots.hpp Decay (body -= Decay/10, shot de min(Decay, body)); probado: alcancia.txt con opt:51=1000, opt:52=2 -->

Si nadie se lo come, un cadáver puede pudrirse. Lo regulan tres parámetros:

| Parámetro | Qué hace |
|---|---|
| [[param:opt:51]] | Cuánto se descompone en cada paso. El cadáver pierde **la décima parte** de este valor de cuerpo. |
| [[param:opt:52]] | Cada cuántos ciclos da un paso. |
| [[param:opt:53]] | Si en cada paso suelta un disparo, en una dirección al azar: de residuos (−4) o de energía (−2), con el valor del parámetro de descomposición (o el cuerpo que le quede, si es menos). |

Con descomposición 1000 y una pausa de 2 ciclos, el cadáver del primer ejemplo
pierde 100 de cuerpo cada dos ciclos: pasa de 1040 a 40 en unos veinte ciclos y
desaparece poco después. Con el tipo «disparo de energía», cada paso es además
una pequeña ración que puede comer cualquiera que pase cerca; con «disparo de
residuos», ensucia a los vecinos.

El valor por defecto de la descomposición es 0: **los cadáveres no se pudren** y
quedan en el mundo hasta que alguien se los come.

## Los lazos {#lazos}
<!-- core robots.hpp KillRobot (delallties) y ManageDeath (no toca las ties); probado: madre.txt con opt:51=2000, opt:52=1 -->

Convertirse en cadáver no corta los lazos: el bot que estaba atado sigue atado, y
puede seguir sacándole cuerpo por ahí. Los lazos se cortan cuando el bot sale del
mundo, sea un vivo que muere sin cadáver o un cadáver que se quedó sin cuerpo; en
ese momento el compañero los pierde y su [[.numties]] baja.

En este bot la madre tiene una hija a los 3 ciclos (que nace atada a ella) y
después se deja morir; la hija, como ya tiene un lazo, no hace nada:

```adn
' La madre tiene una hija a los 3 ciclos y despues se deja morir;
' la hija nace atada a ella y no hace nada
cond
 *.robage 3 =
 *.numties 0 =
start
 50 .repro store
 1 50 store
stop
cond
 *50 1 =
start
 100 .strbody store
stop
end
```

Con 1000 de energía al empezar, la madre es cadáver en el ciclo 9 y la hija sigue
leyendo `.numties` en 1. Con una descomposición rápida (2000, sin pausa), el
cadáver se termina en el ciclo 13 y desde entonces la hija lee 0.

Cuando un bot sale del mundo también se pierde el virus que tenía guardado para
disparar (ver [[simulacion/virus]]). Sus disparos que ya están en vuelo, en
cambio, siguen su camino.

## Los parámetros {#parametros}
<!-- engine/opciones.js opt:50-53, opt:111-112, cost:31-33/51/60 -->

| Parámetro | Para qué |
|---|---|
| [[param:opt:50]] | Si los muertos de hambre quedan como cadáveres. |
| [[param:opt:51]], [[param:opt:52]], [[param:opt:53]] | La descomposición. |
| [[param:cost:31]] y los otros costos por edad | La muerte por vejez, si la querés. |
| [[param:opt:111]], [[param:opt:112]] | Guardar una ficha de cada bot que muere. |

En la vista del mundo los cadáveres se cuentan aparte; en Analizar (ver
[[app/analizar]]) hay un gráfico de cadáveres y otro de bots con y sin ellos.
