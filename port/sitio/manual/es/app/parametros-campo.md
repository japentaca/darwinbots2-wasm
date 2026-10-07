---
titulo: "Parámetros: Campo y bordes"
resumen: "El tamaño del mundo y lo que pasa en sus bordes: paredes, o lados conectados para que lo que sale por uno entre por el otro."
etiquetas: [campo, bordes, toroidal, tamaño, mundo]
estado: revisada
---
<!-- engine/opciones.js grupo 'campo' (base:fieldW, base:fieldH, opt:1-3), CONTROLES_BASICOS 'tamano' y 'bordes', dimensionesCampo; 50-MUNDO §1; 30-FISICA §5 -->

Este grupo decide cuánto mundo hay y cómo termina. Son cinco parámetros: el
ancho y el alto del campo y tres interruptores para los bordes. En el modo
básico de Experimentar los mismos valores se eligen con dos controles,
**Tamaño del campo** (los quince tamaños clásicos y el de la base Clásica) y **Bordes** (paredes,
toroidal o uno de los dos cilindros); acá se ven sueltos y se pueden poner a
mano.

El tamaño pesa más de lo que parece: un campo grande reparte la misma
población en más superficie, así que los bots se encuentran menos y los
vegetales reciben más luz (ver [[simulacion/cloroplastos#fotosintesis|la fotosíntesis]]). Los
bordes cambian la geografía: con paredes hay rincones donde arrinconarse y un
fondo donde se junta lo que cae; con los lados conectados no hay ni lo uno ni
lo otro. Cómo se comporta un bot contra una pared está en
[[simulacion/fisica#bordes|los bordes del mundo]] y el panorama del mundo, en
[[simulacion/mundo#campo|el campo]].

:::parametro base:fieldW
<!-- 50-MUNDO §1; wasm dbcore_api db_sim_set_field, RecomputeDivisors; core senses.hpp (mem 219 = pos.x / xDivisor); opciones.js vivo: false -->
El ancho del mundo, en las mismas unidades en que se miden las posiciones y
las velocidades. La app arranca con 32000; la base **Liga F1** lo pone en
9237. Es el único parámetro de este grupo que **no se aplica en vivo**: para
cambiarlo hace falta una simulación nueva.

Hasta 32000 de ancho, [[.xpos]] lee la posición tal cual. En un campo más
ancho, el motor la divide en proporción para que quepa entre 0 y 32000: en un
campo de 64000, un bot en el borde derecho lee unos 32000 y no 64000.
:::

:::parametro base:fieldH
<!-- 50-MUNDO §1; core senses.hpp (mem 217 = pos.y / yDivisor); vegs.hpp (profundidad del estanque = pos.y/2000 + 1) -->
El alto del mundo. La coordenada vertical crece hacia abajo, y el bot la lee
como profundidad en [[.depth]]; igual que con el ancho, en un campo de más de
32000 de alto la lectura se divide en proporción. La app arranca con 32000 y la
**Liga F1** usa 6928. También requiere una simulación nueva.

El alto importa más cuando hay gravedad ([[param:opt:20]]), porque el fondo es
el borde de abajo, y en el modo estanque ([[param:opt:30]]), donde la luz baja
un escalón cada 2000 unidades de profundidad (ver
[[simulacion/cloroplastos#fotosintesis|la fotosíntesis]]).
:::

:::parametro opt:1
<!-- opciones.js opt:1 derivado (2 && 3), efectosDe; dbcore_api set_opt case 1 escribe 2 y 3 -->
Es un atajo: vale «sí» cuando los dos pares de bordes están conectados, y
entonces el mundo es un _toro_, sin bordes en ninguna dirección. En la app no
se edita: es **derivado**, y se cambia con los dos parámetros de abajo o con el
control **Bordes** del modo básico (la opción **Toroidal**). La base **Liga F1**
conecta los dos ejes.
:::

:::parametro opt:2
<!-- 30-FISICA §5 (bordercolls: ReSpawn del organismo, clamp + 5 %); core physics GravityForces (flotabilidad solo sin Updnconnected); shots: envoltura o rebote -->
Conecta el borde de arriba con el de abajo: lo que sale por uno aparece por el
otro con la misma velocidad. Vale para los bots, para los multibots enteros
(cruzan de una vez, sin estirar los lazos) y para los disparos. Apagado, los
dos bordes son paredes: el bot queda apoyado contra la pared, frenado, y lee
[[.edge]] en 1.

Ojo si usás gravedad hacia abajo ([[param:opt:20]]): con este eje conectado no
hay fondo y los bots caen para siempre, reapareciendo arriba. En el modo
estanque, además, la flotabilidad ([[.setboy]]) solo funciona con este eje
**sin** conectar (ver [[simulacion/mundo#gravedad|gravedad, estanque y mareas]]). Con el control
**Bordes**, es la opción **Cilindro (arriba↔abajo)**.
:::

:::parametro opt:3
<!-- 30-FISICA §5; mundo.md (viajero.txt en 2000x1000, con y sin opt:3) -->
Conecta el borde izquierdo con el derecho, de la misma manera. Un bot que
avanza siempre hacia la derecha, en un campo con paredes, termina pegado al
borde; con este eje conectado da la vuelta al mundo una y otra vez (el ejemplo
está en [[simulacion/mundo#bordes|los bordes]]). Con el control **Bordes**, es la opción
**Cilindro (izquierda↔derecha)**.

Con el sol al azar ([[param:opt:40]]), la franja iluminada también pasa de un
lado al otro cuando se sale del campo, conectes o no este eje.
:::
