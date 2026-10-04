---
titulo: Escenarios
resumen: "Qué es un escenario, qué trae cada uno de fábrica y cómo crear, guardar, exportar y compartir los tuyos."
etiquetas: [escenarios, configuración, exportar, importar, json]
estado: revisada
---
Un **escenario** es una configuración completa de la simulación, lista para
arrancar. Lleva tres cosas:

- **Los parámetros**: una _base_ (**Clásica** o **Liga F1**) más los cambios
  que el escenario le hace.
- **Las especies** que se siembran: qué bot, cuántos, de qué color, si es
  vegetal y con cuánta energía arranca.
- **Los objetos del mundo**: obstáculos, laberintos y teleporters.

Además tiene nombre, una descripción y etiquetas. Lo que **no** lleva es la
semilla: esa se elige al lanzar la simulación. El mismo escenario con
distintas semillas da mundos parecidos pero con su propia historia; con la
misma semilla, da la misma simulación (ver [[tecnico/semillas]]).

<!-- web2/engine/escenarios/index.js (formato 1); PLAN.md decisión 12; i18n experimentar.escenarios.ayuda -->

## Dónde aparecen {#donde}
<!-- web2/src/screens/Inicio.svelte (galería, iniciar, Ajustar → #/experimentar/<id>, destino competir); lib/inicio/VistaEscenario.svelte, vista.js (puntosVista: entre 2 y 30 puntos por especie según la cantidad); Experimentar.svelte (marca F1 si base === 'f1'); Experimentar.svelte aside.lateral -->

En **[[app/inicio|Inicio]]**, en la sección **Escenarios**, cada uno tiene
una tarjeta con una vista previa, su descripción y sus etiquetas. La vista
previa es un dibujo esquemático, no el mundo real: puntos del color de cada
especie, más o menos según su cantidad (hexágonos los vegetales, círculos los
animales), los muros en gris y los teleporters como anillos. Cada tarjeta tiene dos botones:

- **Iniciar** arranca el escenario con una semilla al azar y te lleva a
  Observar. Si la simulación que corre tiene cambios sin guardar, primero
  pregunta.
- **Ajustar** lo abre en [[app/experimentar]] para cambiarlo antes de
  lanzarlo.

En **Experimentar**, la columna izquierda los lista en dos grupos:
**Escenarios de fábrica** y **Míos**. Tocar uno lo carga en el borrador. Los
que usan la base Liga F1 llevan la marca **F1**.

## Los escenarios de fábrica {#fabrica}
<!-- web2/engine/escenarios/fabrica/*.json; fabrica.js (orden); probado: t1.mjs (cantidad de cambios y energía 3000 en todos) -->

La app trae siete. Todos parten de la base Clásica salvo el Partido F1, y en
todos las especies arrancan con 3000 de energía.

| Escenario | Especies | Qué cambia del mundo | Para qué sirve |
|---|---|---|---|
| **Sopa primordial** | 15 Alga minimalis 3.0 (vegetal) y 5 Animal Minimalis | Nada: el mundo por defecto, con mutaciones. | El punto de partida para ver evolucionar a una especie. |
| **Depredador y presa** | 25 Alga minimalis 3.0 (vegetal) y 5 Zebedee V2.1 | Energía solar en 20 (el doble). | Ver si la comida se agota o las poblaciones se equilibran. |
| **Partido F1** | 5 Alga minimalis 3.0 (vegetal), 5 Devincio Dominator y 5 Carnatus Orbis | Base Liga F1: costos, física y campo 9237 × 6928 toroidal. | Un enfrentamiento con reglas de liga. |
| **Día y noche** | 20 Alga minimalis 3.0 (vegetal) y 5 Animal Minimalis | Día y noche de 1000 ciclos. | Ver oscilar a la población cuando de noche no hay sol. |
| **Laberinto** | 20 Alga minimalis 3.0 (vegetal) y 8 Animal Minimalis | Un laberinto en espiral, y los bots ven las formas. | Ver quién aprende a moverse entre las paredes. |
| **Océano** | 20 Alga Cohesum (vegetal) y 6 Hunter V2.2 | Medio fluido (agua) y mundo toroidal. | Un cazador persiguiendo algas a la deriva. |
| **Archipiélago** | 20 Gardener veggie (vegetal) y 6 Animal Minimalis | Diez islas de roca al azar, dos teleporters y mundo toroidal. | Poblaciones separadas por obstáculos. |

En la tabla los nombres de los bots van abreviados: el nombre completo de
cada uno está en la lista de especies de Experimentar y en [[app/bots]].

El **Partido F1** es distinto de los demás: en Inicio su botón dice **Elegir
bots** y te lleva a [[app/competir]], donde elegís quién se enfrenta. Desde
Experimentar se lanza como cualquier otro.

Los de fábrica no se pueden modificar ni borrar. Para cambiar uno, cargalo y
editá el borrador; si querés conservar el resultado, guardalo como propio.

## Crear un escenario propio {#crear}
<!-- Experimentar.svelte (abrirGuardar, guardar, duplicarFabrica); DialogoEscenario.svelte; archivo.js comoPropio, duplicar, idLibre, parsearEtiquetas -->

Hay tres caminos.

**Desde el borrador.** Es el más común:

1. En Experimentar, cargá el escenario que más se parezca a lo que querés (o
   entrá con **Configuración propia** desde Inicio).
2. Cambiá parámetros, especies y lo que haga falta (ver [[app/experimentar]]
   y [[app/experimentar-avanzado]]).
3. Tocá **Guardar como escenario**.
4. Completá **Nombre**, **Descripción** (opcional) y **Etiquetas**,
   separadas por comas.
5. Confirmá con **Guardar**.

El escenario aparece en **Míos** y en la galería de Inicio, con la marca
**Propio**.

**Duplicando uno de fábrica.** Con un escenario de fábrica cargado, **Duplicar
como propio** crea al instante una copia tuya, con el nombre «… (copia)», y
la deja abierta para editar. La copia conserva todo, incluido el comportamiento
especial del Partido F1 en Inicio.

**Desde la Biblioteca.** Elegí uno o varios bots en [[app/bots]] y, en el
diálogo para sembrarlos, usá **Nuevo escenario con estos**: crea un
escenario propio con esas especies, en el mundo por defecto, y lo abre en
Experimentar. Ese diálogo también deja elegir la **Energía inicial**, que
Experimentar no permite cambiar.

## Modificar o borrar uno propio {#modificar}
<!-- Experimentar.svelte (tipoBase propio: botón Borrar, diálogo borrar.pregunta); DialogoEscenario.svelte (reemplazable, casilla marcada por defecto) -->

Para cambiar un escenario tuyo, cargalo, editá el borrador y tocá **Guardar
como escenario**. Como el borrador salió de un propio, el diálogo ofrece la
casilla **Reemplazar «…»**, ya marcada: así se pisa el escenario original.
Si la desmarcás, se guarda como uno nuevo y el original queda como estaba.

Con un escenario propio cargado aparece el botón **Borrar**, que pide
confirmación. Borrar el escenario no cierra el borrador: lo que tenías
abierto sigue ahí hasta que elijas otro.

## Exportar, importar y compartir {#compartir}
<!-- Experimentar.svelte (exportar: descarga del borrador; importar: input .json); archivo.js exportarEscenario, importarEscenario (renombra id ocupado o de fábrica), textoValidacion (hasta 8 errores en el aviso); probado: t2.mjs (importar Sopa primordial → sopa-primordial-2; errores clave-derivada, especie-cantidad, especie-color) -->

Tus escenarios se guardan en este navegador (en una ventana privada, o con
el almacenamiento bloqueado, no se pueden guardar). Para llevarlos a otro
equipo o pasárselos a alguien, se exportan como archivo .json. Qué más
guarda la app y dónde está en [[app/tus-datos]].

- **Exportar** descarga el borrador tal como está en pantalla, con o sin
  guardar, y sea de fábrica o propio.
- **Importar .json** lee un archivo exportado, lo guarda en **Míos** y lo
  abre. Si ya tenés un escenario con el mismo identificador, o es el de uno
  de fábrica, el importado se guarda como uno nuevo, con otro identificador,
  y el aviso lo dice. Nunca pisa nada.

Si el archivo tiene problemas, no se importa, y el aviso lista lo que encontró
(hasta ocho errores): una cantidad fuera de 1 a 10000, un color mal escrito,
un parámetro que no existe, uno que no se puede fijar porque depende de
otros.

Un detalle sobre los bots, porque decide si el escenario funciona en otro
navegador:

- Los bots del **Bestiario** van solo por su nombre. Funcionan en cualquier
  lado, porque el Bestiario es el mismo para todos.
- Los **tuyos**, los de prueba y los de ADN pegado viajan con el ADN adentro
  del archivo: quien lo importe no necesita tenerlos.

Si al lanzar falta el ADN de un bot (por ejemplo, un nombre que no está en
el Bestiario), la app lo avisa con el nombre del bot, para que lo quites o
lo vuelvas a agregar.

## El archivo por dentro {#archivo}
<!-- archivo.js exportarEscenario (JSON.stringify con sangría 2); probado: t2.mjs (Día y noche → propio con día de 3000) -->

El .json se puede leer y editar con cualquier editor de texto. Este es un
escenario propio hecho a partir de Día y noche, con el día estirado a 3000
ciclos:

```json
{
  "formato": 1,
  "id": "noches-largas",
  "nombre": "Noches largas",
  "descripcion": "Día y noche de 3000 ciclos.",
  "etiquetas": ["ambiente"],
  "destino": "observar",
  "opciones": {
    "base": "clasica",
    "cambios": { "opt:33": 1, "opt:34": 3000 }
  },
  "especies": [
    { "bot": "Alga minimalis 3.0", "origen": "bestiario", "cantidad": 20,
      "color": "#30d030", "vegetal": true, "energia": 3000, "hash": "7688556d" },
    { "bot": "Animal Minimalis (4G)(Numsgil)-10.03.05", "origen": "bestiario",
      "cantidad": 5, "color": "#ff4040", "vegetal": false, "energia": 3000,
      "hash": "b011392f" }
  ],
  "objetos": { "obstaculos": [], "teleporters": [] }
}
```

En `cambios` van solo los parámetros que difieren de la base, con su clave:
`opt:33` es [[param:opt:33]] y `opt:34` es [[param:opt:34]]. Las claves de
cada parámetro están en sus fichas, a partir de [[app/experimentar-avanzado]].
`energia` es la energía inicial de cada bot (de 0 a 32000), y `hash` es una
huella del ADN que permite notar si el bot cambió. El formato completo está
en [[tecnico/formatos]].

## Escenarios como reglas de un torneo {#torneos}
<!-- i18n/es/competir.json competir.reglas.escenario(.desc); lib/competir/asistente.js -->

Al armar una competencia en [[app/competir]], las reglas pueden salir
**Desde Experimentar**: se toman los parámetros y los objetos de un
escenario (de fábrica, propio o el borrador que tengas abierto), sin sus
especies, porque los competidores los elegís aparte. Es la forma de correr
un torneo en tu propio mundo: armás el escenario, lo guardás y lo usás como
reglas.
