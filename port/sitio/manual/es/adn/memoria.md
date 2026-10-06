---
titulo: Memoria libre y epigenética
resumen: "El mapa de las 1000 celdas de memoria de un bot: cuáles usa el motor, cuáles son tuyas, qué se borra solo y qué pasa a los hijos."
etiquetas: [memoria, variables, epigenética, herencia, mem]
estado: revisada
---
Cada bot tiene una memoria de 1000 celdas, numeradas del 1 al 1000. Cada celda guarda un entero; lo que escribe el ADN queda siempre entre −32000 y 32000 (ver [[adn/stores]]). Algunas celdas tienen nombre y las usa el motor para hablar con el bot (son las _sysvars_); el resto son tuyas. Esta página es el mapa.

## El mapa de 1 a 1000 {#mapa}
<!-- 21-MEMORIA §1-§2; sysvars.yaml (huecos_sin_nombre: 304-309 libres) -->

Las celdas con nombre están agrupadas por tema. La lista completa, con lo que hace cada una, está en [[sysvars/todas]].

| Celdas | Qué hay | Grupo |
|---|---|---|
| 1–12, 18–19 | Órdenes de movimiento y disparo, edad, masa, [[.timer]] | [[sysvars/movimiento]], [[sysvars/cuerpo]] |
| 194–221 | Lo que pasó en el ciclo: velocidad, choques, sabores, borde, posición, día (la 221 no la escribe nadie: ver más abajo) | [[sysvars/contacto]], [[sysvars/posicion]] |
| 300–303, 310–315 | Reproducción, energía, cuerpo | [[sysvars/reproduccion]], [[sysvars/cuerpo]] |
| 330–331, 335–341 | Lazos, ADN y virus | [[sysvars/adn-y-virus]] |
| 400–402 | Sol y conteo de bots | [[sysvars/posicion]] |
| 410–429, 800–819 | Canales de comunicación | [[sysvars/entradas-salidas]] |
| 437–487 | Lazos y lo que se siente por ellos | [[sysvars/lazos]], [[sysvars/tref]] |
| 501–539 | Ojos y su configuración | [[sysvars/ojos]] |
| 685–715 | Lo que ve el ojo central | [[sysvars/ref]] |
| 721–731 | La firma propia | [[sysvars/my]] |
| 820–839 | Defensas y desechos | [[sysvars/defensas]] |
| 900–901, 920–924 | Disparo hacia atrás, cloroplastos | [[sysvars/disparos]], [[sysvars/cloroplastos]] |
| 971–990 | Memoria genética, sin nombre | [[sysvars/mem-971-975]], [[sysvars/mem-976-990]] |

## La memoria libre {#memoria-libre}
<!-- sysvars.yaml huecos_sin_nombre; 21-MEMORIA §0.2, §2, §9.6 (hitang sin escritor) -->

Más de 700 celdas no tienen nombre ni las toca el motor. Son estas:

> 13–17, 20–193, 222–299, 304–309, 316–329, 332–334, 342–399, 403–409, 430–436, 472, 500, 512–520, 530, 540–684, 691–694, 700, 716–720, 732–799, 840–899, 902–919, 925–970, 991–1000

La zona 20–193 es la clásica para variables propias: la mayoría de los bots del Bestiario ponen sus [[adn/def|def]] en 50, 51, 52… Lo que guardás en una celda libre se queda ahí toda la vida del bot, hasta que lo cambies. También se guarda con la simulación.

La celda 221 tiene nombre ([[.hitang]]) pero en el DarwinBots 2.48.32 nada la escribe nunca: en la práctica es una celda libre más.

### Las celdas con nombre no sirven para guardar
<!-- 21-MEMORIA §3 régimen B (nrg se publica cada ciclo) -->

Si escribís en una celda que el motor usa, el motor la pisa. Fijate en este bot:

```adn
' La celda de .nrg no sirve para guardar nada
def antes 60
def libre 61

cond
start
*.nrg .antes store
1 .nrg store
1 .libre store
stop
```

Al correrlo, [[.nrg]] vuelve a valer la energía real (3000) en cada ciclo (menos en el primero, en que un bot recién sembrado todavía la lee en 0), y eso es lo que la celda 60 copia al ciclo siguiente: el `1` se perdió. En cambio, la celda 61 conserva su `1`. Escribir en `.nrg` tampoco cambia la energía del bot: es solo un número que el motor publica.

### Quién más puede escribir tu memoria libre
<!-- 21-MEMORIA §2 (altzheimer, shots de memoria), §4 (tieportcom, venom/poison) -->

«Libre» quiere decir que el motor no la usa, no que esté a salvo. Hay cuatro vías que pueden cambiarla desde afuera:

- **Disparos de memoria.** Otro bot puede dispararte un valor que se escribe en una dirección cualquiera de tu memoria (ver [[simulacion/disparos]]).
- **Lazos.** Un bot atado a vos puede escribir cualquier celda tuya con [[.tieloc]] y [[.tieval]] (ver [[simulacion/lazos]]).
- **Veneno y toxina.** Mientras dura el efecto, escriben cada ciclo en la celda que eligió el atacante con [[.vloc]] o [[.ploc]] (ver [[simulacion/defensas]]).
- **Exceso de desechos.** Cuando el [[.waste]] acumulado pasa un umbral, el motor escribe valores al azar en celdas al azar de toda la memoria (ver [[simulacion/energia]]).

## Qué borra el motor y cuándo {#que-borra}
<!-- 21-MEMORIA §3 (regímenes A, B, C y excepciones); 10-CICLO §2 -->

El ADN corre en el medio del ciclo; casi todo lo demás (física, visión, disparos) pasa después (ver [[simulacion/ciclo]]). De ahí salen cuatro comportamientos:

| Tipo de celda | Ejemplos | Qué pasa |
|---|---|---|
| Sentidos | [[.eye5]], [[.edge]], [[.refxpos]] | El motor los escribe después del ADN; tu ADN los lee en el ciclo siguiente y se borran justo después. Siempre llegan con un ciclo de atraso. |
| Datos publicados | [[.nrg]], [[.body]], [[.robage]], [[.aim]] | El motor los reescribe en cada ciclo. Lo que guardes ahí se pierde. |
| Órdenes | [[.up]], [[.shoot]], [[.aimdx]] | Las escribís vos; el motor las cumple y las pone en 0 en el mismo ciclo. |
| Configuración | [[.focuseye]], [[.eye5dir]], [[.memloc]], [[.out1]] | El motor las lee pero no las borra: valen hasta que las cambies. |

Hay órdenes que no se borran siempre, y conviene conocerlas:

- [[.repro]] (y [[.mrepro]], [[.sexrepro]]) solo se pone en 0 si el hijo nace. Si la reproducción no se puede hacer, el valor queda y se reintenta en cada ciclo.
- [[.strbody]] y [[.fdbody]] negativos se borran sin efecto (en el DarwinBots original quedaban ahí para siempre).
- [[.shootval]] solo se borra cuando efectivamente disparás.
- [[.fixang]], [[.fixlen]] y [[.stifftie]] solo se borran si tenés un lazo elegido con [[.tienum]]; si no, quedan.

## Al nacer {#al-nacer}
<!-- 21-MEMORIA §2, §5; sysvars.yaml meta.al_nacer (Erase de mem, timer y 971-975 del padre) -->

Un hijo nace con la memoria entera en 0. Después el motor completa lo suyo (la energía, el largo del ADN, la cantidad de genes y algunas más) y le pasa dos cosas del padre: el [[.timer]], que sigue contando desde el valor del padre, y la memoria genética. Tus variables de la memoria libre **no se heredan**: el hijo arranca con ellas en 0.

## La memoria genética (971–990) {#memoria-genetica}
<!-- 21-MEMORIA §5 (971-975 instantáneas; 976-990 por epimem, una por ciclo con age < 15, con tie de nacimiento y celda en 0; el padre pierde su epimem; epireset; UseEpiGene); core sim.hpp (epireset y UseEpiGene en false) -->

Las celdas 971 a 990 no tienen nombre, pero el motor las trata distinto: son el único puente de memoria entre un bot y sus hijos. Hay dos zonas.

**971–975, instantánea.** Al nacer, el hijo recibe una copia de esas cinco celdas del padre. Ya están ahí en su primer ciclo de vida. Ver [[sysvars/mem-971-975]].

**976–990, diferida.** Al nacer, las quince celdas del padre se guardan aparte, en una reserva del hijo, y le llegan de a una por ciclo y en orden: primero la 976, después la 977, y así hasta la 990, unos quince ciclos después de nacer. Cada entrega tiene dos condiciones:

- el hijo tiene que seguir atado a su padre por el lazo de nacimiento; si lo corta, o si lo reemplaza atándose de nuevo al padre con [[.tie]] (lo habitual en los multicelulares), las entregas que faltan se pierden;
- la celda del hijo tiene que seguir en 0; si el hijo ya escribió algo ahí, la entrega no la pisa.

Ver [[sysvars/mem-976-990]].

Este bot cuenta generaciones en la celda 971:

```adn
' Cuenta generaciones en la memoria genetica
def generacion 971
def listo 50

' Una sola vez en la vida: suma 1 a lo que heredo
cond
*.listo 0 =
start
.generacion inc
1 .listo store
stop

' Se reproduce a los 10 ciclos de vida
cond
*.robage 10 =
start
50 .repro store
stop
```

El fundador pone 971 en 1. Su hijo nace con 971 = 1 (copia instantánea) y en su primer ciclo lo sube a 2. La marca de la celda 50 evita que lo sume más de una vez, y funciona justamente porque la 50 **no** se hereda: el hijo la recibe en 0.

Algunos detalles más:

- En la reproducción sexual la memoria genética viene de la madre (ver [[simulacion/reproduccion]]).
- Si un bot que todavía estaba recibiendo su propia herencia diferida tiene un hijo, las entregas que le faltaban se pierden.
- El motor tiene además un _reinicio epigenético_, ligado a las [[simulacion/mutaciones]], que hace nacer al hijo sin memoria genética cuando el linaje acumuló suficientes mutaciones. Viene apagado y la app no permite activarlo.
- El DarwinBots original podía, con una opción, guardar los valores de 971–990 en el `.txt` de un bot, como un gen extra al principio del ADN que restaura las celdas en el primer ciclo y se borra a sí mismo con [[.delgene]]. La app no agrega ese gen al exportar (ver [[adn/formato#exportar]]).

## La dirección 0 {#la-direccion-0}
<!-- 20-VM §0.6, §7; 21-MEMORIA §6; sysvars.yaml mem_cero -->

El ADN no puede llegar a una celda 0: toda dirección se ajusta al rango 1..1000,
y al leer, el 0 cae en la 1000 (`*0` y `0 *` leen la celda 1000). Un store a la
dirección 0 no hace nada. Las reglas, con ejemplos, están en
[[adn/numeros#fuera]] y [[adn/numeros#cero]].

Por dentro existe una celda 0, pero la usa solo el motor, como basurero: si un ataque de veneno o toxina apunta a la 340 ([[.delgene]], la que borra genes), el golpe se desvía a la celda 0 y así no puede borrarle genes a nadie. Nadie la lee. Ver [[sysvars/mem-0]].
