---
titulo: Mutaciones
resumen: "Cómo cambia el ADN por azar, en vida y al nacer: los tipos de mutación, qué le hacen a las instrucciones, cómo se leen las tasas y cómo se encienden o apagan."
etiquetas: [mutaciones, evolución, tasas, herencia, mrepro]
estado: revisada
---
Las mutaciones son el motor de la evolución: cambios al azar en el ADN que
pasan a los hijos. La mayoría rompe algo, alguna no cambia nada que se note, y
muy de vez en cuando una sale mejor que el original. Si ese bot deja más hijos
que sus vecinos, el cambio se queda.

En DarwinBots el ADN cambia en dos momentos: **en vida**, poco a poco, y **al
nacer**, cuando se copia el ADN del padre (o se mezcla, en la reproducción
sexual) para el hijo.

## Quién muta {#quien-muta}
<!-- 40-MUTACIONES §1 (gates: Mutables.Mutations por bot y DisableMutations global); core mutations.hpp mutate -->

Para que un bot mute tienen que cumplirse dos cosas:

1. **Las mutaciones de la simulación están encendidas**: es el interruptor
   [[param:base:mutations]] de la app. Apagado, nadie muta, pase lo que pase.
2. **El bot tiene su propia tabla de mutaciones encendida.** Cada bot lleva
   una tabla con una tasa para cada tipo de mutación, que hereda de su padre.
   Un tipo con tasa 0 no ocurre nunca.

:::cuidado
Hoy la app siembra cada especie con la tabla **vacía**. Sus bots no mutan ni en
vida ni al reproducirse con [[.repro]], aunque [[param:base:mutations]] esté
encendido. Las mutaciones aparecen con [[.mrepro]], que le arma al hijo una
tabla propia para ese parto ([[simulacion/mutaciones#mrepro|ver abajo]]), y en los bots de una
simulación guardada por el DarwinBots original, que traen su tabla. La
reproducción sexual varía igual el ADN, por la mezcla
([[simulacion/reproduccion#mezcla]]).
:::

## Los tipos de mutación {#tipos}
<!-- 40-MUTACIONES §0.1 (dos familias y orden al nacer), §2, §3; core bot.hpp SetDefaultLengths; sunbelt apagado (sim.hpp) -->

| Tipo | Cuándo | Qué le hace al ADN | Tramo típico |
|---|---|---|---|
| Puntual | En vida | Cambia un tramo corto de instrucciones | 3 (± 1) |
| Delta | En vida | No toca el ADN: cambia una de las tasas del propio bot | — |
| Error de copia | Al nacer | Cambia instrucciones | 1 |
| Inserción | Al nacer | Agrega instrucciones nuevas | 1 |
| Inversión | Al nacer | Da vuelta el orden de un tramo | 3 (± 1) |
| Borrado grande | Al nacer | Borra un tramo | 3 (± 1) |
| Borrado chico | Al nacer | Borra una instrucción | 1 |

El _tramo típico_ es cuántas instrucciones toca cada mutación: el motor lo
sortea alrededor de ese valor. Las de nacimiento se aplican en el orden de la
tabla, una pasada de cada tipo sobre el ADN del hijo. Las de vida corren en la
fase de acciones de cada ciclo (ver [[simulacion/ciclo#fases]]).

El borrado grande y el chico son el mismo mecanismo con distinto tramo.

El motor tiene cuatro tipos más que vienen apagados y la app no enciende: una
segunda puntual, un segundo error de copia, la _translocación_ (mueve un tramo
a otro lugar del ADN) y la _amplificación_ (lo duplica).

## Qué le pasa a una instrucción {#que-cambia}
<!-- 40-MUTACIONES §4 (ChangeDNA: 80 % valor / 20 % tipo; saltos Gauss 94 y 7; |v| > 1000 escala v/10; comandos Random(1, Max) del mismo tipo), §0.4, §0.5 (end intocable; debugint/debugbool no se crean) -->

La puntual y el error de copia cambian instrucciones una por una. Con la
configuración de fábrica, de cada cinco cambios cuatro tocan el **valor** y uno
el **tipo**:

- **Cambiar el valor de un número** (o de una lectura como `*50`): lo corre un
  poco. La mitad de las veces es un salto grande (de unas decenas o un par de
  centenas) y la otra mitad un retoque de pocas unidades. Un número de más de
  1000 se mueve en proporción: alrededor de un 10 %.
- **Cambiar el valor de un comando**: lo reemplaza por otro de la misma
  familia. Un operador por otro operador ([[op:add]] por [[op:mult]], por
  ejemplo), una comparación por otra, un `start` por un `cond`.
- **Cambiar el tipo**: la instrucción pasa a ser de otra clase. Un número se
  vuelve un operador, una comparación se vuelve un número, una lectura
  como `*.nrg` se vuelve un store.

Como las direcciones son números, una mutación de valor sobre `.up` puede
dejarte escribiendo en otra dirección: `10 .up store` se convierte en
`10 .dn store`, o en un número que no es una sysvar y queda como memoria libre.

Hay dos cosas que ninguna mutación hace: tocar el [[op:end]] que cierra el ADN
y crear uno nuevo.

Estos cambios los vimos pasar en hijos de un bot de un solo gen, partiendo de
`cond *.robage 5 > start … stop`:

```
cond *.robage 5 > 291 start …   inserción: un número suelto antes de start
cond *.robage > start …         borrado chico: se fue el 5
cond > 5 *.robage start …       inversión del tramo «*.robage 5 >»
cond *.robage 5 > … stop        borrado del start: el cuerpo pasó a ser condición
```

El último es un buen ejemplo de mutación letal: sin `start`, los stores del gen
quedan en la zona de condiciones y no escriben nada (ver [[adn/genes]]). Ese
bot ya no se reproduce.

## Las tasas {#tasas}
<!-- 40-MUTACIONES §0.2 (agenda geométrica 1/(1000·rate) para Point; Bernoulli 1/rate por token al nacer; DeltaMut 1/(100·rate)); core bot.hpp SetDefaultMutationRatesSkipNorm (5000) -->

Cada tasa es un número _N_ que se lee «**una en _N_**»: cuanto más grande, más
rara la mutación. El valor de fábrica del motor es 5000 para todos los tipos.

| Tipo | Probabilidad |
|---|---|
| De nacimiento | Una en _N_ por cada instrucción del ADN, en cada parto, para cada tipo. |
| Puntual | Una en 1000 × _N_ por cada instrucción, en cada ciclo de vida. |
| Delta | Una en 100 × _N_ por ciclo de vida. |

Con las tasas en 5000 y un ADN de 100 instrucciones:

- Cada tipo de nacimiento tiene un 2 % de tocar al hijo; sumando los cinco,
  alrededor de uno de cada diez hijos nace con algún cambio.
- Una mutación puntual le toca al bot cada unos 50000 ciclos de vida. En
  vida casi nada cambia: la evolución pasa por los partos.

Un ADN más largo muta más, porque hay más instrucciones donde sortear.

Las tasas se heredan, y la mutación _delta_ las va moviendo: cuando ocurre,
elige un tipo al azar y le cambia la tasa unos cientos para arriba o para
abajo. Así un linaje puede volverse más estable o más cambiante con el
tiempo.

:::nota
Hay además un tope de seguridad: con un ADN muy largo, el motor no deja que
una tasa baje de cierto valor, proporcional al largo, para que un bot gigante
no mute en casi cada instrucción. En el DarwinBots original ese tope quedaba
escrito en la tabla del bot y se heredaba, así que los linajes largos iban
derivando hacia él. En el port se aplica solo en el momento y la tabla queda
como estaba.
:::

## Reproducirse para explorar: .mrepro {#mrepro}
<!-- 36-REPRO §2 (sin Delta2: tasas ÷10, 0 → 1000, Mutations forzado solo para ese parto); core robots.hpp Reproduce; comprobado: con la tabla vacía de la app, 80 partos con .repro dan 0 mutaciones y con .mrepro 6 -->

[[.mrepro]] funciona como [[.repro]], pero el hijo nace con la tabla de
mutaciones **dividida por 10** solo para ese parto: cada tipo de nacimiento es
diez veces más probable. Un tipo con tasa 0 pasa a 1000. Además el hijo muta
aunque su tabla estuviera apagada; lo único que lo impide es apagar
[[param:base:mutations]].

Después del parto el hijo vuelve a la tabla heredada: en vida muta como su
padre, y sus propios hijos con [[.repro]] también.

Con la tabla vacía de la app, un bot de 13 instrucciones que se reproduce con
[[.mrepro]] tuvo 6 hijos mutantes en 80 partos; el mismo bot con [[.repro]],
ninguno.

La idea es reservar [[.mrepro]] para cuando conviene probar cosas nuevas. El
Animal_Minimalis_mod_stress del Bestiario se reproduce con [[.repro]] en
condiciones normales y con [[.mrepro]] cuando está en apuros. Una versión
mínima, que explora si viene perdiendo energía ([[.pain]]):

```adn
' Si viene perdiendo energia, explora; si no, se copia
cond
 *.nrg 4000 >
 *.pain 0 >
start
 33 .mrepro store
stop
cond
 *.nrg 4000 >
 *.pain 1 <
start
 33 .repro store
stop
```

## Qué más cambia cuando un bot muta {#efectos}
<!-- 40-MUTACIONES §1 (mutatecolors, NewSubSpecies, DnaLen/genenum, mem 336/339); port/README B6-7, B6-9 -->

- **El color**: cada mutación corre un poco uno de los tres canales del
  color, así que los linajes que mutan se van distinguiendo a la vista.
- **La subespecie**: el bot pasa a una subespecie nueva dentro de su especie
  (ver [[simulacion/especies]]).
- **[[.dnalen]] y [[.genes]]** se actualizan en el momento.
- **La firma del ADN** que leen [[sysvars/my|las sysvars my*]] y que ven los
  demás con [[.refeye]], [[.refshoot]] y compañía se rehace en el momento.
- **El contador de mutaciones** del bot sube, y lo hereda el hijo.

:::nota
Dos diferencias con el original. Allí una mutación en vida no rehacía la firma
del ADN: lo que veían los demás seguía siendo lo de antes hasta el próximo
parto. Y una inserción contaba dos mutaciones por instrucción agregada; en el
port cuenta una.
:::

## La oscilación {#oscilacion}
<!-- 10-CICLO §2 paso 4; core master.hpp (MutOscill en false) -->

El motor puede multiplicar las probabilidades de todos los bots a la vez,
alternando épocas de mucho cambio con épocas de calma: hasta 16 o 20 veces más
mutaciones en la subida y otro tanto menos en la bajada. Las tasas heredables
no cambian; el factor se aplica encima, en el momento de cada sorteo. Viene
apagada y la app no tiene un control para encenderla. El detalle está en
[[simulacion/ciclo#oscilacion]].

## Cómo encenderlas y apagarlas {#encender}
<!-- opciones.js base:mutations (DisableMutations); 36-REPRO §2; sim.hpp (Delta2, epireset, EnableAutoSpeciation en false) -->

| Querés | Hacé |
|---|---|
| Que nadie mute | Apagá [[param:base:mutations]]. Es la única forma de frenar también a [[.mrepro]]. |
| Copias exactas salvo cuando el bot lo pide | Con la tabla vacía de la app ya es así: usá [[.repro]] para copiar y [[.mrepro]] para explorar. |
| Hijos distintos sin mutaciones | Usá la reproducción sexual: la mezcla ya varía el ADN. |

El motor trae además tres mecanismos que vienen apagados y la app no ofrece:
un régimen alternativo en el que las tasas de cada hijo derivan al azar en cada
parto, la _auto-especiación_ (un bot que acumuló muchas mutaciones funda una
especie nueva con otro nombre) y el _reinicio epigenético_ (un linaje muy
mutado deja de heredar la memoria genética, ver [[adn/memoria#memoria-genetica]]).
