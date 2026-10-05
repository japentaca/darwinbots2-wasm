---
titulo: Tu primer experimento de evolución
resumen: "Paso a paso: sembrá una especie con las mutaciones encendidas, dejala correr decenas de miles de ciclos y aprendé qué mirar en Observar, Analizar y el inspector para distinguir la selección de la deriva."
etiquetas: [evolución, mutaciones, experimento, genética, selección]
estado: revisada
---
En [[tutoriales/busca-comida]] escribiste un bot que se gana la vida, y en
[[tutoriales/reconoce-especie]], uno que convive con los suyos. Este tutorial es
distinto: no termina en un bot nuevo. Termina en un experimento corriendo y en
saber qué mirar mientras tu especie evoluciona.

## Preparar el experimento {#preparar}

Necesitás cuatro cosas: una especie semilla que sepa ganarse la vida, comida que
alcance, las mutaciones encendidas y tiempo. Todo se arma en
[[app/experimentar]].

**La especie semilla.** Cualquiera de estas sirve:

- el bot final de [[tutoriales/busca-comida]], si lo seguiste;
- el Animal_Minimalis_mod_stress del Bestiario: se reproduce con [[.repro]]
  cuando va bien y con [[.mrepro]] cuando viene perdiendo energía
  ([[simulacion/mutaciones#mrepro]]);
- cualquier bot simple que sepas que come y se reproduce: sin partos no hay
  mutaciones que heredar.

Conviene uno chico y que entiendas: cuando un descendiente cambie, vas a poder
leer qué.
<!-- Animal_Minimalis_mod_stress del Bestiario; probado con el motor: contra un alga en campo chico, el mod_stress persigue, la drena de 3000 a 1638 en 40 ciclos mientras él sube a 4136, y tiene un hijo (33 %) cerca del ciclo 40; el bot final de busca-comida, igual: come, se mueve siempre y pasa de 2 a 4 bots en 100 ciclos; reverificado: el mod_stress contra un blanco quieto drena a 200 por ciclo (+209 él) y pare a los ~25 ciclos; el bot de busca-comida come y se reproduce igual -->

Los pasos:

1. En [[app/inicio|Inicio]], buscá el escenario **Sopa primordial** y tocá
   **Ajustar**: se abre en Experimentar ya cargado. Es el molde justo: un mundo
   sin costos, 15 algas, 5 animales y las mutaciones encendidas.
   <!-- web2/engine/escenarios/fabrica/sopa-primordial.json (base clasica, sin cambios: costos 0, mutaciones encendidas) -->
2. En **Especies a sembrar**, quitá el animal con la **×** de su fila y sumá tu
   semilla con **Agregar especie**: **Un bot de la biblioteca (por nombre)** o
   **Pegar ADN**. Dejá las algas: son la comida. Con 5 bots de semilla alcanza;
   cada especie que agregás desde acá arranca con 3000 de energía.
   <!-- app/experimentar #especies (DialogoEspecie; 3000 fijo) -->
3. Fijate que **Mutaciones** diga **Sí**. Y no toques nada más: la app siembra
   cada especie con su tabla de mutaciones encendida y las tasas de fábrica, así
   que con el interruptor alcanza.
   <!-- 40-MUTACIONES §1; core db_sim_add_species (SetDefaultMutationRates y Mutations = True); simulacion/mutaciones #quien-muta -->
4. Elegí la **Semilla** y tocá **Nueva simulación**. La app arma el mundo, lo
   pone a correr y te lleva a Observar.

:::cuidado
El escenario **Partido F1** y el botón **Ajustes F1** apagan las mutaciones. Si
venís de ahí, volvé a encenderlas a mano.
:::
<!-- opciones.js F1_NOMBRADAS (mutations: 0); empezar/preguntas #no-evolucionan -->

## Correr y mirar {#mirar}

Poné la velocidad en **Máx.**: la evolución se ve en decenas de miles de ciclos,
no en cientos. Después, tres lugares.
<!-- empezar/preguntas #no-evolucionan (falta tiempo); app/observar #tiempo -->

**Observar** ([[app/observar]]). El gráfico **Población por especie** y la
tarjeta **Generación máx.** dicen lo básico: si hay partos (la generación sube)
y si la población se sostiene. La lista **Eventos** anota las generaciones
récord. Y el selector **Color por** cambia el tono de los bots:
**Mutaciones** pinta según cuántas acumula cada uno, **Generación** según su
edad genealógica, y **Distancia genética** según cuánto se parece al bot que
hayas elegido.
<!-- web2/src/lib/mundo/render-enriquecido.js (lentes); i18n/es/mundo.json mundo.lente.*; lib/observar/PanelVivo.svelte -->

**Analizar** ([[app/analizar]]), con la corrida en vivo. Cuatro pestañas
sirven para esto:

- **Especies**: una fila por especie, con el promedio de **Mutaciones**, la
  **Gen. máx.**, el **ADN medio** y los **Hijos por bot**.
- **Filogenia**: el árbol de individuos de tu especie, ordenado por
  generación. Tocá un bot y la tarjeta dice su madre, sus mutaciones, el largo
  de su ADN y sus hijos.
- **Genética**: histogramas de la población (largo del ADN, generación,
  mutaciones, hijos) y la vista más directa de todas, **ADN dominante vs
  fundador**: cada 1000 ciclos la app fotografía el ADN que llevan más bots y
  lo compara gen por gen con el del fundador — qué genes siguen iguales, cuáles
  cambiaron, cuáles son nuevos.
- **Eventos**, y los **Hallazgos** del Panel: un **dominio**, una
  **sustitución** o un **colapso**, escritos en castellano y con su ciclo.
  <!-- web2/src/lib/analizar/Genetica.svelte, Especies.svelte, Filogenia.svelte; web2/engine/lineage.js (fotos del dominante); lib/analizar/hallazgos.js -->

**El inspector** ([[app/inspector]]). Cuando veas un bot con el color corrido,
hacé clic: la cabecera dice su generación y cuántas mutaciones acumula, y la
pestaña **ADN** muestra su programa tal como lo tiene ahora, cambios
incluidos. **Copiar** te lo lleva entero; **Familia** resalta a sus
descendientes en el mundo.
<!-- i18n/es/inspector.json inspector.mut.*, inspector.adn.*; lib/inspector/Familia.svelte -->

## Qué esperar {#esperar}

Con las tasas de fábrica, en un bot de 20 instrucciones se midió que nace
cambiado más o menos 1 de cada 60 hijos concebidos con [[.repro]], y casi 1 de
cada 5 con [[.mrepro]]. Es una medición, no una ley: la proporción depende del
largo del ADN y de las tasas. Y la evolución pasa casi toda por los partos: en
vida casi nada cambia. Los números están en [[simulacion/mutaciones#tasas]] y
[[simulacion/mutaciones#mrepro]].
<!-- medido con las mutaciones encendidas (contar-mut, ADN de 20 instrucciones, tasas de fábrica): 8 hijos mutantes de 497 partos con .repro (≈1 en 62) y 91 de 515 con .mrepro (≈1 en 5,7); con las mutaciones apagadas, 0 de 570. Tasas de vida: 40-MUTACIONES §0.2 -->

Lo demás es biología:

1. **Casi toda mutación rompe algo.** Los mutantes aparecen de a uno, y la
   mayoría vive menos que el fundador: un `start` borrado, un número corrido, un
   gen que deja de encenderse ([[simulacion/mutaciones#que-cambia]]). Es normal
   que las primeras decenas de miles de ciclos no pase nada visible.
2. **Un mutante que prospera** se reconoce así: sus descendientes ocupan la
   población, el **ADN dominante** de Genética cambia de foto y, en Filogenia,
   su rama es la gruesa. El cambio puede ser chico: un umbral de disparo más
   bajo, un giro más corto.
3. **El color es tu primer indicador.** Cada mutación corre un poco un canal
   del color de la especie, así que una especie que evoluciona se vuelve de
   varios tonos: cada tono es, más o menos, un linaje.
   <!-- 40-MUTACIONES §1 (mutatecolors); simulacion/especies #mutaciones -->
4. **Deriva o selección.** Que un cambio se quede no quiere decir que sirvió:
   en poblaciones chicas, un linaje neutro puede quedarse por pura suerte. La
   prueba es repetir: en [[app/analizar#comparar|Comparar]], las **Réplicas**
   vuelven a correr el escenario con otras semillas. Si en la mayoría gana un
   cambio parecido, es selección; si cada corrida cuenta otra historia, lo que
   viste fue deriva.
   <!-- web2/src/lib/analizar/comparar/Replicas.svelte; web2/engine/replicas.js -->

## Si el experimento se apaga {#apagado}

Tres señales de que algo no anda: la población animal cae y no vuelve a
levantarse (los **Hallazgos** lo escriben como colapso); la generación máxima
no se mueve — no hay partos, y sin partos no hay evolución —; los vegetales
desaparecen y el mundo se queda sin energía.
<!-- lib/analizar/hallazgos.js (Colapso); simulacion/cloroplastos (toda la energía entra por los vegetales) -->

Qué ajustar, todo en [[app/experimentar]] con **Aplicar a la actual**, sin
empezar de cero:

1. **Comida**: subí la **Energía solar** ([[param:base:maxEnergy]]) o la
   **Repoblación de vegetales** ([[param:base:minVegs]]), o agrandá el **Tope
   de vegetales** ([[param:base:maxPopulation]]).
2. **Costos**: si los subiste, probá otra vez con **Sin costos**; un mundo que
   mata de hambre a todos no deja nada evolucionar.
3. **Energía inicial**: en Observar, **Sembrar** deja elegir la energía con la
   que entran los bots nuevos: sembrá unos pocos con más energía para relanzar
   la población.
   <!-- app/observar #sembrar (Energía inicial del diálogo) -->
4. **Tiempo**: la mayoría de los experimentos que «no funcionan» funcionan,
   solo que todavía.

## Variantes {#variantes}

- **Explorar más rápido.** Cambiale el [[.repro]] por [[.mrepro]] a tu semilla
  (o usá el Animal_Minimalis_mod_stress, que ya lo hace cuando está en apuros):
  cada hijo nace con diez veces más probabilidades de mutar, solo por ese
  parto. Vas a ver mutantes enseguida — y también su precio: la mayoría nace
  roto, y el histograma de mutaciones de Genética se corre a la derecha.
  <!-- 36-REPRO §2 (tasas ÷10, solo para ese parto); simulacion/mutaciones #mrepro -->
- **Reproducción sexual.** Con [[.sexrepro]] el hijo ya nace distinto porque
  mezcla el ADN de dos bots, aunque no mute nada; y cuando dos ramas se alejan
  mucho, dejan de poder cruzarse — la distancia genética decide
  ([[simulacion/reproduccion]], [[simulacion/especies#distancia]]).
- **Un mundo hostil.** El mundo de fábrica es amable. Empujá: cobrá **Costos**
  (el control básico de Experimentar), encendé **Día y noche** — de noche los
  vegetales no fabrican y los ojos ven un 20 % menos —, bajá los vegetales o
  achicá el campo. Cada presión empuja la evolución para otro lado: con costos,
  los que gastan poco; con noche, los que aguantan el oscuro.
  <!-- app/experimentar #controles (Costos, Día y noche); 32-VISION §0.4 (noche: 20 % menos alcance); 50-MUNDO §2.2 (de noche no toca comer) -->

## Y ahora {#ahora}

<!-- app/informes (informe de una corrida guardada); app/inspector #adn (Copiar el ADN del bot); web2/src/lib/analizar/comparar/Replicas.svelte (Réplicas con otras semillas) -->

- Guardá la corrida (**Guardar**, en Observar) y armá un informe con sus
  hallazgos: [[app/informes]].
- Si un descendiente te gusta, copiá su ADN desde el inspector y guardalo como
  bot tuyo en [[app/bots]]; el [[app/editor|editor de ADN]] te ayuda a leer qué
  cambió.
- Antes de sacar conclusiones, repetí con otras semillas
  ([[app/analizar#comparar|Comparar]] › **Réplicas**).
- Si algo no anduvo como esperabas, la lista está en [[empezar/preguntas]].
