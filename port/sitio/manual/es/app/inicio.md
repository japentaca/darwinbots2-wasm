---
titulo: Inicio
resumen: "La pantalla con la que abre la app: la última corrida, los escenarios para empezar, abrir un .txt o un .dbsim, tus corridas guardadas y los bots recientes."
etiquetas: [inicio, escenarios, corridas, archivos, continuar]
estado: revisada
---
Inicio es la primera pantalla de la app y el lugar al que volvés para cambiar de
corrida. Desde acá arrancás un mundo nuevo a partir de un escenario, seguís el
que dejaste corriendo, retomás uno guardado o abrís un archivo. Se llega con
**Inicio** en la barra de arriba o haciendo clic en el nombre **DarwinBots**.

La pantalla tiene dos columnas. A la izquierda, la tarjeta de la última corrida
y la galería de escenarios; a la derecha, tus **Corridas guardadas** y los
**Bots recientes**.

:::nota
Una _corrida_ es una simulación con todo lo que la define: el escenario del que
salió, su semilla y lo que le fuiste cambiando mientras corría. Por eso una
corrida guardada se puede retomar o repetir. Más en [[tecnico/semillas]].
:::

## La última corrida {#ultima}
<!-- corrida-nucleo.js cargar («No arranca la sim»); sesion.svelte.js cargar (corriendo = false) -->
<!-- web2/src/screens/Inicio.svelte (tarjeta «ultima»); i18n/es/inicio.json inicio.ultima.*, inicio.vacio.* -->

La tarjeta de arriba cambia según lo que haya:

| Qué hay | Qué muestra | Botones |
|---|---|---|
| Un mundo en memoria (lo que dejaste en Observar) | **Última corrida**: una miniatura del mundo, el nombre, el ciclo, cuántos bots y especies tiene, y si está guardada («guardada hace…») o «sin guardar» | **Continuar** y **Ver análisis** |
| Nada en memoria, pero corridas guardadas | **Última corrida guardada**: la más reciente, con su miniatura y sus datos | **Retomar** |
| Nada de nada | **Todavía no hay corridas** | **Elegir un escenario**, que baja hasta la galería |

**Continuar** te lleva a [[app/observar]] con el mundo tal como estaba, sin
recargar nada. **Ver análisis** abre [[app/analizar]] sobre esa misma corrida.
**Retomar** carga la corrida guardada y te lleva a Observar en pausa: hacé clic ens
**Iniciar** para que siga.

El mundo en memoria vive mientras la pestaña esté abierta. Si recargás la página
se pierde lo que no guardaste; lo guardado sigue en la lista de la derecha.

## Escenarios {#escenarios}
<!-- Inicio.svelte (galería); engine/escenarios/fabrica/*.json; i18n inicio.escenarios.*, inicio.etiqueta.* -->

Un escenario es una configuración lista para empezar: qué bots se siembran,
cuántos, de qué color, y con qué ajustes del mundo. La galería muestra una vista
previa de cada uno, su nombre, una descripción corta y unas etiquetas (el tema y
cuántas especies trae). La app viene con estos:

| Escenario | De qué se trata |
|---|---|
| **Sopa primordial** | Algas y un animal mínimo en el mundo por defecto, con mutaciones: el punto de partida para ver evolucionar a una especie. |
| **Depredador y presa** | Un cazador sobre un campo de algas: ¿se agota la comida o se equilibran las poblaciones? |
| **Partido F1** | Dos bots de liga F1 frente a frente con los ajustes de la liga. |
| **Día y noche** | El sol se pone cada 1000 ciclos y la población oscila. |
| **Laberinto** | Un laberinto en espiral que los bots pueden ver. |
| **Océano** | Física de agua en un mundo que se cierra sobre sí mismo; las algas flotan a la deriva. |
| **Archipiélago** | Diez islas de roca al azar y dos teleporters. |

Cada tarjeta tiene dos botones:

- **Iniciar** crea el mundo con una semilla nueva, lo pone a correr y te lleva a
  Observar. Dos veces **Iniciar** sobre el mismo escenario dan dos mundos
  distintos: cambia la semilla.
- **Ajustar** abre el escenario en [[app/experimentar]], donde cambiás especies y
  parámetros antes de arrancar.

**Partido F1** es distinto: en vez de **Iniciar** dice **Elegir bots** y te lleva
a [[app/competir]], porque un partido se arma eligiendo a los rivales.

Los escenarios que guardes desde Experimentar aparecen en la misma galería
después de los de fábrica, con la etiqueta **Propio**. El enlace
**Configuración propia**, arriba a la derecha de la galería, también lleva a
Experimentar. Cómo se arma y se comparte un escenario está en [[app/escenarios]].

:::cuidado
Si hay un mundo en memoria con cambios sin guardar, **Iniciar**, **Retomar** o
abrir un archivo te preguntan antes de reemplazarlo: «La simulación en curso
tiene cambios sin guardar y se va a reemplazar. ¿Seguir?». Si querés
conservarla, cancelá y guardala desde Observar.
:::

## Desde un archivo {#archivo}
<!-- corrida-nucleo.js importarDbsim (no arranca; aviso observar.aviso.importada «pulsá Iniciar»); Inicio.svelte abrirArchivo; lib/inicio/desde-txt.js (CANTIDAD_BOT 10, alga de sopa-primordial, base clásica); i18n inicio.archivo.*, inicio.error.txtVacio -->

La última tarjeta de la galería, **Desde un archivo**, abre dos clases de
archivo con el botón **Elegir archivo**:

- **Un `.dbsim`**: una simulación guardada, tuya o de otra persona. Se carga en
  pausa y te lleva a Observar: hacé clic ens **Iniciar** para que siga.
- **Un `.txt` con el ADN de un bot**: la app arma un mundo mínimo para probarlo y
  lo pone a correr.

Con un `.txt`, el mundo nuevo es el de los valores por defecto, con las algas de
**Sopa primordial** y diez copias de tu bot. El bot toma el nombre del archivo
(sin el `.txt`) y un color propio; la corrida se llama «_bot_ con algas». Si tu
bot se llama igual que el alga, se siembra solo tu bot.

Es la forma más rápida de ver si un bot que escribiste hace algo. El formato del
archivo está en [[adn/formato|el formato .txt]]; si el ADN tiene palabras que el motor no
reconoce, Observar te avisa cuántas son (valen 0). Un `.txt` vacío o con solo
comentarios no se siembra: la app avisa que no hay nada que sembrar.

Para algo más elaborado (otras especies, más copias, otro mundo), sembrá el bot
desde [[app/observar#sembrar]] o armá un escenario en Experimentar.

## Corridas guardadas {#corridas}
<!-- Inicio.svelte (lateral); CORRIDAS_LATERAL 4; i18n inicio.corridas.* -->

La columna de la derecha lista las corridas que guardaste desde Observar, la más
reciente arriba: nombre, ciclo, cuántos bots tenía y cuándo la guardaste. La que
está cargada ahora lleva la marca **en curso**.

1. Hacé clic en una fila para retomarla. Si es la que ya está en memoria, te lleva a
   Observar sin recargarla.
2. Si tenés más de cuatro, **Ver todas** despliega la lista entera y **Ver menos**
   la vuelve a acortar.
3. **Importar .dbsim** abre un archivo de simulación, igual que la tarjeta
   **Desde un archivo**.

Para borrar una corrida guardada, usá **Corridas** en Observar
([[app/observar#guardar]]).

## Bots recientes {#bots-recientes}
<!-- lib/inicio/recientes.js (MAX_RECIENTES 4, categoría del Bestiary); i18n inicio.bots.*, inicio.categoria.* -->

Debajo aparecen hasta cuatro bots de tu corrida actual y de las guardadas, con
su color y su categoría en la biblioteca (F1, F2, Vegetal, Propio…). Cada nombre
abre su ficha en [[app/bots|la biblioteca]]. El enlace **Biblioteca completa** lleva a la
biblioteca entera, con la cuenta de bots que trae.

## Dónde queda todo {#datos}
<!-- i18n inicio.nota; lib/recarga.js (con una corrida en memoria no recarga sola: lo no guardado se pierde al recargar) -->

Las corridas, los bots propios, los escenarios propios y los torneos se guardan
en este navegador, no en un servidor. Si cambiás de equipo o de navegador no
están: exportalos antes. Cómo hacerlo, y qué pasa si el navegador borra sus
datos, está en [[app/tus-datos]].

Si es tu primera vez, [[empezar/primera-simulacion]] te lleva paso a paso desde
**Sopa primordial** hasta tu primera corrida guardada.
