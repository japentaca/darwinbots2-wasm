---
titulo: Cloroplastos y vegetales
resumen: "Cómo gana energía del sol un bot con cloroplastos, cuándo hay sol, por qué un campo lleno rinde menos y cómo se repueblan los vegetales."
etiquetas: [cloroplastos, sol, luz, vegetales, día y noche, repoblación]
estado: revisada
---
El sol es, junto con la siembra de vegetales nuevos, la única fuente de energía del
mundo (ver [[simulacion/energia]]). Lo aprovecha cualquier bot que tenga
cloroplastos ([[.chlr]]): los vegetales nacen con ellos, pero un animal también
puede comprarlos. Esta página cuenta cuánto rinden, cuándo hay sol y cómo la
simulación mantiene vegetales en el campo. Las sysvars del tema están en
[[sysvars/cloroplastos]].

## La fotosíntesis {#fotosintesis}
<!-- 50-MUNDO §2.2 (feedvegs: fase del sol, al final del ciclo); core feedvegs -->

Al final de cada ciclo, en la fase del sol, cada bot vivo con energía y con
cloroplastos recibe su parte si se cumplen dos cosas:

- es de día (ver [[simulacion/cloroplastos#dia-y-noche|Día y noche]]);
- el bot está dentro de la franja iluminada. Sin [[param:opt:40]], la franja es el
  campo entero.

La ganancia de un ciclo se calcula así:

```
ganancia = base × (4 × (1 − ocupación)² × 1,25 × cloroplastos/16000
                   − (cloroplastos/32000)²)
           − edad × cloroplastos / 1000000000
```

- La **base** es [[param:base:maxEnergy]] dividido por 3,5. En modo estanque
  ([[param:opt:30]]) depende de la profundidad: es [[param:opt:31]] dividido por
  la profundidad elevada a [[param:opt:32]] (la profundidad crece en 1 cada 2000
  unidades hacia abajo), y después dividido por 3,5.
- La **ocupación** es la parte del campo tapada por bots, el complemento de
  [[.light]]. Elevada al cuadrado, castiga mucho: con medio campo cubierto, el
  primer término vale la cuarta parte que en un campo vacío.
- El término negativo crece con el cuadrado de los cloroplastos: más cloroplastos
  rinden más, pero cada vez menos.
- La tasa por edad es chica: 1 por ciclo recién con 32000 cloroplastos y 32000
  ciclos de vida. Se cobra también fuera de la franja, si es de día.

La ganancia se reparte entre energía y cuerpo según [[param:opt:63]]: con 0,75, que
es lo que trae la app, un cuarto va a [[.nrg]] y tres cuartos a [[.body]] (a 10
por 1). Con mareas ([[param:opt:64]]), la ganancia además sube y baja con el
período de la marea, entre nada y la ganancia completa.

### Cuánto rinde {#rinde}
<!-- comprobado con base:maxEnergy 10 y opt:63 0,75: un vegetal solo en un campo de 32000×32000; y 30 vegetales en un campo de 4000×3000 -->

Con la energía solar por ciclo en 10, como arranca la app, la ganancia de un
vegetal en energía por ciclo es esta (el cuerpo sube un poco menos de un tercio de
eso):

| Cloroplastos | Solo, en un campo enorme | Entre 30, en un campo de 4000×3000 |
|---|---|---|
| 4000 | +0,9 | +0,6 |
| 8000 | +1,7 | +0,9 |
| 16000 | +3,4 | +0,5 |
| 32000 | +6,4 | −0,7 |

En un campo vacío, más cloroplastos siempre rinden más. En uno lleno, pasado cierto
punto rinden menos, y con 32000 el vegetal pierde. Hay que sumar que los
cloroplastos agrandan al bot: 30 vegetales de 32000 cloroplastos tapan todo el
campo chico, y [[.light]] llega a 0.

Por eso muchos vegetales del Bestiario compran cloroplastos solo mientras la luz
alcance. Este es el gen de _Alga minimalis 3.0_:

```adn
' Compra cloroplastos mientras tenga menos que la luz libre
cond
 *.chlr *.light <
start
 160 .mkchlr store
stop
```

Corriéndolo con cada cloroplasto a 0,2 (las reglas F1), un alga sola en el campo
compra hasta quedarse con unos 110 de energía, cerca del piso de 100 debajo del
cual una compra se cancela. Treinta algas en un campo chico, en cambio, frenan
solas cerca de los 15400 cloroplastos, donde la luz libre las alcanza.

## Tener cloroplastos {#tener}
<!-- 31-ENERGIA §1 (ChangeChlr), §3 (decaimiento, reparto, masa, radio); 35-VIRUS (mkvirus); port/README A3-10 -->

Comprar ([[.mkchlr]]) cuesta [[param:cost:8]] por cloroplasto, y la compra se
cancela entera si dejaría al bot con menos de 100 de energía. Sacar
([[.rmchlr]]) es gratis y no devuelve nada. Además:

- **Se pierden solos.** Medio cloroplasto por ciclo cuando son pocos, una
  vigésima con 8000 y una ducentésima con 16000.
- **Pesan.** Cada cloroplasto suma casi 1 de [[.mass]] y agranda el radio, así que
  un bot con muchos apenas se mueve y tapa más luz.
- **Se reparten.** Al reproducirse, el hijo se lleva su porcentaje
  ([[simulacion/reproduccion]]). Dentro de un organismo se pueden compartir con
  [[.sharechlr]], solo entre parientes cercanos.
- **Digieren desechos.** Un bot con cloroplastos convierte de a poco sus
  desechos en energía y cuerpo (ver [[simulacion/energia#desechos]]).
- **Son incompatibles con los virus.** Si un bot con cloroplastos intenta fabricar
  uno con [[.mkvirus]], los pierde todos ([[simulacion/virus]]).

Un bot puede adaptarse al ciclo de día y noche. _Chloroplastus_, del Bestiario,
compra de a 1 cuando es de día y se deshace de a 1 de noche, mientras tenga más
de 500:

```adn
' De noche se aliviana
cond
 *.daytime 0 =
 *.chlr 500 >
start
 1 .rmchlr store
stop
```

## Día y noche {#dia-y-noche}
<!-- 50-MUNDO §2.2 (decisión día/noche: umbrales, luego reloj); core feedvegs; comprobado: opt:33 1, opt:34 3 → 3 ciclos de día, 4 de noche, 4 de día -->

Si nadie lo cambia, siempre es de día. Hay dos maneras de que haya noche:

- **El reloj.** Con [[param:opt:33]] activado, el día y la noche se alternan. Cada
  tramo dura [[param:opt:34]] ciclos más uno (con 3, cuatro ciclos de sol y cuatro
  de oscuridad); solo el primer día de la simulación dura uno menos.
- **La energía total del mundo**, que suma la energía y diez veces el cuerpo de
  cada bot vivo, más la de los disparos de energía en vuelo. Con [[param:opt:35]]
  sale el sol si baja de [[param:opt:36]]; con [[param:opt:37]] se pone si pasa de
  [[param:opt:38]]. Así se frena una población que crece demasiado o se rescata a
  una que se está muriendo. Qué hace el umbral con el reloj lo decide
  [[param:opt:39]]: forzar solo ese ciclo, cambiar el estado hasta el próximo
  umbral o reiniciar el reloj desde ahí.

El bot se entera por [[.daytime]], que vale 1 de día y 0 de noche. Para uno con
cloroplastos, vale 1 solo si además está en la franja iluminada. De noche
[[.light]] no se recalcula: se sigue leyendo el último valor de día.

### La franja del sol {#franja}
<!-- 50-MUNDO §0.3, §2.2 (banda (0,25 + SunRange³·0,75)·FieldWidth, deriva ±0,0005, cambios 1/2000) -->

Con [[param:opt:40]], el sol ilumina una franja vertical del campo, de arriba
abajo, que se mueve sola. Su ancho va de un cuarto del campo al campo entero, y
arranca en algo más de un tercio. La franja se corre un 0,05 % del ancho del
campo por ciclo y su ancho crece o se achica despacio. Cada tanto (en promedio, una
vez cada 2000 ciclos) elige de nuevo: hacia la izquierda, hacia la derecha o
quieta, y si se ensancha o se angosta. Una franja que se sale por un borde sigue
por el otro. Para un vegetal fijo, eso significa estaciones largas de sol y de sombra;
uno que se mueve puede seguir a la luz.

## Los vegetales {#vegetales}
<!-- 50-MUNDO §0.1, §2.1; core VegsRepopulate, checkvegstatus, aggiungirob, Reproduce (MaxPopulation, lotería 1/11), ChangeChlr; port/README B7-1, B7-4; comprobado: MinVegs 3, un vegetal → 10 nuevos en el ciclo 10 -->

Un vegetal es un bot de una especie que marcaste como vegetal al armar la
simulación. Fotosintetiza igual que cualquier otro bot con cloroplastos; lo que
cambia es cómo lo trata el mundo:

- Nace con [[param:base:startChlr]] cloroplastos (16000 si no lo cambiás).
- No sufre shock ([[simulacion/energia#shock]]).
- Sus hijos también son vegetales.
- Su población tiene tope, y la simulación lo repone cuando escasea.

### La repoblación {#repoblacion}
<!-- 50-MUNDO §2.1; core VegsRepopulate (acumulador con deuda), aggiungirob (body 1000, nrg de la especie), checkvegstatus -->

En cada ciclo, el motor suma los cloroplastos de todos los bots vivos y los divide
por 16000. Si el resultado está por debajo de [[param:base:minVegs]], cuenta un
ciclo de espera; cuando junta [[param:base:repopCooldown]], siembra
[[param:base:repopAmount]] vegetales nuevos y vuelve a contar. Cada uno nace en un
lugar al azar dentro de la zona de su especie, con 1000 de cuerpo y la energía
inicial de la especie.

Ojo con la unidad: el umbral cuenta **cloroplastos**, no bots. Con el valor de
la app, 15, la siembra se activa si en todo el campo hay menos de 15 × 16000
cloroplastos. Veinte vegetales flacos, de 4000 cada uno, valen 5 y disparan la
siembra igual. Y cuentan también los cloroplastos de los animales.

La especie de cada vegetal nuevo se elige al azar entre las especies vegetales que
todavía tienen algún bot vivo con cloroplastos. Si no queda ningún vegetal vivo,
entran todas.

:::nota
En el DarwinBots 2.48.32 original, la primera siembra después de cargar una
simulación guardada tardaba el doble de ciclos. El port la hace a tiempo (ver
[[tecnico/diferencias]]).
:::

### El tope {#tope}
<!-- 31-ENERGIA §3; core ChangeChlr (TotalChlr > MaxPopulation y Veg), Reproduce (lotería RandomI(0,10) != 5 por encima del 90 %); port/README B6-2 -->

[[param:base:maxPopulation]] también se mide en unidades de 16000 cloroplastos.
Cuando el total del campo pasa ese tope, los vegetales no pueden reproducirse ni
comprar cloroplastos; por encima del 90 % del tope, solo uno de cada once
intentos de reproducción sigue adelante. A los animales el tope no los afecta.
