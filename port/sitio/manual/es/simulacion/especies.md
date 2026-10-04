---
titulo: Especies y linaje
resumen: "Qué es una especie para el motor (un nombre que se hereda), qué pasa con ella cuando los bots mutan, cómo se registran el parentesco y la distancia genética, y dónde se ve todo eso en la app."
etiquetas: [especie, linaje, filogenia, distancia genética, mutaciones]
estado: revisada
---
Para el motor de DarwinBots una especie es, ante todo, **un nombre**. Todos los
bots que sembrás desde un mismo bot de la biblioteca llevan su nombre, y todos sus
descendientes lo heredan, muten lo que muten. Sobre esa idea simple la app arma el
registro de especies, el árbol de parentesco y las medidas de cuánto cambió el
ADN.

Esta página separa tres cosas que es fácil mezclar: la especie (el nombre), el
linaje (quién es hijo de quién) y el parecido genético (cuánto se parecen dos
ADN).

## Qué es una especie {#especie}
<!-- core sim.hpp SpeciesFromBot (por FName); formats.hpp AddSpecieFromFile; engine/sim.js seedSpecies; 33-SHOTS §5 (−3/−5 conespecífico por FName); sysvars .totalmyspecies -->

Cuando armás una simulación, cada especie que agregás en «Especies a sembrar» (ver
[[app/experimentar]]) es un bot de la biblioteca con una cantidad, un color y la
marca de vegetal o animal. Al sembrarla, el mundo registra la especie con ese
nombre, y cada bot sembrado y cada hijo que nazca después lo lleva.

El motor usa ese nombre para decidir quién es «de los suyos»:

- [[.totalmyspecies]] cuenta los bots vivos con su mismo nombre.
- El veneno ([[.strvenom]]) y la toxina ([[.strpoison]]) de un bot de la misma
  especie no le hacen daño: los absorbe como si fueran propios.
- Los cadáveres se llaman `Corpse` y dejan de contar para su especie (ver
  [[simulacion/muerte]]).

Eso no quiere decir que un bot _sepa_ el nombre de los demás: el ADN no lo puede
leer. Para reconocer a un pariente, un bot compara la firma de su ADN con la del
que ve ([[sysvars/my]] y [[sysvars/ref]]), que es una aproximación. El tutorial
[[tutoriales/reconoce-especie]] lo desarrolla.

## Cuando los bots mutan {#mutaciones}
<!-- core mutations.hpp (mutatecolors, Mutations, generation); 36-REPRO §2; sysvars my* (se recalculan al mutar, B6-9) -->

Con las mutaciones encendidas (ver [[simulacion/mutaciones]]), los hijos no son
copias exactas de la madre y, con el tiempo, el ADN de una especie se aleja del
original. En esta versión **el nombre no cambia**: los descendientes siguen siendo
de la misma especie aunque su ADN ya no se parezca al del fundador. Siguen
contando en `.totalmyspecies` y siguen siendo inmunes al veneno de sus parientes.

Lo que sí cambia, en cada bot que muta:

- **El color.** Cada mutación le corre un poco uno de los tres componentes (rojo,
  verde o azul), así que una especie que evoluciona se va volviendo de varios
  tonos.
- **La firma.** Las sysvars `my*` se recalculan, y lo que los demás ven en `ref*`
  cambia con ellas.
- **La cuenta de mutaciones**, que se va sumando de madre a hija.
- **La subespecie.** El bot recibe un número de subespecie nuevo dentro de su
  especie (lo mismo pasa cuando lo infecta un virus, ver
  [[simulacion/virus#infeccion]]), y sus hijos lo heredan. Es una etiqueta
  interna: el ADN no la ve y no cambia nada de lo de arriba; solo sirve para
  medir cuántas variantes conviven en una especie.
<!-- core mutations.hpp (NewSubSpecies al mutar), robots.hpp Reproduce (c.SubSpecies = p.SubSpecies); 35-VIRUS §3.5; wasm CalcStats (SPECIESDIVERSITY_GRAPH cuenta subespecies distintas) -->

### Especies nuevas por mutación {#autoespeciacion}
<!-- 36-REPRO §4 (auto-especiación); core mutations.hpp (renombrado "(k)Nombre", tope 49); web2/PLAN.md C7 -->

El motor del DarwinBots original sabe además partir una especie en dos: la
_autoespeciación_. Cuando un bot acumula más mutaciones que cierto porcentaje del
largo de su ADN (un ajuste que se guarda con la simulación), se rebautiza y funda una especie nueva. El nombre nuevo es el
viejo con un número entre paréntesis adelante: `(12)Mi bicho`. El número sale de un
contador del mundo que sube con cada especie nueva; si el nombre ya tenía un
número, se reemplaza, así que nunca se acumulan paréntesis. El bot rebautizado
vuelve a contar sus mutaciones desde 0, y sus hijos heredan el nombre nuevo. No se
crean especies nuevas si el mundo ya tiene 49 registradas.

Desde ese momento es otra especie para todo lo de arriba: su `.totalmyspecies`
cuenta aparte y el veneno de la especie madre ya no lo respeta.

:::nota
La app no tiene un control para encender la autoespeciación. El motor la cumple
solo en una simulación cargada de un archivo `.dbsim` que la traiga encendida
(ver [[tecnico/formatos]]). En una simulación armada en la app, las especies son
las que sembraste.
:::

## El linaje {#linaje}
<!-- core robots.hpp Reproduce/SexReproduce (generation, BirthCycle, parent); 36-REPRO §0.2 (matrilineal); engine/lineage.js -->

Además de su especie, cada bot tiene un número que no se repite en toda la
simulación, y el motor anota de cada uno:

- su **madre** (los sembrados no tienen; son _fundadores_);
- su **generación**: la de la madre más uno, empezando en 0 en los fundadores;
- el **ciclo en que nació** y cuántas mutaciones acumula.

En la reproducción sexual (ver [[simulacion/reproduccion]]), la «madre» es el bot
que tiene el hijo. El otro solo puso el esperma con un disparo, y no queda
registrado: el linaje es por línea materna.

## La distancia genética {#distancia}
<!-- 36-REPRO §3.3 (GeneticDistance = no emparejados / total), §0.3 (0,6), §4; 34-TIES §2.1 (0,25); wasm db_sim_vis_gendist_step; web2 genetica.js distanciaDiff -->

¿Cuánto se parecen dos bots? El motor lo mide alineando los dos ADN palabra por
palabra: busca los tramos que tienen en común y cuenta qué fracción de las
palabras quedó sin pareja. 0 son dos ADN idénticos; 1, dos que no comparten nada.

Esa medida decide dos cosas del mundo:

| Para qué | Umbral |
|---|---|
| Tener un hijo con el esperma recibido ([[.sexrepro]]) | Si la distancia pasa de 0,6, no hay hijo. |
| Compartir cloroplastos por un lazo ([[.sharechlr]]) | Si pasa de 0,25, no se comparte. |

Por eso, aunque el nombre de la especie no cambie, dos ramas que se alejaron mucho
dejan de poder cruzarse: la especie se parte en la práctica aunque el registro no
lo diga.

## Dónde se ve en la app {#app}
<!-- web2 src/i18n/es/analizar.json, mundo.json, inspector.json; engine/lineage.js (fotos, poda); analizar/filogenia.js, genetica.js -->

**En Observar** (ver [[app/observar]]), el color de los bots puede seguir a la
especie (es lo normal) o a otras medidas: generación, mutaciones, largo del ADN y
_distancia genética_, que pinta a cada bot según cuánto se parece al bot
seleccionado. Con la vista enriquecida, el inspector (ver [[app/inspector]]) muestra
la especie, la madre y los hijos vivos de un bot y, con «Familia», resalta en el
mundo a todos sus descendientes.

**En Analizar** (ver [[app/analizar]]) hay cuatro pestañas para esto:

- **Especies**: una fila por especie, con los bots vivos hoy y su máximo, en qué
  ciclo apareció y en cuál se extinguió, la generación más alta y los promedios de
  mutaciones, largo del ADN, energía, edad e hijos por bot.
- **Filogenia**: el árbol de especies (cada una cuelga de la especie de la madre
  de su primer bot) y, para una especie, el árbol de sus individuos ordenado por
  generación. Del árbol de individuos solo se guardan los vivos y sus ancestros;
  las ramas que se extinguieron sin dejar descendencia se descartan. Sin
  autoespeciación, el árbol de especies es plano: todas son fundadoras.
- **Genética**: histogramas de la población (largo del ADN, generación,
  mutaciones, edad, energía, cuerpo, genes, hijos, presas cazadas) y cómo cambian
  a lo largo de la corrida. También compara el ADN _dominante_ de una especie (el
  que más bots llevan, fotografiado cada 1000 ciclos) con el del fundador, gen por
  gen: qué genes siguen iguales, cuáles cambiaron, cuáles son nuevos y cuáles se
  perdieron.
- **Eventos**: las especies nuevas, las extinciones y los récords de población y
  de generación, marcados en el tiempo.

:::nota
La «distancia al fundador» de la pestaña Genética no es la misma medida que la del
motor: compara los dos ADN gen por gen y cuenta la fracción de palabras que
cambiaron. Sirve para ver cuánto evolucionó una especie, pero no es la que decide
si dos bots pueden cruzarse.
:::

La pestaña Genética es la manera más directa de ver la evolución en acción: en
[[tutoriales/evolucion]] hay un experimento paso a paso.
