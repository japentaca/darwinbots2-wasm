---
titulo: Defensas
resumen: "Caparazón, baba, veneno y toxina: cómo se fabrican con energía, cuánto cuestan, cuáles se gastan solas y qué le hacen a quien te ataca."
etiquetas: [defensas, caparazón, baba, veneno, toxina, parálisis]
estado: revisada
---
Un bot puede convertir energía en cuatro sustancias: _caparazón_ (shell),
_baba_ (slime), _veneno_ (venom) y _toxina_ (poison). Las cuatro se fabrican
igual, pero cada una sirve contra otra cosa. Esta página cuenta cómo
funcionan; las sysvars que las manejan están en [[sysvars/defensas]].

| Sustancia | Se fabrica con | Se lee en | Por 1 de energía | Tope por ciclo | Se gasta sola | Sirve contra |
|---|---|---|---|---|---|---|
| Caparazón | [[.mkshell]] | [[.shell]] | 10 | 100 | no | disparos de cuerpo (−6) y de veneno (−3) |
| Baba | [[.mkslime]] | [[.slime]] | 10 | 200 | 2 % por ciclo | lazos y virus |
| Veneno | [[.strvenom]] | [[.venom]] | 1 | 100 | no | es munición: paraliza |
| Toxina | [[.strpoison]] | [[.poison]] | 4 | 100 | 2 % por ciclo | disparos de energía (−1), de memoria y robos por lazo |

<!-- 31-ENERGIA §0.3 (1 nrg = 10 shell = 10 slime = 1 venom = 4 poison; topes 100/200/100/100), §1 (slime y poison ×0.98 en P1); 33-SHOTS §5 -->

## Fabricar {#fabricar}
<!-- 31-ENERGIA §0.3 y §1 (coste de transacción a Waste); 10-CICLO §5 P5 (MakeStuff antes de Shooting); core robots.hpp storevenom/storepoison/makeshell/makeslime (nrg > 0; Delta topado por nrg/tasa y por 100/200; Cost/(numties+1) solo shell y slime si Multibot; Waste += Cost entero); probado: los cuatro a 100 cuestan 145 sin costos y 167 con los costos F1, con 22 de desecho -->

El ADN escribe cuánto quiere sumar en la orden de cada sustancia. El motor
fabrica en la fase de _acciones_ del mismo ciclo, antes de los disparos (así
que el veneno fabricado ya se puede disparar en ese ciclo), y deja la orden
en 0. Para seguir fabricando hay que volver a escribirla.

El precio tiene dos partes:

- **La conversión**, fija: 1 de energía por cada 10 de caparazón o de baba,
  por cada 1 de veneno o por cada 4 de toxina.
- **Un costo de transacción**, que pone el escenario por unidad fabricada
  ([[param:cost:29]], [[param:cost:28]], [[param:cost:26]] y
  [[param:cost:27]], multiplicados por el [[param:cost:54]]). Esa energía no
  se pierde: se convierte en desechos ([[.waste]]).

Este bot fabrica 100 de cada una en su primer ciclo:

```adn
' Cien de cada defensa al nacer
cond
 *.robage 0 =
start
 100 .mkshell store
 100 .mkslime store
 100 .strvenom store
 100 .strpoison store
stop
```

Sin costos de transacción le cuesta 145 de energía (10 + 10 + 100 + 25).
Con los costos del preset F1 paga 22 más, y esos 22 aparecen en sus
desechos.

Algunos detalles:

- Si pedís más de lo que tu energía puede pagar, el motor fabrica lo que
  alcance. Con la energía en 0 o menos, la orden no se cumple y queda
  escrita.
- Un número negativo desarma la sustancia, pero no devuelve energía: también
  se cobra.
- En un organismo de varios bots atados ([[.multi]]), la transacción del
  caparazón y la baba se divide por la cantidad de lazos más uno. El veneno
  y la toxina no tienen descuento.
- Dentro de un organismo, el caparazón y la baba se pueden repartir por los
  lazos, y el veneno se puede inyectar por un lazo (ver [[simulacion/lazos]]).

## Lo que se gasta solo {#decaimiento}
<!-- 31-ENERGIA §1 (Upkeep P1: slime y poison ×0.98, suelo 0.5 → 0, publicados); 10-CICLO §5 P1; probado: 100 de baba y de toxina bajan a 49 en 35 ciclos; caparazón y veneno quedan en 100 -->

La baba y la toxina pierden el 2 % por ciclo, al empezar la fase de _fuerzas
y choques_. Una reserva que no se repone se reduce a la mitad en unos 35
ciclos. Si reponés lo mismo en cada ciclo, la reserva se estabiliza cerca de
50 veces esa cantidad: con 200 de baba por ciclo, cerca de 10000; con 100 de
toxina, cerca de 5000.

El caparazón y el veneno no se gastan solos: quedan hasta que te los comen
los disparos, los disparás o los desarmás.

## Caparazón {#caparazon}
<!-- 33-SHOTS §5 (releasebod: shell absorbe ÷20, ShellEffectiveness = 20; takeven: ×25 VenumEffectivenessVSShell); core shots.hpp; 30-FISICA CalcMass (shell/200); probado: un −6 de 510 baja el caparazón de 100 a 74; 30 de veneno lo bajan de 100 a 62 sin paralizar -->

El caparazón se interpone entre algunos disparos y el bot. Cada golpe se come
primero el caparazón, y solo lo que sobra llega al bot.

- **Contra el robo de cuerpo (−6).** Cada punto de caparazón frena 20 de
  fuerza. Un −6 de un tirador de 1000 de cuerpo pega con 510, así que se come
  25,5 de caparazón: 100 de caparazón, que cuestan 10 de energía, aguantan
  casi cuatro de esos disparos sin que el bot pierda nada.
- **Contra el veneno (−3).** Rinde menos: cada punto de caparazón frena 0,8 de
  veneno. En la prueba, un disparo con 30 de veneno bajó el caparazón de 100 a
  62 y no paralizó.

No frena los disparos de energía (−1), los de memoria, los de desechos ni los
virus. Para los dos primeros está la toxina.

El costo escondido es el peso: cada 200 de caparazón pesan lo mismo que 1000
de cuerpo ([[.mass]]), y un bot más pesado acelera menos con el mismo empuje
(ver [[simulacion/fisica]]).

## Baba {#baba}
<!-- 34-TIES §0.5 (deflect = Random(2,92); slime del objetivo −20 por intento); 35-VIRUS / 33-SHOTS §5 (−7 addgene); README B3b-2 -->

La baba no frena los disparos de energía, de cuerpo ni de veneno (ver
[[simulacion/disparos]]). Sirve contra dos cosas:

- **Lazos.** Cuando otro bot intenta atarte, el motor sortea un número entre 2
  y 92; si tu baba es mayor, el lazo no se forma. Con más de 92 nadie te ata.
  Cada intento, salga o no, te come 20 de baba. Ver [[simulacion/lazos]].
- **Virus.** Un disparo de virus tiene que atravesar la baba primero, y se
  gasta en el intento. Ver [[simulacion/virus]].

Como se evapora, una capa de baba exige reponer todos los ciclos.

## Veneno {#veneno}
<!-- 33-SHOTS §2.1 (−3: min(|shootval|, venom) o venom/20), §5 (takeven: conespecífico absorbe; shell ×25; Paracount += power, tope 32000; Vloc/Vval del shot); 21-MEMORIA §4.3, §6; 10-CICLO §5 P1 (Poisons después del ADN y antes de las acciones); probado: veneno.txt contra blanco.txt (30 de veneno: parálisis de unos 30 ciclos; la víctima regala el 1 % de su energía por ciclo y pierde 781) -->

El veneno es un arma: se dispara con `-3` en [[.shoot]]. El disparo lleva
lo que diga [[.shootval]] (sin signo y nunca más de lo que tengas) o, si
vale 0, la vigésima parte de tu [[.venom]]. Además del veneno, cuesta el
[[param:cost:23|costo de disparar]] como los demás disparos.

Al pegar en un bot de **otra especie**:

1. Su caparazón frena lo que pueda (ver arriba).
2. El veneno que pasa se convierte en ciclos de parálisis: cada punto de
   veneno, un ciclo, que se suman a los que ya tuviera (hasta 32000).
3. La víctima recibe tu par [[.vloc]] y [[.venval]], tal como estaban cuando
   disparaste, y reemplaza al de un golpe anterior.

Mientras le queden ciclos de parálisis, el motor escribe en cada ciclo el
`.venval` en la celda `.vloc` de la víctima. Lo hace al empezar la fase de
_fuerzas y choques_, después de que corrió su ADN y antes de las acciones,
así que la orden que le pongas se cumple ese mismo ciclo y su ADN no puede
corregirla. Fuera de eso, el bot paralizado sigue funcionando: se mueve,
dispara y ejecuta su ADN. La víctima ve los ciclos que le quedan en
[[.paralyzed]].

Si le pega a uno de **tu especie**, no lo paraliza: el veneno se suma a su
reserva.

```adn
' Al nacer: mi veneno hace que la victima regale energia
cond
 *.robage 0 =
start
 .shoot .vloc store
 -2 .venval store
 100 .strvenom store
stop

' Busco algo para mirar
cond
 *.eye5 0 =
start
 40 .aimdx store
stop

' Le tiro 30 de veneno, una sola vez
cond
 *.eye5 0 >
 *.venom 30 >
 *50 0 =
start
 30 .shootval store
 -3 .shoot store
 1 50 store
stop
```

En la prueba, contra un bot quieto, el blanco quedó paralizado unos 30 ciclos.
En cada uno disparó un regalo con el 1 % de su energía y terminó con 781
menos. Como el blanco no miraba al tirador, esos regalos se perdieron en el
vacío.

El veneno también se puede inyectar por un lazo (ver [[simulacion/lazos]]).

## Toxina {#toxina}
<!-- 33-SHOTS §3.4 (tipo positivo: bloqueo si poison >= nrg/2, rebote −5, poison −= 0.9·nrg/2, waste += 0.1·nrg/2), §5 (releasenrg: poison > power → createshot −5 con power, poison −= 0.9·power; takepoison: conespecífico absorbe, Poisoncount += power/1.5, Ploc/Pval), §2.3 (createshot toma mem(834) y mem(839) del emisor); 34-TIES §2; probado: tira.txt contra toxico.txt (el mordedor queda con .poisoned 145, el mordido no pierde energía y su toxina baja 198), memshot.txt contra toxico.txt (la 52 no se escribe), tira.txt contra toxico2.txt (200 ciclos sin ganar energía) -->

La toxina no se dispara: es una defensa pasiva que actúa cuando te muerden.

- **Contra un −1.** Si tu toxina supera la fuerza del golpe, no perdés
  energía. En lugar del regalo de vuelta, sale hacia el atacante un disparo
  de toxina con esa misma fuerza, y tu toxina baja el 90 % de esa fuerza.
- **Contra un disparo de memoria.** Si tu toxina llega a la mitad de la
  energía del disparo, no se escribe nada y también sale toxina hacia el
  tirador.
- **Contra un robo por lazo.** Si te chupan energía o cuerpo por un lazo,
  pasa algo parecido (ver [[simulacion/lazos]]).

No frena los −6: para eso está el caparazón.

El disparo de toxina viaja como cualquier otro, con tu [[.ploc]] y tu
[[.pval]] de ese momento. Al pegar en un bot de otra especie, le suma ciclos
de envenenamiento: la fuerza del golpe dividida por 1,5 (hasta 32000). En la
prueba, el mordisco de un bot de 1000 de cuerpo (220 de fuerza) le dejó 145
ciclos de envenenamiento. Mientras le duren, el motor escribe tu `.pval` en
su celda `.ploc` en cada ciclo, en el mismo momento que la parálisis. El
envenenado ve los ciclos que le quedan en [[.poisoned]].

Si la toxina le pega a uno de tu especie, se suma a su reserva y no lo
envenena. O sea que morder a un hermano tóxico tampoco da de comer, pero no
envenena.

Un uso muy eficaz es apuntar `.ploc` a [[.shoot]] con `.pval` en 0: el
envenenado tiene su orden de disparo borrada cada ciclo y no puede volver a
morder.

```adn
' Quien me muerda deja de disparar: su .shoot queda en 0
cond
 *.robage 0 =
start
 .shoot .ploc store
 0 .pval store
stop

cond
 *.poison 1000 <
start
 100 .strpoison store
stop
```

En la prueba, un cazador que le disparaba −1 sin parar pasó 200 ciclos sin
ganar nada de energía. Cada vez que se le acababa el envenenamiento volvía a
morder, y la toxina lo frenaba otra vez.

## Dónde escribe el veneno o la toxina {#celda}
<!-- 21-MEMORIA §6 ((memloc−1) Mod 1000 + 1; 340 → mem(0); ≤ 0 → Random(1,1000) sin 340); core robots.hpp Poisons (cuenta −1 por ciclo; < 1 termina y borra Vloc/Vval); shots.hpp takeven/takepoison -->

Las reglas de [[.vloc]] y [[.ploc]] son las mismas:

| Valor | Celda de la víctima |
|---|---|
| 1 a 1000 | esa celda |
| mayor que 1000 | se toma módulo 1000, como una dirección (1050 es la 50) |
| 0 o negativo | una al azar en cada golpe |
| 340 ([[.delgene]]) | ninguna: está protegida |

Son configuración: el motor no las borra, pero un recién nacido arranca con
todo en 0. Por eso muchos bots las fijan con `*.robage 0 =`. Cada ciclo la
cuenta de parálisis o de envenenamiento baja 1, y cuando se termina el motor
deja de escribir. Un bot puede estar paralizado y envenenado a la vez, y
entonces el motor le pisa dos celdas.

## Un bot del Bestiario {#ejemplo}
<!-- Bestiario: Alga_Toxicus.txt; probado: alga.txt contra tira.txt (el cazador queda paralizado, .poisoned siempre 0, de 3000 a 935 en 120 ciclos) -->

_Alga Toxicus_ usa veneno y toxina en tres genes. Al nacer apunta las dos
celdas a [[.shoot]] y elige `-2` para su veneno. Después dispara veneno en
cada ciclo hacia un lado al azar y, cuando le sobra energía, se reproduce y
repone las dos reservas:

```adn
cond
 *.robage 0 =
start
 .shoot .ploc store
 .shoot .vloc store
 -2 .venval store
stop

cond
start
 120 rnd .aimdx store
 -3 .shoot store
stop

cond
 *.nrg 1000 >
start
 50 .repro store
 100 .strpoison store
 100 .strvenom store
stop
end
```

Quien queda paralizado regala energía en cada ciclo, y quien la muerde se
queda sin poder disparar, porque su `.pval` es 0. En una prueba contra un
cazador que dispara −1 a todo lo que ve, el cazador quedó paralizado casi
enseguida: como su `.shoot` recibía −2 en cada ciclo, nunca llegó a morder,
y en 120 ciclos pasó de 3000 a 935 de energía.

Lo que tiene otro bot de cada sustancia se ve mirándolo, en [[.refshell]],
[[.refvenom]] y [[.refpoison]] (ver [[sysvars/ref]]). Las estrategias que
viven de estas defensas están en [[estrategias/defensivos]].
