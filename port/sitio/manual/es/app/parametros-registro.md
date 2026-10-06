---
titulo: "Parámetros: Registro"
resumen: "El registro de muertos, que guarda una ficha de cada bot que muere, y el intervalo de los gráficos de la interfaz clásica."
etiquetas: [registro, muertos, instantánea, gráficos, parámetros]
estado: revisada
---
<!-- opciones.js «Registro»; core database.hpp (AddRecord, Snapshot, SnapshotFitness), robots.hpp KillRobot (DeadRobotSnp / SnpExcludeVegs); port/README «Registro y análisis (etapa E6)»; web2/src/lib/observar/MenuInstantanea.svelte; i18n/es/observar.json observar.snp.* -->

Este grupo controla lo que la simulación anota para analizar después. El
parámetro importante es el registro de muertos: una ficha por cada bot que muere,
con su linaje, su historia de mutaciones y su ADN. Es la forma de estudiar a los
que _no_ sobrevivieron, que en una corrida larga son casi todos.

No hace falta venir hasta acá para usarlo: el menú **Instantánea** de Observar
tiene las mismas casillas y los botones para bajar el registro (ver
[[app/observar]]).

## El registro de muertos {#muertos}
<!-- MenuInstantanea.svelte: casillas 111/112 (aplicarCambioVivo; deshabilitadas con stats.f1), cuenta «Registros acumulados», Descargar (deadTake sin vaciar), Reiniciar (confirmación); veterano.js ARCHIVOS_MUERTOS -->

Con [[param:opt:111]] encendido, cada vez que un bot muere el motor guarda su
ficha. Las fichas se acumulan en la simulación hasta que las bajes:

1. En Observar, abrí el menú **Instantánea**.
2. Activá **Registrar los muertos** (y, si querés, **Sin vegetales**). El cambio
   se aplica en el acto y queda anotado en la corrida.
3. Dejá correr la simulación. El menú muestra cuántas fichas lleva en
   **Registros acumulados**.
4. Hacé clic en **Descargar**: bajan dos archivos, `DeadRobots.snp` con las fichas y
   `DeadRobots_Mutations.txt` con la historia de mutaciones de cada bot.
   Descargar no borra nada: el registro sigue sumando.
5. Para empezar de cero, **Reiniciar** borra lo acumulado (pide confirmación).

Mientras corre un concurso F1 ([[app/parametros-modos]]), las dos casillas del
menú quedan deshabilitadas.

Cada ficha tiene el mismo formato que la **Instantánea de los vivos (.snp)** del
mismo menú, así que podés comparar a los vivos con los muertos con las mismas
herramientas:

| Dato | Qué es |
|---|---|
| Número y padre | El número único del bot y el de su padre: con ellos se arma el árbol genealógico. |
| Especie | El nombre de la especie fundadora. |
| Generación y nacimiento | Cuántas generaciones lo separan del fundador y en qué ciclo nació. |
| Edad | Los ciclos que vivió. |
| Mutaciones | El total que acumula su linaje y cuántas son propias. |
| Largo del ADN | Instrucciones de su genoma (ver [[.dnalen]]). |
| Hijos y víctimas | Cuántos hijos tuvo y cuántos bots mató. |
| Aptitud | El puntaje con el que **Buscar el mejor** elige al más apto ([[param:opt:96]]), calculado en el momento de morir. |
| Energía | Energía más 10 por punto de cuerpo, al morir. |
| Cloroplastos | Los que tenía. |
| ADN | El genoma completo, como texto. |

Un bot con el ADN vacío no deja ficha. Para entender las columnas de mutaciones y
linaje, ver [[simulacion/mutaciones]] y [[simulacion/especies]].

:::parametro opt:110
<!-- README E6: el worker de la clásica alimenta cada chartingInterval ciclos solo los gráficos abiertos; la nota de opciones.js dice que la app nueva no lo usa -->
Cada cuántos ciclos toman un punto los gráficos de la interfaz clásica (ver
[[app/clasica]]): con 200, la curva de población tiene un punto cada 200 ciclos.
Un valor chico da curvas más detalladas, que se llenan antes. La app nueva no lo
usa, porque sus gráficos muestrean por su cuenta (ver [[app/analizar]]), pero el
valor queda guardado con la simulación, también en el archivo `.dbsim`.
:::

:::parametro opt:111
<!-- robots.hpp KillRobot: if DeadRobotSnp && !(Veg && SnpExcludeVegs) AddRecord; database.hpp: DnaLen == 1 → sin registro -->
Enciende el registro de muertos: desde ese momento, cada bot que muere deja una
ficha, sea cual sea la causa (hambre, vejez, un disparo, una descalificación).
Los que murieron antes de encenderlo no aparecen. Apagarlo deja de anotar pero
no borra lo acumulado. En una simulación con mucha población el registro crece
rápido: cada ficha lleva el ADN entero.
:::

:::parametro opt:112
<!-- robots.hpp KillRobot: Veg && SnpExcludeVegs → sin AddRecord -->
Con el registro de muertos encendido, deja afuera a los vegetales. Conviene casi
siempre: en un mundo con repoblación, los vegetales nacen y mueren por miles y
taparían a los animales que querés estudiar. Solo afecta al registro de muertos;
la instantánea de los vivos incluye a todos.
:::
