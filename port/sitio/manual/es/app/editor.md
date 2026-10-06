---
titulo: El editor de ADN
resumen: "La pestaña ADN de la ficha de un bot: el texto con colores y autocompletado, los avisos de lo que el motor lee distinto, la vista por genes, las versiones, Probar y el Laboratorio de genes."
etiquetas: [editor, adn, avisos, versiones, probar, laboratorio]
estado: revisada
---
El editor de ADN es la pestaña **ADN** de la ficha de cada bot (ver
[[app/bots]]). Ahí escribís el programa del bot, ves lo que el motor va a
leer distinto de lo que parece, guardás versiones y probás cada cambio contra
el anterior sin salir de la página.

Esta página explica la herramienta. Cómo se escribe un ADN está en el
capítulo del lenguaje, empezando por [[adn/estructura]].

## Bots propios y bots del foro {#solo-lectura}
<!-- Editor.svelte (lectura = soloLectura || !esPropio; duplicar en línea: editor.duplicar.*) -->

Solo se editan tus bots. Los del foro (el Bestiario) se abren en modo
lectura, con el aviso «Los bots del foro son de solo lectura: para cambiarlo,
duplicalo como bot propio». Igual podés leerlos, recorrerlos por genes,
probarlos y mirar el Laboratorio.

Para modificar uno:

1. Hacé clic en **Duplicar para editar**, arriba a la derecha.
2. Escribí el **Nombre del bot nuevo**, o dejalo vacío: se llama igual con
   « 2» al final.
3. Hacé clic en **Duplicar**. Se abre la copia, ya editable.

## La barra de arriba {#barra}
<!-- Editor.svelte barra: seg Texto/Por genes; chip v{n}; editor.sinGuardar; editor.avisos; editor.laboratorio; nota + Guardar v{n} -->

De izquierda a derecha:

| Control | Qué es |
|---|---|
| **Texto** / **Por genes** | Los dos modos de ver el ADN ([[app/editor#texto|texto]] o [[app/editor#genes|gen por gen]]). |
| `v3` | La última versión guardada. |
| **sin guardar** | Aparece cuando el texto cambió desde esa versión. |
| **4 avisos** | Cuántos avisos hay abajo del texto. |
| **Laboratorio** | Cambia el panel de la derecha por el de [[app/editor#laboratorio|genes del Bestiario]]. |
| **Nota de la versión** y **Guardar v4** | Guardan el texto como versión nueva (ver [[app/editor#versiones|Versiones]]). |

A la derecha del texto están los paneles **Probar** y, en tus bots,
**Versiones**. Con el
**Laboratorio** encendido, ese lugar lo ocupa el panel de genes.

## El modo texto {#texto}
<!-- AreaAdn.svelte (textarea + capa de resaltado, números de línea, líneas marcadas); resaltado.js (clases r-flu, r-cmd, r-sys, r-num, r-ref, r-def, r-com, r-off, r-err, r-otra); textarea.js (cambios por botón con deshacer) -->

Es un campo de texto común, con números de línea y colores. Escribir,
seleccionar, copiar, pegar y deshacer funcionan como en cualquier campo del
navegador. Las líneas largas no se cortan: el texto se desplaza a lo ancho.

Los colores distinguen cada clase de palabra:

- las de control de flujo (`cond`, `start`, `else`, `stop`, `end`);
- los demás comandos y operadores ([[op:add]], [[op:store]], `>`…);
- las sysvars y tus variables de `def` (`.up`, `*.eye5`);
- los números, y aparte las lecturas de una dirección escrita con número
  (`*50`);
- las líneas `def`, enteras;
- los comentarios, en cursiva, y tachados los [[app/editor#genes|genes
  apagados]];
- subrayadas con una línea ondulada, las palabras que
  [[app/editor#avisos|un aviso]] marca.

Una palabra que no entra en ninguna clase queda sin color: suele ser un error,
y el aviso correspondiente lo dice.

Los colores siguen las reglas del cargador del motor. Por ejemplo, una línea
que empieza con `def` se pinta como definición aunque diga `defensa`, porque
el motor la lee así (ver [[adn/def]]).

### Deshacer {#deshacer}

**Ctrl+Z** (el deshacer del navegador) deshace lo que escribiste y también
lo que hacen los botones mientras estás en el modo texto: completar una
sysvar, **Corregir** un aviso, agregar un gen del Laboratorio o restaurar una
versión. Cada uno entra en el deshacer como si lo hubieras escrito. Lo que
cambiás en la vista por genes (apagar o encender un gen) no entra.

## Autocompletar sysvars {#autocompletar}
<!-- autocompletar.js (palabraEnCurso: .xx o *.xx fuera de comentarios; sugerencias: exacta, empiezan, contienen; privadas antes; MAX_SUGERENCIAS 12; esExacta); AreaAdn.svelte tecla() -->

Cuando escribís un punto seguido de letras (`.ey`, o `*.ey` para leer), se
abre una lista con hasta 12 nombres que coinciden. Cada uno muestra su
dirección; tus variables de `def` aparecen primero y dicen **privada**.

La lista ordena primero el nombre exacto, después los que empiezan con lo que
escribiste y al final los que lo contienen. Con `.aim` escrito, `.aim` va
antes que `.aimdx`.

| Tecla | Qué hace |
|---|---|
| **↓** / **↑** | Recorren la lista. |
| **Tab** | Acepta el nombre elegido. |
| **Enter** | También acepta, salvo que lo escrito ya sea un nombre completo: entonces cierra la lista y hace el salto de línea. Así, `.up` y Enter queda `.up`. |
| **Escape** | Cierra la lista. |

Un clic en un nombre de la lista también lo acepta. Dentro de un comentario
la lista no aparece.

El autocompletado es solo para nombres con punto. Los operadores y los
comandos se escriben enteros: si alguno queda mal escrito, lo marca un
aviso.

## El resumen al pasar el cursor {#resumen}
<!-- AreaAdn.svelte (tarjeta al mover el mouse: hover.js palabraBajo y entradaDe, métrica de la fuente mono, tabulador cada 4 columnas; lib/manual.js vocabularioManual baja manual/vocabulario.json una vez por idioma; los comentarios no dan tarjeta, como el autocompletado) -->

Sin escribir nada, pasá el cursor por una sysvar o un operador del texto:
aparece una tarjeta con su resumen del manual y el enlace **Ver en el
manual**, que abre su página en otra pestaña. Sirve para leer qué hace
`.shootval` sin irte del editor. Los comentarios no dan tarjeta, y si el
manual del sitio no está disponible, no aparece (el editor sigue igual).

## Los avisos {#avisos}
<!-- Editor.svelte (lista .avisos: dónde, qué, veces, Corregir); lint.js describirLint; wasm/dbcore_api.cpp db_dna_lint (lint_detail::Lint); linter.js (worker, debounce 350 ms) -->

El motor no rechaza casi nada: una palabra que no entiende vale 0, en
silencio, y el bot carga igual (ver [[adn/errores]]). Por eso el editor
revisa el texto mientras escribís, con las mismas reglas y las mismas tablas
de palabras que usa el motor al cargar un bot, y te muestra abajo del texto
cada palabra que el motor va a leer distinto de lo que parece.

Cada aviso tiene tres partes:

- **Dónde**: «Línea 12 · gen 3», o «Todo el ADN» si es del archivo entero.
  Un clic te lleva a esa línea. Los números de línea con avisos también
  quedan marcados.
- **Qué pasa**, con la palabra y, si se repite, cuántas veces («(3 veces)»).
- **Corregir**, cuando hay un arreglo seguro: cambia esa palabra por la
  sugerida en todo el ADN, fuera de los comentarios.

La revisión espera a que dejes de escribir un momento. Si el motor no pudo
cargar, el editor lo dice («El control del ADN no está disponible») y no hay
avisos.

Estos son todos los avisos, con un ejemplo de cada uno:

| Ejemplo | Aviso | Qué significa |
|---|---|---|
| `.upp` | «.upp no es un sysvar: el motor lo lee como 0. ¿Quisiste decir .up?» | Un nombre con punto que no existe, parecido a una sysvar. **Corregir** pone el nombre sugerido. |
| `.zzqq` | «.zzqq no es un sysvar ni tiene def: el motor lo lee como 0.» | Un nombre con punto que no se parece a nada. |
| `.50` | «.50 no es un sysvar […]. ¿Quisiste decir la dirección 50? Las direcciones van sin punto.» | Un número con punto. **Corregir** saca el punto (`*.50` pasa a `*50`). |
| `.otra`, con su `def` más abajo | «.otra se define más abajo: el motor lee el ADN en orden y acá vale 0. Subí el def.» | El motor resuelve los nombres mientras lee: un `def` posterior no sirve. Ver [[adn/def#resolucion]]. |
| `.Paso`, con `def paso` | «.Paso no coincide con su def: las variables privadas distinguen mayúsculas y acá vale 0.» | Las sysvars no distinguen mayúsculas; tus variables sí. |
| `up` | «up vale 0: ¿falta el punto? .up» | El nombre de una sysvar sin punto. **Corregir** se lo agrega. |
| `swapp` | «swapp no es un comando ni un número: vale 0. ¿Quisiste decir swap?» | Una palabra a una letra de un comando (solo para palabras de 4 letras o más). |
| `hola` | «hola no es un comando ni un número: vale 0 (¿texto sin la marca de comentario ')?» | Cualquier otra palabra suelta. Muchas veces es un comentario sin su `'`. |
| `store` con un carácter invisible en el medio | «… tiene un carácter invisible: no se reconoce como store y vale 0.» | Pasa al copiar de páginas web o procesadores de texto. **Corregir** lo limpia. |
| `ññ` | «… tiene caracteres invisibles o de otra codificación: vale 0.» | Letras fuera del inglés básico, o una codificación rota. |
| `50store` | «50store se lee como 50: «store» se pierde (¿falta un espacio?).» | Un número con algo pegado. El motor toma el número y descarta el resto. **Corregir** inserta el espacio. |
| `def nrg 5` | «La variable privada nrg tapa al sysvar .nrg en todo el bot.» | Una variable con el nombre de una sysvar le gana en todo el ADN. Ver [[adn/def#sombra]]. |
| `defensa 50` | «Toda línea que empieza con «def» es una definición: defensa define la variable nsa. […]» | El motor lee como `def` cualquier línea que empiece con esas letras. Si era texto, falta la `'`. |
| `def x .up` | «El valor de un def tiene que ser un número: en def x, «.up» vale 0.» | El valor de un `def` se escribe con cifras. Ver [[adn/def#numeros]]. |
| ADN con `def` que empieza con `10` | «Con def, la primera palabra (10) no es de control de flujo y se pierde.» | Una rareza heredada del original. Ver [[adn/estructura#cero-inicial]]. |
| `40000`, o `def pasos` sin valor | «El motor rechaza este ADN (error 6: un número fuera de ±32767 o un def mal formado).» | El único caso en que el bot no carga. Ver [[adn/estructura#rechazos]]. |

Este ADN junta varios de esos errores:

```adn sin-lint
def paso 30
cond
*.nrgg 100 >
start
.paso .up store
30 .upp store
30 up store
10 50store
stop
end
```

El editor marca `*.nrgg` (sugiere `*.nrg`), `.upp` (sugiere `.up`), `up`
(falta el punto) y `50store` (falta un espacio). Corregido:

```adn
def paso 30
cond
*.nrg 100 >
start
.paso .up store
30 .up store
30 .up store
10 50 store
stop
end
```

:::nota
Los avisos cuentan lo que el motor _lee_, no si el bot hace lo que querés.
Un ADN sin avisos puede tener la pila vacía, un `store` que nunca se ejecuta
o una condición al revés. Para eso están [[adn/errores]] y
[[app/editor#probar|Probar]].
:::

Debajo de los avisos del motor aparecen los del Laboratorio, que se explican
en [[app/editor#laboratorio|su sección]].

## La vista por genes {#genes}
<!-- VistaGenes.svelte (Gen, Nombre, Origen, Activo; plegar/desplegar; avisos por gen); engine/lab.js (bloquesAdn, nombreArriba, apagarGen/encenderGen, PREFIJO_APAGADO = "'#off ") -->

**Por genes** muestra el ADN como una tabla, un renglón por gen:

| Columna | Qué muestra |
|---|---|
| **Gen** | El número del gen, contado como lo cuenta el motor (ver [[adn/genes]]). |
| **Nombre** | La línea de comentario que está justo arriba del gen, si hay una. Si no, «(sin nombre)». |
| **Origen** | De dónde salió el gen, si vino del Laboratorio: «← Nombre del bot, gen 4». |
| **Activo** | **sí** o **no**. Un clic lo cambia. |

Cada gen se despliega para ver su código, y un botón arriba pliega o
despliega todos. Los genes con avisos llevan una marca con la cantidad.

**Apagar un gen** lo convierte en comentario: cada una de sus líneas empieza
con `'#off `. El motor no lo ejecuta, pero queda en el texto y se vuelve a
encender con un clic. Sirve para probar qué pasa sin un gen sin tener que
borrarlo:

```adn
' Avanza
cond
start
10 .up store
stop
' Gira
'#off cond
'#off *.eye5 0 =
'#off start
'#off 30 .aimdx store
'#off stop
end
```

Acá el gen «Gira» está apagado: el bot solo avanza.

:::nota
Un gen apagado es solo un comentario: no cuenta como gen, no ocupa número y
no paga costo de ADN. Si lo encendés, los números de los genes que le siguen
cambian, y eso importa si algún gen usa [[.delgene]] o [[.mkvirus]] con un
número fijo.
:::

## Guardar versiones {#versiones}
<!-- Editor.svelte guardar (texto exacto; editor.guardar.*); borrador.js (por bot, localStorage, base); beforeunload; PanelVersiones.svelte (Restaurar, Comparar); DiffGenes.svelte (editor.diff.*); engine/bots.js guardarVersion/restaurarVersion -->

Tus bots guardan su historia completa. Para guardar:

1. Si querés, escribí una **Nota de la versión** («gira más rápido»,
   «sin el gen de disparo»).
2. Hacé clic en **Guardar v4** (el número es el de la versión que se va a crear).

La versión guarda el texto exacto: un cambio en un comentario o en la
sangría también es un cambio. Si no tocaste nada, la app no crea otra
versión y te lo dice.

### Lo que no guardaste no se pierde {#borrador}

Mientras escribís, el editor guarda un borrador del bot en este navegador.
Si cambiás de pestaña, elegís otro bot o recargás la página, al volver
encontrás tus cambios con el aviso «Tenés cambios sin guardar de la última
vez: se recuperaron», y un botón **Descartar los cambios** por si no los
querés.

Si mientras tanto el bot cambió por otro lado (por ejemplo, restauraste una
versión desde la ficha), el editor no mezcla nada: te ofrece **Recuperar los
cambios** o **Descartar los cambios**. Y si intentás cerrar la página con
cambios sin guardar, el navegador te pide confirmación.

### El panel Versiones {#panel-versiones}

El panel de la derecha lista las versiones, de la más nueva a la más vieja,
con su nota y su fecha:

- **Restaurar** trae una versión anterior _guardándola como versión nueva_:
  la historia nunca se pierde. Si tenés cambios sin guardar, primero te
  pregunta (con **Restaurar igual** seguís); en el modo texto, esos cambios
  se recuperan con Ctrl+Z.
- **Comparar** muestra en qué difieren dos versiones: la de partida y la de
  llegada, que elegís en los dos desplegables. La comparación va gen por
  gen: cuenta los genes iguales, cambiados, agregados y quitados, y muestra los cambiados
  lado a lado.

## Probar {#probar}
<!-- PanelProbar.svelte; lib/trabajos/prueba.js (POR_DEFECTO copias 10, ciclos 5000, semillas 3, modo algas, base f1, semilla 1; LIMITES; 15 algas «Alga minimalis 3.0»; métricas); engine/opciones.js BASES (clasica: sin costos, 32000²; f1: costos, física, 9237×6928 toroidal) -->

**Probar** corre tu bot sin dibujarlo, a toda velocidad, y te dice cómo le
fue. Si tiene una versión anterior, la corre también con las mismas semillas,
para que la comparación sea justa.

| Campo | Qué es | Por defecto |
|---|---|---|
| **Copias** | Cuántos bots iguales se siembran (de 1 a 50). | 10 |
| **Ciclos** | Cuánto dura cada corrida (de 10 a 200.000). | 5000 |
| **Semillas** | Cuántas corridas, cada una con otro azar (de 1 a 16). | 3 |
| **Reglas** | **F1**: los ajustes de la liga F1, con costos. **Sin costos**: los valores con que arranca la interfaz clásica. | F1 |
| **Semilla** | La primera semilla; las demás salen de ella. Con la misma, la prueba da lo mismo. | 1 |
| **Escenario** | **Con algas**: 15 algas para comer. **Solo (sin algas)**: tus copias solas. | Con algas |

El botón dice qué se prueba y contra qué:

- Sin cambios sin guardar: **Probar v4** contra la v3. Si el bot tiene una
  sola versión, **Probar v1** corre sin comparación.
- Con cambios sin guardar: **Probar cambios** contra la última versión
  guardada.
- En un bot del foro: **Probar este ADN**, sin comparación.

La prueba corre en segundo plano: podés seguir editando, cambiar de bot o
cerrar el editor, y sigue avanzando. Mientras corre se ve el porcentaje y un
botón **Cancelar**. Al terminar, el panel muestra una tabla con las dos
versiones lado a lado, promediadas sobre las semillas:

| Fila | Qué mide |
|---|---|
| **Sobreviven** | Cuántas de las copias del principio siguen vivas al final. |
| **Hijos por copia** | Hijos directos de cada copia fundadora, en promedio (sin nietos). |
| **Nacidos por copia (con nietos)** | Todos los nacidos de la especie, divididos por las copias. |
| **Vivos al final** | El tamaño de la población al terminar. |
| **Energía media** | La energía por bot vivo al terminar. |
| **Extinciones** | En cuántas semillas la especie desapareció. |

Cada prueba queda anotada en el [[app/bots#historial|historial]] del bot.

:::cuidado
Con las reglas **F1** el ADN cuesta energía (ver [[adn/ejecucion#costos]]):
un bot que anda bien sin costos puede morir de hambre en F1. Si tu bot no
sobrevive, probalo también **Sin costos** para saber si el problema es lo
que hace o lo que gasta.
:::

## El Laboratorio {#laboratorio}
<!-- PanelGenes.svelte (editor.lab.*: por capacidad / de un bot, solo autónomos, Ver el código, +); engine/lab.js avisosLab (dep → agregar-gen; col → remapear 971-990; gl → renumerar / agregar-gen; info sin-repro / sin-energia solo si todo el ADN viene del Bestiario); PLAN.md decisión 19 -->

El **Laboratorio** sirve para armar un bot con genes de otros. Al
encenderlo, el panel de la derecha pasa a **Genes del Bestiario**, con los
genes de todos los bots del foro.

Hay dos formas de buscar:

- **por capacidad**: elegís una (veneno, fotosíntesis, reproducción sexual…)
  y aparecen los genes que la tienen, de cualquier bot. **Filtrar por bot…**
  acota por nombre.
- **de un bot**: escribís el nombre del bot y aparecen todos sus genes.

**solo autónomos** deja solo los genes que no usan memoria propia: se pueden
trasplantar sin arrastrar dependencias ni pisar direcciones de otros.

Cada gen de la lista dice de qué bot es, cuántas palabras tiene, si usa
memoria propia y qué capacidades aporta. Un clic en el gen muestra su código
debajo de la lista; el botón **+** lo agrega al final de tu ADN. El gen recuerda de
dónde vino: lo ves en la columna **Origen** de la [[app/editor#genes|vista por
genes]] y queda guardado con cada versión.

### Los avisos del Laboratorio {#avisos-laboratorio}

Juntar genes de bots distintos tiene trampas, y el Laboratorio las avisa
debajo del texto, con un arreglo de un clic cuando lo hay:

| Aviso | Qué pasa | Arreglo |
|---|---|---|
| «El gen 3 (de X) lee la dirección 52, que en su bot escribe el gen 1.» | El gen depende de un dato que en su bot original preparaba otro gen. | **+ gen 1**: agrega el gen que falta. |
| «La dirección 60 la usan X, Y para cosas distintas […].» | Dos genes de bots distintos usan la misma celda de memoria para cosas diferentes. | **Remapear direcciones**: pasa las de los genes siguientes a direcciones libres, empezando por 971-990. |
| «El gen 2 (de X) usa números de gen literales en .delgene/.mkvirus que ya no apuntan a los genes de su bot.» | Al cambiar de lugar, los números de gen escritos a mano apuntan a otro gen (ver [[.delgene]] y [[.mkvirus]]). | **Renumerar**, o agregar los genes que faltan. |
| «Ningún gen reproduce: el bot no va a dejar hijos.» | Informativo. | — |
| «Ningún gen consigue energía (ni caza ni fotosíntesis).» | Informativo. | — |

Los dos últimos solo aparecen cuando todo el ADN viene del Bestiario: de los
genes que escribiste vos, el Laboratorio no sabe qué capacidades tienen.

En un bot del foro el Laboratorio se puede recorrer, pero **+** está
apagado y los arreglos no aparecen: primero hay que [[app/editor#solo-lectura|duplicarlo]].
