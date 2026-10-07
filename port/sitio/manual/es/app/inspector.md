---
titulo: El inspector
resumen: "El panel de un bot en Observar: su resumen, lo que siente, su memoria, su ADN, su consola, su familia, el diseñador de ojos y el Player Bot para manejarlo con el teclado."
etiquetas: [inspector, memoria, sentidos, consola, ojos, player bot]
estado: revisada
---
El inspector es la pestaña **Bot** del panel lateral de [[app/observar]]:
elegir un bot salta a ella. Muestra qué tiene, qué ve, qué hay en su memoria y qué genes de
su ADN corrieron, y deja tocar algunas cosas: escribir en su memoria, mover sus
ojos o manejarlo con el teclado.

## Cómo se abre {#abrir}
<!-- web2/src/screens/Observar.svelte (inspectorVisible → Inspector, si no PanelVivo); Mundo.svelte alSoltar; Inspector.svelte cerrar, morir; i18n/es/inspector.json inspector.cerrar, inspector.murio* -->

- **Un clic sobre un bot** en el mundo.
- **Buscar el mejor**, en la barra de Observar, elige al más apto y lo abre.
- Desde el mismo inspector, los números de la madre, los hijos o los ancestros
  son enlaces: abren el inspector de ese pariente.

Para cerrarlo, hacé clic en **×** (**Cerrar el inspector**) o hacé clic en un lugar
vacío del mundo; el panel vuelve a la pestaña de antes (**En vivo**, o
**Torneo** si hay un torneo en curso). Si el bot muere mientras lo
mirás, aparece **El bot murió**: los datos quedan como estaban en su último
ciclo y **Cerrar** cierra el panel.

El panel se actualiza solo varias veces por segundo mientras la simulación
corre. En pausa, **Un ciclo** lo hace avanzar de a un paso.

## La cabecera {#cabecera}
<!-- Inspector.svelte (subtitulo, estados); i18n inspector.gen, inspector.mut.*, inspector.edad, inspector.estado.*, inspector.sinVistaRica -->

Arriba van el color y el nombre de su especie, su número (el que lo identifica
en toda la corrida), su generación, cuántas mutaciones acumuló y su edad en
ciclos. Debajo, unas etiquetas marcan su estado cuando corresponde:

| Etiqueta | Qué significa |
|---|---|
| **vegetal** | hace fotosíntesis ([[simulacion/cloroplastos]]) |
| **fijo** | no se mueve ([[.fixed]]) |
| **paralizado** | le pegó veneno ([[.paralyzed]]) |
| **envenenado** | le pegó toxina ([[.poisoned]]) |
| **con virus** | tiene un virus en incubación ([[.vtimer]], ver [[simulacion/virus]]) |
| **fertilizado** | recibió esperma ([[.fertilized]]) |

La especie, el linaje y los parientes necesitan la vista enriquecida. Con la
clásica, el inspector lo avisa y ofrece **Activar la vista enriquecida**.

## Seguir, Familia y Distancia genética {#acciones}
<!-- Inspector.svelte (acciones: onSeguir, alternarFamilia, alternarGendist); Familia.svelte (TOPE 12); render-clasico.js dibujarFamilia; i18n inspector.seguir*, inspector.familia*, inspector.gendist* -->

Tres botones debajo de la cabecera:

- **Seguir** / **Dejar de seguir**: la cámara acompaña al bot. Arrastrar el
  mundo lo suelta.
- **Familia**: resalta en el mundo a los descendientes del bot y dibuja las
  líneas que los unen. Abre una tarjeta con cuántos descendientes vivos tiene,
  su **Madre**, sus **Hijos vivos** y sus **Ancestros vivos**; cada número es un
  enlace a ese bot. **Quitar el resaltado** la cierra.
- **Distancia genética**: pinta a todos los bots según cuánto difiere su ADN
  del de este. Es el **Color por** de la vista enriquecida
  ([[app/observar#color-por]]); si estabas en la clásica, la cambia.

## Resumen {#resumen}
<!-- lib/inspector/Resumen.svelte (RECURSOS, chispa VENTANA 1000, ojos, genes, linaje); i18n inspector.recurso*, inspector.energia*, inspector.vision*, inspector.genes*, inspector.linaje* -->

La primera pestaña junta lo que más se mira:

- **Barras de reservas**: **Energía** ([[.nrg]]), **Cuerpo** ([[.body]]),
  **Veneno** ([[.venom]]), **Caparazón** ([[.shell]]) y **Desechos**
  ([[.waste]]), con su valor. Cada barra se llena en proporción al máximo entre
  los bots vivos, así que una barra llena dice «el que más tiene», no «el tope».
- **Energía**: una curva de su energía en los últimos 1000 ciclos.
- **Visión**: una columna por ojo, de [[.eye1]] a [[.eye9]], que crece con lo
  que ve ese ojo; el ojo de foco va resaltado.
- **Genes activos este ciclo**: un cuadradito por gen, encendido si el gen corrió
  en el último ciclo, con la cuenta («3 de 7»). Pasá el puntero para ver el
  número de cada gen. Es la forma más directa de saber qué parte del ADN está
  usando el bot: con la simulación en pausa y **Un ciclo**, lo ves cambiar paso
  a paso. Qué hace que un gen corra está en [[adn/genes]].
- **Linaje**: su madre, cuántos hijos vivos tiene y el ancestro fundador de su
  línea.

## Sentidos {#sentidos}
<!-- lib/inspector/Sentidos.svelte (PERIODO 500), Abanico.svelte; memoria.js SENTIDOS; i18n inspector.sentidos.* -->

Lo que el bot percibe, releído cada medio segundo.

**Ojos**. Un abanico dibuja los nueve ojos como los ve el bot: la dirección y el
ancho de cada uno, y su alcance; el de foco va en rojo. Debajo, una tabla con
cada ojo: lo que ve (**Valor**), su **Dirección** ([[.eye1dir]] y siguientes),
su **Ancho** ([[.eye1width]] y siguientes) y su **Alcance**. Cómo se calcula lo
que ve cada ojo está en [[simulacion/vision]].

**Tacto**: los golpes de contacto por cada lado ([[.hitup]], [[.hitdn]],
[[.hitsx]], [[.hitdx]]), el total [[.hit]] y el ángulo [[.hitang]].

**Gusto (impactos recibidos)**: los disparos que le pegaron, por lado
([[.shup]], [[.shdn]], [[.shsx]], [[.shdx]]), su tipo [[.shflav]] y su ángulo
[[.shang]].

**Otros**: [[.pain]], [[.pleas]] y [[.daytime]].

## Memoria {#memoria}
<!-- lib/inspector/Memoria.svelte (PERIODO 500, consultas), memoria.js GRUPOS_MEMORIA, normalizarConsulta, privadas con `? .nombre`; i18n inspector.memoria.* -->

Una tabla con las sysvars más usadas del bot, su dirección y su valor,
releídos cada medio segundo. Van agrupadas: **Cuerpo y energía**,
**Movimiento**, **Acciones**, **Visión**, **Lazos** y **Contadores y memoria
libre**. Cada nombre tiene su ficha en la referencia de sysvars (por ejemplo
[[.nrg]], [[.aim]], [[.shoot]], [[.refeye]] o [[.numties]]), y en la tabla
esos nombres son enlaces: un clic abre la página de esa sysvar en el manual
(lo mismo en la tabla de ojos y en las de [[app/inspector#sentidos|los
sentidos]]). El **?** de la cabecera del inspector abre la página del
inspector.

Para mirar algo que no está en la lista, escribilo en el cuadro de arriba y
hacé clic en **Consultar**. Vale:

- el nombre de una sysvar, con o sin punto (`nrg` o `.nrg`);
- una dirección de memoria, de 1 a 999;
- el nombre de una variable que el ADN del bot definió con `def` (ver
  [[adn/def]]); esas sí distinguen mayúsculas.

La consulta queda en el grupo **Consultas**, arriba, hasta que la quitás con
**×**. Si el nombre no es nada que el bot conozca, la tabla dice «no existe».

## ADN {#adn}
<!-- lib/inspector/Adn.svelte, adn.js resaltarAdn; worker 'bot-text' (cabecera '#generation, '#mutations); i18n inspector.adn.* -->

El ADN del bot tal como lo tiene ahora, con sus mutaciones, coloreado y con
la cuenta de líneas. Empieza con unos comentarios con su generación y sus
mutaciones. **Copiar** lo pasa al portapapeles, para pegarlo en el
[[app/editor|editor de ADN]] o en un `.txt`. **Releer** lo vuelve a pedir: el ADN puede haber
cambiado si el bot mutó en vida ([[simulacion/mutaciones]]).

Esta pestaña muestra el texto; qué genes corrieron en el último ciclo se ve en
**Resumen** ([[app/inspector#resumen]]) y, con más detalle, con `debug` en la consola.

## Consola {#consola}
<!-- lib/inspector/Consola.svelte (ATAJOS, historial ↑↓), consola.js COMANDOS; engine/sim.js consoleCmd; i18n inspector.consola.* -->

La consola es la herramienta de depuración del original: lee y cambia la
memoria de este bot con comandos de texto. Escribí el comando y hacé clic en **Enviar**
(o Intro); las flechas ↑ y ↓ recorren los comandos anteriores. Los botones de
arriba mandan los más usados de un toque, y **Limpiar** borra la salida.

| Comando | Qué hace |
|---|---|
| `printeye` | estado de los ojos: lo que ve cada uno, [[.eyef]], [[.focuseye]], direcciones y anchos |
| `printtouch` | el tacto de los cuatro lados |
| `printtaste` | el gusto (impactos recibidos) de los cuatro lados |
| `printmem .var` o `? .var` | el valor de una sysvar o de una dirección (`? 310`) |
| `set .var v` | guarda `v` en una sysvar o en una dirección |
| `energy e` | pone la energía del bot en `e` |
| `cycle n` | corre `n` ciclos |
| `execrob` | ejecuta el ADN de todos los bots sin avanzar el ciclo |
| `play` / `pause` | arranca o pausa la simulación |
| `showdna` | remite a la pestaña ADN |
| `debug` | la traza del intérprete de este bot en el último ciclo |
| `help` | la lista de comandos |
| `clear` | borra la salida |

Después de cada comando se actualizan los genes activos de **Resumen**.

```
? .nrg
set .up 30
energy 5000
cycle 1
debug
```

Este ejemplo no es ADN, son líneas de consola: mira la energía, empuja al bot
hacia adelante con [[.up]], le da 5000 de energía, corre un ciclo y muestra la
traza.

:::cuidado
Lo que escribís desde la consola (`set`, `energy`) cambia la memoria de este bot
y no queda en la corrida: si la repetís, no se repite.
:::

## Control {#control}
<!-- revisor: probar-adn con 0 .setaim: 20 .sx store sube al bot (y 1107 → 1000), .up lo lleva a la derecha (x 1496 → 1602): .sx es la izquierda del bot, como sysvars/sx.md; el tooltip y los juegos de teclas de la app lo tenían al revés (corregido el 2026-10-04). veterano.js lineasAdnOjos (Cond / *.robage 0 = / Start / pares dir-width con ' / Stop); jugador.svelte.js CLAVE_LS (teclas en localStorage) -->
<!-- lib/inspector/ControlJugador.svelte, jugador.svelte.js, veterano.js PRESETS_PB; DisenadorOjos.svelte, ACCESIBILIDAD (cost:54, opt:13), SETAIM; i18n inspector.pb.*, inspector.ojos.*, inspector.noReproducible -->

La última pestaña tiene dos herramientas para intervenir: el Player Bot y el
diseñador de ojos. Ninguna se puede usar durante un partido F1, y lo que hacen
sobre la memoria del bot no queda en la corrida.

### Player Bot {#player-bot}

Te deja manejar el bot. Con **Controlar este bot**, el bot apunta siempre al
puntero del mouse sobre el mundo (la app escribe en [[.setaim]]) y cada tecla
escribe un valor en una dirección de su memoria mientras la tenés apretada.

1. Elegí el bot y abrí la pestaña **Control**.
2. En **Teclas**, elegí un juego: **Flechas y espacio**, **WASD y espacio**,
   **Ninguna** o tus **Personalizadas**.
3. Hacé clic en **Controlar este bot**. Sobre el mundo aparece **Player Bot activo**.
4. Mové el mouse sobre el campo y usá las teclas. `Esc` sale.

Los juegos de fábrica escriben esto:

| Flechas | WASD | Dirección | Valor |
|---|---|---|---|
| ↑ | W | 1 ([[.up]]) | 40 |
| ↓ | S | 2 ([[.dn]]) | 40 |
| → | D | 4 ([[.dx]]) | 40 |
| ← | A | 3 ([[.sx]]) | 40 |
| espacio | espacio | 7 ([[.shoot]]) | −1 |

Con el bot mirando al puntero, ↑ lo lleva hacia el puntero y espacio dispara
hacia él (−1 es el disparo que le saca energía al otro, ver [[.shoot]]). Los
laterales son relativos al bot: [[.dx]] lo empuja hacia _su_ derecha y [[.sx]]
hacia su izquierda, así que → lo corre a la derecha de hacia donde mira.

La tabla de teclas se edita: hacé clic en la tecla de una fila y apretá otra para
cambiarla; **Memoria** acepta una dirección (1 a 999) o el nombre de una sysvar
como `.up`; **Valor**, un entero entre −32000 y 32000; **Invertida** escribe el
valor mientras la tecla está _suelta_. **Agregar tecla** suma una fila y la
**×** de cada fila la quita. **Guardar preset** baja tu tabla a un archivo
`.pbkp` y **Cargar preset…** la lee. La app recuerda tus teclas en este
navegador.

Los hijos que nazcan mientras controlás al bot quedan resaltados y también
responden; si el bot muere, el control pasa a uno de ellos. Un clic en otro bot
le pasa el control. Al salir se quitan los resaltados.

### Diseñador de ojos {#ojos}

Muestra la **Dirección** y el **Ancho** de los nueve ojos ([[.eye1dir]] …
[[.eye9dir]], [[.eye1width]] … [[.eye9width]]). Cada cambio se escribe en la
memoria del bot al instante, y el abanico de arriba muestra el efecto. Sirve
para probar a ojo una configuración de visión antes de escribirla en el ADN.
**Releer** vuelve a leer los valores del bot. Qué significan direcciones y
anchos está en [[simulacion/vision]].

Cuando te guste, **Escribir en el ADN** arma un gen que fija esos ojos al nacer,
para agregar al final del ADN. Empieza así (con tus valores) y sigue igual,
ojo por ojo, hasta el 9; acá se ve recortado después del ojo 2:

```adn
Cond
*.robage 0 =
Start
-70 .eye1dir store
100 .eye1width store
'
-50 .eye2dir store
100 .eye2width store
'
Stop
```

Como la condición es [[.robage]] igual a 0, el gen corre una sola vez, en el
primer ciclo del bot, y los valores quedan en su memoria. **Copiar** lo pasa
al portapapeles y **Descargar eyes.txt** lo baja. Si el bot es uno tuyo,
**Abrir el ADN de…** copia el gen y abre su ADN en el [[app/editor|editor de ADN]] para que
lo pegues.

**Facilidades** trae tres atajos para probar con calma:

- **Desactivar costos** pone en 0 el [[param:cost:54]].
- **Apagar el movimiento browniano** pone en 0 el [[param:opt:13]].
- **Reiniciar la puntería** escribe 0 en [[.setaim]] de este bot.

Los dos primeros son cambios de parámetros en caliente: valen para toda la
simulación y quedan registrados en la corrida. El tercero toca solo la memoria
del bot y no queda.
