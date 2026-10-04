---
titulo: Energía, cuerpo y desechos
resumen: "De dónde sale y a dónde va la energía de un bot en cada ciclo: costos, mantenimiento, el cuerpo como reserva, los desechos y el shock."
etiquetas: [energía, cuerpo, desechos, costos, mantenimiento, shock]
estado: revisada
---
Todo lo que hace un bot cuesta energía, y casi nada la crea. Esta página cuenta
cómo es esa contabilidad: las tres reservas del bot (energía, cuerpo y
desechos), en qué momento del ciclo se cobra cada cosa, cuánto cuesta vivir aunque
no hagas nada y qué pasa en los extremos. Los datos de cada sysvar están en la
referencia ([[sysvars/cuerpo]], [[sysvars/ganancias]]); acá va el mecanismo de
conjunto.

## Tres reservas {#reservas}
<!-- 31-ENERGIA §0.3, §3 -->

| Reserva | Sysvar | Para qué sirve |
|---|---|---|
| Energía | [[.nrg]] | Es la que se gasta. Si se acaba, el bot muere. |
| Cuerpo | [[.body]] | Una reserva lenta: vale 10 de energía por punto, hace al bot más grande y pesado ([[.mass]]) y, si baja de 0,5, también lo mata. |
| Desechos | [[.waste]] y [[.pwaste]] | No sirven para nada: son el resto de ciertas actividades y, si se juntan, intoxican al bot. |

Energía y cuerpo se cambian entre sí a 10 por 1: [[.strbody]] guarda energía en el
cuerpo y [[.fdbody]] la saca, de a 100 de energía por ciclo como máximo. El cambio
no tiene comisión.

## De dónde sale y a dónde va {#flujo}
<!-- 31-ENERGIA §0.3, §1 (libro mayor); 33-SHOTS (takenrg 95/4/1); 50-MUNDO §2.2-2.3 -->

En DarwinBots la energía **entra al mundo** por dos lados: el sol, que alimenta a
los bots con cloroplastos, y los vegetales nuevos que siembra la repoblación (ver
[[simulacion/cloroplastos]]). Todo lo demás la pasa de un bot a otro, la convierte
o la gasta.

```
  entra                                   sale
  ─────                                   ────
  sol (cloroplastos) ──┐            ┌──► ADN, moverse, girar, disparar
  comer a otros ───────┤            ├──► mantenimiento (edad, cuerpo, ADN)
  cuerpo (.fdbody) ────┼──► ENERGÍA ┼──► defensas ──► desechos
  desechos digeridos ──┘            ├──► cuerpo (.strbody), cloroplastos
                                    └──► el hijo, o comida para otro
```

<!-- core takenrg: nrg + 0,95·E, body + 0,004·E, waste + 0,01·E; Reproduce: padre −0,1 % y hijo ×0,999 de la parte -->
Cuando un bot come con un disparo, de la energía que recibe un 95 % va a su
energía, el equivalente a un 4 % entra como cuerpo (0,4 puntos de cuerpo por cada
100 de energía) y el 1 % se le vuelve desecho (ver [[simulacion/disparos]]). Al
reproducirse, el hijo se lleva su parte y en la mudanza se pierde un 0,2 % de esa
parte, la mitad a cada lado (ver [[simulacion/reproduccion]]).

## Cuándo se cobra cada cosa {#por-fase}
<!-- 31-ENERGIA §0.2, §1 (tabla por fase); 10-CICLO §2, §5 (P1, P3, P5, P6) -->

El orden importa, porque una fase ve lo que dejó la anterior. Con los nombres de
las fases de [[simulacion/ciclo]]:

| Fase | Qué se cobra o se abona |
|---|---|
| El ADN | Cada instrucción ejecutada ([[adn/ejecucion]]). |
| Los disparos | Lo que se come o se pierde por disparos que llegan. |
| Fuerzas y choques | El mantenimiento (edad, cuerpo y largo del ADN) y el empuje de [[.up]], [[.dn]], [[.sx]] y [[.dx]]. |
| Movimiento | Girar, lo que pasa por los lazos ([[simulacion/lazos]]) y fabricar virus. Al final, la energía se recorta a ±32000. |
| Acciones | Fabricar defensas, los desechos, disparar, comprar cloroplastos, convertir energía y cuerpo, el shock, atarse y, al final, publicar los sentidos y decidir quién muere. |
| Nacimientos y muertes | El reparto con el hijo y la copia del ADN. |
| El sol | La fotosíntesis. |

Entre una fase y otra la energía puede quedar **negativa**: el ADN y los costos se
restan sin mirar el saldo. Recién en las acciones se decide si el bot murió (con
[[param:opt:50]] activado, por debajo de 15 se vuelve cadáver; si no, por debajo de
0,5 muere; ver [[simulacion/muerte]]). Lo que leés en [[.nrg]] es lo que quedó al
publicar los sentidos, nunca menos de 0. Como el sol llega después, lo que gana
un vegetal en el ciclo _N_ se ve publicado al final del _N+1_.

## Vivir cuesta {#mantenimiento}
<!-- 31-ENERGIA §1 (Upkeep: edad, body·BODYUPKEEP, (DnaLen−1)·DNACYCCOST, ×COSTMULTIPLIER); core Upkeep; comprobado: cuerpo 1000 con 0,001 → −1/ciclo; ADN de 4 con 1 → −3/ciclo; edad 2 desde 5 → cobra desde robage 7 -->

Aunque no ejecute nada útil, un bot paga en cada ciclo tres cuotas de
mantenimiento. Todas se multiplican por el [[param:cost:54]]:

| Cuota | Cuánto | Parámetros |
|---|---|---|
| Edad | Un monto fijo por ciclo desde una edad dada. | [[param:cost:31]], [[param:cost:32]] |
| Cuerpo | Una fracción por cada punto de [[.body]]. | [[param:cost:30]] |
| ADN | Un monto por cada instrucción del genoma, sin contar el `end`. | [[param:cost:24]] |

Por ejemplo, el bot `cond start stop` (tres instrucciones y el `end`) con 1000 de
cuerpo pierde 1 por ciclo si el cuerpo cuesta 0,001, y 3 por ciclo si el ADN cuesta
1, aunque sus genes no hagan nada.

La cuota de edad tiene tres formas. La básica cobra siempre lo mismo una vez que la
edad pasó de [[param:cost:32]]. Con [[param:cost:51]] crece con el logaritmo de los
ciclos que pasaron desde esa edad; con [[param:cost:60]] crece en línea recta, a
razón de [[param:cost:33]] por ciclo. Es la forma de que los bots viejos dejen
lugar.

Con la configuración con la que arranca la app todos los costos están en 0 y
vivir es gratis. Las reglas F1 cobran 0,00001 por punto de cuerpo y 0,01 por
edad desde el primer ciclo: un bot con 1000 de cuerpo paga 0,02 por ciclo, poco al
lado de lo que gasta moviéndose (0,05 por unidad de empuje) o disparando (2 por
disparo). Los precios y cómo se cambian están en [[app/parametros-costos]]; el
ajuste automático del multiplicador, en [[app/parametros-costos-dinamicos]].

## El cuerpo {#cuerpo}
<!-- 31-ENERGIA §3; core storebody/feedbody (sin chequeo de saldo, tope 32000); comprobado: 250 de energía y 100 .strbody por ciclo → cadáver al tercer ciclo -->

El cuerpo es la alcancía del bot, y la forma de guardar energía sin que se la
pierda de un golpe. También es lo que lo hace grande: más cuerpo es más radio, más
masa y más difícil de mover. Si la simulación cobra mantenimiento por el cuerpo,
la alcancía tiene un costo.

Las conversiones no miran el saldo. `100 .strbody store` cobra 100 de energía
aunque el bot tenga 50: un bot con 250 de energía que guarda 100 por ciclo queda
en 50 al segundo ciclo y es cadáver al tercero. Las dos órdenes, con un ejemplo de
alcancía, están en [[sysvars/cuerpo]].

## Los desechos {#desechos}
<!-- 31-ENERGIA §2 (fuentes y sumideros, HandleWaste); core HandleWaste, altzheimer, feedveg2, defacate; shots −4 (0,99 y 1/100) -->

Los desechos ([[.waste]]) aparecen por tres vías:

- **Fabricar defensas.** El costo extra de [[.mkshell]], [[.mkslime]],
  [[.mkvenom]] y [[.mkpoison]] (ver [[simulacion/defensas]]) no desaparece: se
  vuelve desecho, uno por uno.
- **Comer.** El 1 % de lo que entra por un disparo o un lazo.
- **Recibir los de otro**, con un disparo −4 o por un lazo con [[.sharewaste]].

En cada ciclo, en las acciones, el motor los procesa en este orden:

1. Si el bot tiene cloroplastos, digiere un poco: con 16000 cloroplastos, medio
   desecho por ciclo, que se convierte en algo de energía y de cuerpo.
2. Si los desechos sumados a los permanentes ([[.pwaste]]) pasan del límite de
   [[param:opt:56]] (400 si no lo cambiaste), el bot se intoxica: el motor escribe
   números al azar en direcciones al azar de su memoria, una vez por cada 4
   unidades de exceso.
3. Si pasan de 32000, el bot los expulsa solo: bajan a 31000 y sale un disparo −4
   de 500.

La intoxicación es grave. En una prueba, un bot que fabricaba 100 de caparazón
por ciclo sin descargar llegó a 1000 de desechos en diez ciclos. Para entonces
tenía casi todas las direcciones de la 52 a la 60 llenas de basura, y al ciclo
siguiente se reprodujo sin quererlo: una de las escrituras al azar había caído en
[[.repro]]. Qué direcciones se ensucian es cuestión de suerte, pero cualquiera
puede tocarle, órdenes incluidas.

La forma normal de librarse es un disparo −4. Este bot se arma 500 de caparazón y
tira los desechos cuando pasan de 100:

```adn
' Se arma un caparazon y tira los desechos antes de que molesten
cond
 *.shell 500 <
start
 50 .mkshell store
stop
cond
 *.waste 100 >
start
 -4 .shoot store
 *.waste .shootval store
stop
```

Con el costo de caparazón en 1, cada ciclo de fabricación le cuesta 55 de energía
(5 de la conversión más 50 de costo) y le deja 50 de desechos, que descarga cada
dos o tres ciclos. Al terminar tiene 500 de caparazón, 0 de desechos y 5 de
desechos permanentes: de cada descarga, el 1 % se queda para siempre en
[[.pwaste]]. Esos permanentes no se pueden tirar; solo se diluyen al
reproducirse, porque el hijo se lleva su parte.

## El tope de 32000 {#tope}
<!-- 10-CICLO §5 (P3 clamp nrg ±32000; P5 body, waste); core feedbody, takenrg (desborde al cuerpo), ManageBody; comprobado: 31950 + 100 .fdbody → 32000 y el cuerpo baja 10 -->

Energía, cuerpo, desechos y cloroplastos tienen tope en 32000. Lo que pasa del tope
depende de por dónde llega:

- Comer: la energía que sobra pasa al cuerpo, a 10 por 1.
- [[.fdbody]] y el sol: lo que sobra se pierde. Un bot con 31950 de energía que
  convierte 100 queda en 32000 y paga igual los 10 de cuerpo.
- [[.strbody]] con el cuerpo lleno: la energía se cobra y el cuerpo no crece.

## El shock {#shock}
<!-- 10-CICLO §5 (Shock), §11.1; 31-ENERGIA §1; port/README A1-1; comprobado: 10000 de energía y 6000 .mkchlr a costo 1 → cadáver con 1400 de cuerpo; 9000 → sin shock -->

Un bot que no es vegetal sufre un _shock_ si en un solo ciclo pierde más de la
mitad de la energía con la que terminó el anterior y aun así le quedan más de
3000. Toda la energía que le queda pasa al cuerpo, a 10 por 1, y queda en 0, así
que muere en ese mismo ciclo (o se vuelve cadáver, con el cuerpo engordado).

```adn
' Mal negocio: compra 6000 cloroplastos de golpe
cond
 *.robage 5 =
start
 6000 .mkchlr store
stop
```

Con 10000 de energía y cada cloroplasto a 1, la compra lo deja en 4000: perdió
más de la mitad y le sobran más de 3000. Termina como cadáver con 1400 de cuerpo
(los 1000 que tenía más 400 de la energía convertida). Si comprara 9000, quedaría en
1000 y no habría shock: la regla solo mira a los que todavía tienen mucho. Un
disparo enemigo muy fuerte o un gasto grande pueden provocarlo; repartir a un hijo
no, porque el parto no cuenta como pérdida.

:::nota
En el DarwinBots 2.48.32 original, el shock ponía la energía en 0 _antes_ de
pasarla al cuerpo, así que se perdía. El port la convierte, como pretendía el
código (ver [[tecnico/diferencias]]).
:::

## Cómo lo ve el bot {#sentidos}
<!-- sysvars.yaml .pain .pleas .bodloss .bodgain (WriteSenses P5) -->

Todo lo de esta página llega al ADN con un ciclo de atraso. [[.nrg]], [[.body]],
[[.waste]] y [[.pwaste]] dicen cómo quedó el bot al final del ciclo anterior, y
[[.pain]], [[.pleas]], [[.bodloss]] y [[.bodgain]] cuánto cambió en ese ciclo, sin
decir por qué (ver [[sysvars/ganancias]]). Un bot recién sembrado lee todo eso en
0 en su primer ciclo, [[.nrg]] y [[.body]] incluidos.
