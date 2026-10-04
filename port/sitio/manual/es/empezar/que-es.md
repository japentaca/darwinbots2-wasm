---
titulo: Qué es DarwinBots
resumen: "DarwinBots es una simulación de vida artificial: bots con ADN que se mueven, comen, se reproducen, mutan y evolucionan. Esta es la versión 2.48.32 portada al navegador."
etiquetas: [introducción, vida artificial, evolución, navegador]
estado: revisada
---
DarwinBots es una simulación de **vida artificial**. En un mundo plano viven
unos organismos simples, los _bots_, y cada uno lleva su propio programa: su
**ADN**. El ADN le dice qué hacer en cada momento: avanzar, girar, disparar
para comer, fabricar defensas, atarse a otro, reproducirse. Nadie maneja a los
bots desde afuera; vos armás el mundo y mirás qué pasa.

Lo interesante empieza cuando los bots se reproducen. Al copiar el ADN para el
hijo puede colarse un error al azar, una _mutación_. Casi siempre el cambio
rompe algo o no cambia nada que se note, pero de vez en cuando sale un bot que
come mejor, escapa mejor o se reproduce más rápido. Si deja más hijos que sus
vecinos, su versión del ADN se va quedando con el mundo. Eso es evolución por
selección natural, y se puede ver pasar delante tuyo.

## Cómo es el mundo {#mundo}
<!-- simulacion/ciclo, simulacion/energia, simulacion/cloroplastos; 10-CICLO §2 -->

- El tiempo avanza en **ciclos**. En cada ciclo todos los bots ejecutan su
  ADN y el mundo responde: mueve a todos, resuelve los disparos y los choques,
  hace nacer y morir a quien corresponda y reparte la luz del sol. El orden
  exacto está en [[simulacion/ciclo]].
- Todo gira alrededor de la **energía**. Los **vegetales** la sacan de la luz;
  los demás bots casi siempre se la sacan a otro, disparándole. Con
  energía se paga moverse, pensar y tener hijos, según los costos que tenga el
  mundo (ver [[simulacion/energia]]).
- Los bots **ven** con nueve ojos, sienten cuando los tocan o los golpean, y
  pueden leer algunas cosas del bot que tienen enfrente
  (ver [[simulacion/vision]]).
- Las especies **evolucionan**: cada hijo puede nacer con el ADN un poco
  cambiado (ver [[simulacion/mutaciones]]).

El ADN es un lenguaje de programación pequeño, basado en una pila, con genes
que se activan cuando se cumplen sus condiciones. Este es un bot completo que
avanza todo el tiempo:

```adn
' Avanza siempre
cond
start
 10 .up store
stop
end
```

Si nunca programaste, no te preocupes: se puede usar la app entera sin
escribir una línea, sembrando los bots que ya existen. Y si querés aprender, el
capítulo [[adn/estructura|El lenguaje del ADN]] empieza desde cero.

## Esta versión {#esta-version}
<!-- port/README.md (Estado, Página web, Bugs del original corregidos; Bestiary: 684 bots en total); web/bots/bots.json (684 entradas); PLAN-SITIO.md S1; web2/PLAN.md decisión 17; i18n/es/inicio.json inicio.nota -->

DarwinBots nació como un programa para Windows. Esta es su versión **2.48.32**
portada a **WebAssembly**: el mismo motor de simulación, reescrito para que
corra en el navegador.

- **No se instala nada.** La app está en `darwinbots-wasm.org/app/` y funciona
  en un navegador moderno: la simulación corre en tu equipo, no en un
  servidor.
- **Lo que guardás queda en tu navegador.** Tus bots, tus corridas, tus
  escenarios y tus torneos se guardan en el almacenamiento de ese navegador,
  en ese equipo; nada se sube a un servidor. Para llevarlos a otro lado se
  exportan a archivos (ver [[app/tus-datos]]).
- **Se comporta como el original**, con una lista de errores del programa
  original corregidos a propósito. La lista y sus consecuencias están en
  [[tecnico/diferencias]].
- **Trae el Bestiario:** 684 bots que la comunidad publicó en el foro y en el
  wiki de DarwinBots a lo largo de los años, listos para sembrar.

Hay dos interfaces. La **app nueva**, en español y en inglés, es la que
describe este manual. La **interfaz clásica**, en `/classic/`, es la primera
versión web, en inglés y más parecida al programa original; se sigue
publicando tal cual (ver [[app/clasica]]).

## Qué podés hacer {#que-hacer}
<!-- web2/src/i18n/es/app.json (app.pantalla.*.desc); i18n/es/competir.json (Elo); web2/PLAN.md decisiones 2, 10, 11, 18, 21-23 -->

| Si querés… | Andá a | Y leé |
|---|---|---|
| **Mirar** un mundo vivo: cómo cazan, se esconden y se multiplican | Inicio y Observar | [[empezar/primera-simulacion]] |
| **Experimentar**: cambiar la luz, los costos, la física, poner obstáculos, y ver qué pasa | Experimentar | [[app/experimentar]] |
| **Medir**: gráficos de población, especies, árbol genealógico, réplicas con varias semillas, informes | Analizar | [[app/analizar]] |
| **Escribir bots**: un editor de ADN con avisos, prueba rápida y versiones | Bots | [[app/editor]] y los [[tutoriales/se-mueve|tutoriales]] |
| **Competir**: partidos y torneos entre bots, con tabla, Elo y modo TV | Competir | [[app/competir]] |

## Por dónde seguir {#seguir}
<!-- solo enlaces; el orden sigue port/sitio/indice.mjs -->

1. [[empezar/primera-simulacion]]: de abrir la app a tener un mundo corriendo,
   con un bot tuyo adentro, en unos minutos.
2. [[empezar/recorrido]]: para qué sirve cada sección de la app.
3. [[tutoriales/se-mueve]]: tu primer bot, paso a paso.
4. [[simulacion/ciclo]]: cómo funciona el mundo por dentro.

Si te cruzás con una palabra que no conocés, está en el [[empezar/glosario]].
Las dudas más comunes están en [[empezar/preguntas]].
