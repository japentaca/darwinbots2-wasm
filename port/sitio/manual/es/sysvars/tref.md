---
titulo: Lo que se siente por un lazo (tref*)
resumen: "Las sysvars que cuentan cómo está el bot atado del otro lado de un lazo: energía, cuerpo, edad, posición, velocidad, firma y una celda de su memoria."
etiquetas: [lazos, tref, sentidos, multibot]
estado: revisada
---
Un lazo no solo une dos bots: también es un canal por el que cada uno _siente_ al
otro. Las sysvars `tref*` son a los lazos lo que las [[sysvars/ref|ref*]] son a la
vista: en vez de describir lo que ve el ojo, describen al bot que está del otro lado
de un lazo, se lo vea o no.

## Qué lazo se lee {#que-lazo}
<!-- 34-TIES §1 (el creador carga los trefvars al crear la tie), §2 (readtie P1, gate newage >= 2, puerto o tiepres; si no existe, EraseTRefVars); 10-CICLO §2 (ADN en el paso 10, UpdateBots después); core ties.hpp readtie -->

Un bot puede tener varios lazos, pero las `tref*` describen uno solo por vez: el
que tenga el puerto que pusiste en [[.readtie]], o, si `.readtie` vale 0, el de
[[.tiepres]] (el último lazo creado). Si no hay ningún lazo con ese puerto, o el
bot se quedó sin lazos, todas se ponen en 0. Los puertos se explican en
[[simulacion/lazos]].

El motor las carga después de que corre el ADN, así que tu ADN lee siempre la foto
que se tomó en el ciclo anterior. Dos detalles de tiempo, comprobados corriendo:

- Un hijo recién nacido no siente a su padre hasta su cuarto ciclo de vida (cuando
  su [[.robage]] vale 3). El que crea el lazo, en cambio, lo siente desde el ciclo
  siguiente.
- Cuando el lazo se corta, las `tref*` todavía conservan el último valor durante un
  ciclo. Si tu gen depende de ellas, sumale `*.numties 0 >` ([[.numties]]).

## Qué se puede saber {#que-se-sabe}
<!-- sysvars.yaml 437-449, 456-465, 475, 478, 479; core ties.hpp ReadTRefVars (también copia tout1-10 del atado en tin1-10) -->

| Qué | Sysvars |
|---|---|
| Estado | [[.trefnrg]], [[.trefbody]], [[.trefage]], [[.trefshell]], [[.treffixed]] |
| Dónde está y adónde apunta | [[.trefxpos]], [[.trefypos]], [[.trefaim]] |
| Cómo se mueve, visto desde vos | [[.trefvelmyup]], [[.trefvelmydn]], [[.trefvelmysx]], [[.trefvelmydx]] |
| Cómo se mueve, según él | [[.trefvelyourup]], [[.trefvelyourdn]], [[.trefvelyoursx]], [[.trefvelyourdx]], [[.trefvelscalar]] |
| Su firma (qué hace su ADN) | [[.trefup]], [[.trefdn]], [[.trefsx]], [[.trefdx]], [[.trefaimdx]], [[.trefaimsx]], [[.trefshoot]], [[.trefeye]] |

Además, por el mismo lazo llegan los canales [[.tin1]]…`.tin10` y una celda
cualquiera de la memoria del otro con [[.tmemloc]] y [[.tmemval]].

La más usada en el Bestiario es, lejos, [[.trefeye]] (comparada con [[.myeye]] para
saber si el otro es de tu especie); le siguen [[.trefnrg]], [[.trefxpos]] y
[[.trefage]] (esta última, para saber quién es el padre y quién el hijo). Este bot
se reproduce y el hijo, en cuanto siente que el atado es mayor que él, corta el
lazo con [[.deltie]]:

```adn
' Se reproduce a los 10 ciclos
cond
*.robage 10 =
start
50 .repro store
stop

' Si el atado es mayor que yo (mi padre), corto el lazo
cond
*.numties 0 >
*.trefage *.robage >
start
*.tiepres .deltie store
stop
```

El padre no lo corta nunca: para él, el atado es más joven. El hijo lo corta en su
cuarto ciclo, el primero en que siente a su padre.
