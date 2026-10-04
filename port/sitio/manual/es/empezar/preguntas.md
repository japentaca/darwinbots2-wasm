---
titulo: Preguntas frecuentes
resumen: "Respuestas cortas a las dudas más comunes al usar la app y al escribir bots: bots que no se mueven, poblaciones que se mueren o no evolucionan, dónde quedan tus datos y qué cambia respecto del original."
etiquetas: [preguntas, problemas, ayuda, datos, original]
estado: revisada
---
## Sobre la simulación {#simulacion}

### ¿Por qué mi bot no se mueve? {#no-se-mueve}
<!-- probado con probar-adn (costos 0): «cond start .up 10 store stop», «cond start 10 .upp store stop» (lint: did you mean .up?) y «cond 10 .up store stop» quedan quietos 3 ciclos; «cond start 10 .up store stop» avanza. adn/errores #nombre #start-stop #direccion -->

Casi siempre es una de estas tres cosas, y las tres las probamos con el motor:

| Escribiste | Qué pasa | Va |
|---|---|---|
| `.up 10 store` | [[op:store]] toma el valor de abajo y la dirección de arriba: esto escribe otra cosa en otro lado. | `10 .up store` |
| `10 .upp store` | Una sysvar mal escrita vale 0 y la orden no llega. El editor te avisa: «.upp no es un sysvar: el motor lo lee como 0. ¿Quisiste decir .up?». | `10 .up store` |
| `cond 10 .up store stop` | Sin `start`, la orden queda en la zona de condiciones y no escribe nada. | `cond start 10 .up store stop` |

Si el ADN parece bien, inspeccioná al bot: en **Resumen**, **Genes activos
este ciclo** muestra si el gen que mueve se ejecuta, y en **Memoria** podés
consultar [[.up]] (ver [[app/inspector]]). Una orden de movimiento se borra
en cada ciclo, así que hay que darla en todos (ver
[[simulacion/ciclo#atraso]]). Más errores típicos en [[adn/errores]].

### ¿Por qué se mueren todos? {#se-mueren}
<!-- probado con probar-adn y los costos F1 de opciones.js (F1_COSTOS): un bot quieto pierde unos 0,02 de energía por ciclo y uno que avanza y gira (el de primera-simulacion), unos 0,63; con costos 0 el quieto conserva 3000 en 2000 ciclos. Revisor: el bot de primera-simulacion con F1_COSTOS baja de 3000 a 2372,57 en 1000 ciclos (0,63 por ciclo). muerte #causas (umbral 15 con cadáveres) -->

Un bot muere cuando se queda sin energía (ver [[simulacion/muerte#causas]]).
Las causas más comunes:

- **El mundo cobra costos y no hay comida.** Con los costos de la liga F1 (el
  escenario Partido F1, o **Costos** en «F1»), un bot que se mueve gasta
  energía todo el tiempo; en una prueba, el bot de
  [[empezar/primera-simulacion#tu-bot|tu primera simulación]] perdía unos 0,6
  por ciclo sin comer. Si no encuentra qué comer, se apaga en unos miles de
  ciclos.
- **Se acabaron los vegetales.** Si los animales se comen todas las algas, se
  quedan sin comida. Subí la **Energía solar** o la **Repoblación de
  vegetales** en Experimentar (ver [[simulacion/cloroplastos#vegetales]]).
- **Es de noche.** Con **Día y noche** encendido, los vegetales no reciben
  energía mientras dura la noche.
- **Hay un depredador.** Mirá los eventos y el gráfico de población: si una
  especie crece mientras otra cae, la está cazando.

En los escenarios de fábrica, salvo Partido F1, los costos están en 0: ahí
nadie pierde energía por vivir, y casi todas las muertes son de bots
cazados.

### ¿Por qué mi bot no se reproduce? {#no-se-reproduce}
<!-- reproduccion #cuando-falla; .repro -->

Revisá que el gen que escribe [[.repro]] se ejecute (la condición de energía
suele ser la culpable) y que el bot tenga algo de energía y cuerpo. El motivo
más común es que el lugar donde nacería el hijo esté ocupado: un hermano
pegado, una pared o el borde del campo. La orden queda escrita y se
reintenta cada ciclo. La lista completa está en
[[simulacion/reproduccion#cuando-falla]].

### ¿Por qué no evolucionan? {#no-evolucionan}
<!-- mutaciones #quien-muta #mrepro #encender; opciones.js F1_NOMBRADAS mutations: 0 (Partido F1, Ajustes F1); dbcore_api.cpp db_sim_add_species con tasas de fábrica (commit 175f691) -->

- **Las mutaciones están apagadas.** Fijate en el control **Mutaciones** de
  Experimentar. El escenario Partido F1 y el botón **Ajustes F1** las apagan.
- **Falta tiempo.** Con las tasas de fábrica, un hijo nacido con [[.repro]]
  sale cambiado muy de vez en cuando (en un bot de 20 instrucciones, cerca de 1
  de cada 60), y la mayoría de esos cambios rompen algo. La evolución se ve en
  decenas de miles de ciclos: poné la velocidad en **Máx.**
- **No se reproducen.** Sin partos no hay mutaciones que heredar.

Para acelerar, un bot puede reproducirse con [[.mrepro]], que hace mutar diez
veces más a ese hijo. Todo esto está en [[simulacion/mutaciones]], y un
experimento guiado, en [[tutoriales/evolucion]].

### ¿Por qué la simulación se pone lenta? {#lenta}
<!-- observar.ritmo (ciclos/s · fps); probado: sin costos, 5 bots de primera-simulacion pasan de 5 a entre 166 y 1198 en 10000 ciclos según la semilla (redactor semillas 1-3, revisor 2 y 4-7) -->

Porque hay muchos bots: cada uno ejecuta su ADN y se mueve en cada ciclo. Sin
costos nadie se muere de hambre, así que una especie que come bien crece sin
freno. A la derecha de la barra de Observar ves cuántos ciclos por segundo
estás logrando. Para frenar la población, cobrá costos o bajá el **Tope de
vegetales** y la **Energía solar** (ver [[app/experimentar]]).

### ¿Puedo repetir exactamente la misma simulación? {#repetir}
<!-- experimentar.semilla.ayuda; web2/PLAN.md C15, C17, C19 -->

Sí: el mismo escenario con la misma semilla da la misma simulación. La
semilla se ve y se cambia en Experimentar. Una corrida guardada y retomada
sigue bien, pero no idéntica a como habría seguido sin guardarla. Ver
[[tecnico/semillas]].

## Sobre la app {#app}

### ¿Dónde quedan mis datos? {#datos}
<!-- i18n/es/inicio.json inicio.nota; observar.guardar.explica; web2/PLAN.md decisión 17; PLAN-SITIO.md S3 -->

En el navegador que usás, en ese equipo. Tus bots, corridas, escenarios,
torneos e informes no se suben a ningún servidor. Eso quiere decir que:

- en otro navegador o en otro equipo no los vas a ver;
- si borrás los datos del sitio desde el navegador, se pierden;
- de las corridas se conservan las últimas 20.

Para tenerlos a salvo o llevarlos a otro lado, exportalos: **Descargar
.dbsim** al guardar una corrida, **Exportar mis bots y marcas (.json)** en
Bots, **Exportar** en los escenarios y en los torneos. Todo está en
[[app/tus-datos]].

### Tenía bots y torneos en la interfaz clásica. ¿Los pierdo? {#clasica}
<!-- web2/PLAN.md decisión 17; i18n/es/bots.json bots.menu.clasica, competir.json competir.lista.archivos -->

No. La primera vez que abrís la app nueva, copia los bots y los torneos que
tuvieras guardados en la clásica y te avisa qué importó; la clásica no se
toca. También podés repetirlo desde el menú de la biblioteca, con **Importar
desde la clásica**, y Competir acepta los archivos de torneo exportados desde
la clásica. Ver [[app/clasica]].

### ¿Se puede usar un bot del DarwinBots original? {#bot-original}
<!-- port/README.md (Bugs del original corregidos: el lenguaje no cambia; A2-1, 9 bots de web/bots; 571 bots cargan y corren); inicio.archivo.desc; observar.sembrar.preset.pegar -->

Sí. El lenguaje del ADN es el mismo: un bot escrito para el 2.48.32 carga y
ejecuta su ADN como en el original. Tenés tres formas:

1. En Inicio, la tarjeta **Desde un archivo**: elegí el `.txt` y se siembra en
   el mundo por defecto, con algas.
2. En Observar, **Sembrar** › **Pegar el ADN…**.
3. En Bots, **+ Nuevo bot**, para guardarlo en tu biblioteca y editarlo.

Antes de buscarlo, fijate si ya está en el Bestiario: la app trae 684 bots del
foro y del wiki. La única regla del lenguaje que cambió es el `else` después
de un `start`, que en el original nunca corría y en esta versión sí (ver
[[adn/genes#else]]). Lo que sí cambia un poco es el mundo, por los errores
corregidos (ver la pregunta siguiente).

### ¿En qué se diferencia del original? {#diferencias}
<!-- port/README.md Bugs del original corregidos (35 corregidos, conservados y por qué); web2/PLAN.md decisión 5 -->

El motor es el mismo programa, traducido. Se corrigieron 35 errores del
original que se podían arreglar sin cambiar el lenguaje del ADN: un sentido
que valía siempre 0, energía que se destruía en vez de pasar al cuerpo,
disparos de virus que se cobraban dos veces, y otros. Por eso las cifras de una simulación no
coinciden exactamente con las del original. La lista completa, con lo que se
dejó igual a propósito, está en [[tecnico/diferencias]].

En la interfaz, la app nueva es distinta del programa de Windows, y algunas
cosas del original quedaron afuera (como los dibujos personalizados de los
bots o la imagen de fondo). La interfaz clásica está más cerca del original:
ver [[app/clasica]].

### La app dice que «N palabras del ADN no se reconocen y valen 0». {#aviso-lint}
<!-- observar.aviso.lint; corrida-nucleo.js (evento lint del worker al sembrar); adn/errores #nombre -->

Al sembrar una especie, la app revisa su ADN. Si hay palabras que no son ni
números, ni sysvars, ni operadores (casi siempre una sysvar mal escrita), te
avisa cuántas son. El bot se siembra igual, pero esas palabras valen 0. Abrilo
en el [[app/editor|editor de ADN]] para ver cuáles son: marca cada una con su línea y,
cuando puede, sugiere el nombre correcto. Ver [[adn/errores#nombre]].

### ¿Por qué mi bot le dispara a los de su propia especie? {#especie}
<!-- adn/errores #especie; sysvars/my -->

Porque el ADN no sabe de especies: dispara a lo que tiene enfrente. Hay que
agregarle a la condición del disparo una comparación de firmas, como
`*.refeye *.myeye !=` («lo que veo no es de los míos»). Ver
[[adn/errores#especie]] y [[tutoriales/reconoce-especie]].

### ¿Dónde aprendo a escribir bots? {#aprender}

Empezá por [[adn/estructura]] y seguí los tutoriales en orden, desde
[[tutoriales/se-mueve]]. El [[app/editor|editor de ADN]] te avisa de los errores mientras
escribís y con **Probar** ves cómo le va a tu bot sin salir de la ficha.
