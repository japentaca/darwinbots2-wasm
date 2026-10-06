---
titulo: Un bot que dispara
resumen: "Paso a paso hasta un cazador completo: girar hasta ver, apuntar con las ref*, disparar de cerca y reinvertir la energía en hijos."
etiquetas: [tutorial, disparos, caza, puntería, reproducción]
estado: revisada
---
En [[tutoriales/se-mueve]] escribiste un bot que avanza y vira, y en
[[tutoriales/busca-comida]] le diste ojos para encontrar comida. Este tutorial
le suma lo que le falta a un cazador: apuntar y disparar. Al final tenés un bot
que ve, persigue, le roba energía a distancia y, con lo que gana, se reproduce.

## Paso 1: el blanco y el cazador {#blanco}

<!-- i18n/es/bots.json (bots.nuevo «+ Nuevo bot», sembrar); app/bots.md #nuevo #sembrar (ficha → Sembrar; «Sembrar en la corrida actual» / «Nuevo escenario con estos») -->

Un cazador sin presa no se nota, así que empezamos por las dos especies. Andá
a **Bots** y creá dos bots con **+ Nuevo bot**: «Cazador» y «Blanco». Al Blanco
dejale un gen vacío, para que se quede quieto:

```adn
' Blanco de practica: no hace nada
cond
start
stop
```

Al Cazador le vamos escribiendo el ADN en los pasos que siguen. Después
sembrá el Cazador en un escenario nuevo (en su ficha, **Sembrar** →
**Nuevo escenario con estos**) y el Blanco en esa misma corrida
(**Sembrar en la corrida actual**), con **Cantidad de bots** en 1 cada uno y
colores bien distintos.

Para mirar de cerca, hacé clic en un bot: el inspector te deja seguir su
energía ciclo a ciclo ([[app/inspector]]).

## Paso 2: girar hasta verlo {#girar}

<!-- 32-VISION §0.2 (abanico: eye5 adelante, 35 unidades por ojo), §0.3; probado: giro.txt contra blanco.txt, semilla 1 (gira 35 por ciclo, ve al blanco en el ciclo 8 y se frena apuntándolo, aim 1136) -->

[[.eye5]] es el ojo frontal: vale 0 si no hay nada adelante y crece cuanto más
cerca está lo que ve. El gen más simple para buscar es girar mientras ese ojo
no ve nada:

```adn
' Sin nada a la vista: giro buscando
cond
 *.eye5 0 =
start
 35 .aimdx store
stop
```

[[.aimdx]] gira hacia la derecha la cantidad que le escribís. Con 35 por ciclo
gira justo un ojo por vez: lo que hoy entra por [[.eye4]] pasa al frontal al
ciclo siguiente. Así barre el frente de costado a costado.

Qué deberías ver: el Cazador gira sobre su eje y en algún momento se frena,
quieto, mirando al Blanco. En nuestra corrida giró ocho ciclos hasta que el
otro le entró por el ojo frontal, a unas 650 unidades de borde a borde, y ahí
se quedó apuntándolo. Si no ve nada en 360 grados, sigue dando vueltas para
siempre.

## Paso 3: apuntarle de frente {#apuntar}

<!-- 32-VISION §2.6 (el ojo con foco llena las ref*; si no ve nada, valen 0), §4; sysvars .refxpos/.refypos; 20-VM §6.2 (angle); probado: apunta.txt contra caminante.txt (el bot de se-mueve), semilla 1: mantiene al blanco en eye5 mientras lo persigue; y sin nada a la vista: las ref* valen 0 y un bot que apunta a ciegas clava el rumbo hacia la esquina (0, 0) (aim 501 desde (1496, 1107), campo 4000×3000) -->

Girar de a pasos encuentra, pero no persigue: si el blanco se mueve, se te
escapa del ojo frontal, que es angosto. Para apuntar de verdad hace falta saber
_dónde_ está, y eso lo dan las celdas `ref*`: lo que el ojo con foco ve queda
descrito en ellas ([[simulacion/vision]]). La posición del otro está en
[[.refxpos]] y [[.refypos]]; el operador [[op:angle]] convierte esas dos
coordenadas en el rumbo hacia ese punto, y [[.setaim]] gira hasta ese rumbo.
Todo junto en un gen, que además empuja hacia adelante para acercarse:

```adn
' Si veo algo: le apunto y me acerco
cond
 *.eye5 0 >
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop
```

Fijate que la condición es `*.eye5 0 >` y no «veo algo por cualquier ojo»: las
`ref*` describen lo que ve el ojo con foco, y si ese ojo no ve nada valen 0 —
apuntarías hacia la esquina (0, 0) del campo.

Qué deberías ver: el Cazador clava el rumbo en el blanco y avanza hacia él,
corrigiendo cada ciclo. En nuestra corrida, contra un blanco que se desplazaba
de costado, lo mantuvo en el ojo frontal durante todo el recorrido, sin
perderlo nunca.

## Paso 4: disparar de cerca {#disparar}

<!-- 33-SHOTS §2.1 (el −1 pide energía; value = 20 + body/5), §5 (releasenrg: el golpeado pierde y un −2 vuelve hacia el tirador); probado: paso2.txt (disparando a eye5 5, a ~650, no pasa nada), caza50.txt contra blanco.txt, semilla 1 (empieza a cobrar al ciclo 25, más de 200 por ciclo, blanco muerto antes del 40, cazador 3000 → 6164) -->

Llegó la parte del título. Escribir un número en [[.shoot]] dispara, y el
número elige el tipo: el **−1** es el que come: le saca energía al blanco, y de
vuelta vuela hacia vos un regalo con lo robado, que te alimenta cuando llega
([[simulacion/disparos#energia]]). El motor lanza el tiro en la fase de
_acciones_ del mismo ciclo, hacia donde apunta tu rumbo.

Ahora, ¿cuándo disparar? No en cuanto lo veas. Los disparos pierden fuerza con
la distancia y mueren al final de su alcance, que con 1000 de cuerpo llega a
unos 440 ([[simulacion/disparos#alcance]]). En nuestra corrida, con el blanco a
unas 650 unidades de borde a borde (un `eye5` de 5), el Cazador llovía disparos
que se esfumaban en el camino sin tocar a nadie. Dispará solo de cerca:

```adn
' Lo tengo cerca y enfrente: disparo
cond
 *.eye5 50 >
start
 -1 .shoot store
stop
```

Un `eye5` de 50 es unos 200 de distancia de borde a borde: a esa distancia el
tiro llega con casi toda su fuerza. Es el mismo umbral que usa _Hunter 2.16_,
del Bestiario.
<!-- Bestiario: Hunter_2.16_F2_PY_-23.02.05.txt, gen «shoot at enemy» (*.eye5 50 > → -1 .shoot store) -->

Qué deberías ver: en el inspector, la energía del Blanco baja ciclo a ciclo
mientras el Cazador dispara, y la del Cazador sube. En nuestra corrida, apenas
superó el umbral de cerca, el blanco empezó a perder más de 200 por ciclo y a
los quince estaba muerto; el cazador había pasado de 3000 a más de 6000 de
energía.

Dos ajustes más, para cuando los necesites:

- **El costo.** Cada disparo tiene precio ([[param:cost:23]]: 2 en la liga
  F1), pero en los escenarios de fábrica, salvo el Partido F1, los costos
  están en 0: acá disparar es gratis. En la F1, cada tiro sale de tu energía
  ([[app/experimentar]]).
  <!-- simulacion/energia #mantenimiento (escenarios de fábrica salvo F1 con costos 0); opciones.js preset F1 (cost:23 = 2; por defecto 0) -->
- **La potencia.** [[.shootval]] multiplica la fuerza del −1: con 8 la
  duplica, y se cobra como un disparo más caro. Para empezar no hace falta.

## Paso 5: gastar la ganancia en hijos {#reproducirse}

<!-- 36-REPRO §2 (30 %: hijo 899,1/300 de 3000/1000; persiste hasta el éxito); probado: final5000.txt contra caminante.txt, campo 1500x1000, semilla 1 (primera caza: 6164; parto: padre 3952 nrg / 705 body, hijo 2228 / 306); con el umbral en 6000 nunca se reproducía (máximo 5955) -->

Un cazador que junta energía y no hace nada con ella no va a ninguna parte.
La orden de dividirse es [[.repro]]: el número es el porcentaje de energía, cuerpo y
cloroplastos que se lleva el hijo. Con la energía que deja una buena caza, un
umbral de 5000 va bien:

```adn
' Con energia de sobra: un hijo
cond
 *.nrg 5000 >
start
 30 .repro store
stop
```

El 30 % deja al hijo con casi un tercio y al padre con la mayoría, para seguir
cazando. Dos cosas que conviene saber ([[.repro]], [[simulacion/reproduccion]]):

- La orden **persiste hasta que nace el hijo**: si el parto falla —por
  ejemplo, porque no hay lugar donde tiene que aparecer el crío— se reintenta
  sola cada ciclo.
- El hijo **hereda el ADN**: a los pocos ciclos de nacido ya busca y dispara
  como el padre.

Por qué 5000 y no más: una sola presa de 3000 deja al cazador rondando los
6000. Con el umbral en 6000, en nuestra corrida no alcanzó el corte por 45 de
energía y no se reprodujo nunca; con 5000, apenas mató a su primera presa
nació el hijo: el padre quedó con unos 3950 de energía y 700 de cuerpo, el
hijo arrancó con unos 2230 y 300.

:::cuidado
Tu cazador no distingue a los suyos: un −1 le roba energía a cualquier bot,
incluida su familia ([[simulacion/disparos#impacto]]); solo el recién nacido
está a salvo de los disparos de su padre sus primeros ciclos. En nuestra
corrida, padre e hijo quedaron pegados disparándose: en diez ciclos el hijo
había ganado unos 770 y el padre perdido unos 730. La cura es reconocer a los
de tu especie, y es justamente el próximo tutorial:
[[tutoriales/reconoce-especie]].
<!-- probado: final5000.txt, ciclos 60-70 (hijo +770, padre −729); 33-SHOTS §5 (no hay fuego amigo); port/README B3-1 (inmunidad filial corregida: solo los primeros ciclos) -->
:::

## El cazador completo {#el-bot}

Acá está todo junto, los cuatro genes. Copialo en el editor y sembralo contra
cualquier cosa que se mueva.

<!-- probado: final5000.txt contra caminante.txt, campo 1500x1000, semilla 1, 200 ciclos: caza al caminante en ~50 ciclos, primer parto, hijo caníbal, segundo parto al ~170; lint sin avisos -->

```adn
' Cazador: busca, apunta, dispara y se reproduce

' Gen 1: sin nada a la vista, giro buscando
cond
 *.eye5 0 =
start
 35 .aimdx store
stop

' Gen 2: si veo algo, le apunto y me acerco
cond
 *.eye5 0 >
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop

' Gen 3: lo tengo cerca y enfrente: disparo
cond
 *.eye5 50 >
start
 -1 .shoot store
stop

' Gen 4: con energia de sobra, un hijo
cond
 *.nrg 5000 >
start
 30 .repro store
stop
end
```

Qué deberías ver: el cazador barre con la vista, encañona a la primera presa,
la persigue disparando y, cuando la energía le sobra, se divide. En nuestra
corrida contra un solo blanco móvil lo cazó en unos cincuenta ciclos, tuvo dos
hijos, y después la familia quedó girando en el lugar, robándose entre
sí lo que quedaba — sin comida nueva, un cazador termina volviéndose
contra los suyos. Sembrá más presas, o vegetales con la repoblación
([[param:base:minVegs]]), y mirá la manada crecer.
<!-- probado: final5000.txt, semilla 1: el caminante muerto antes del ciclo 50; bots de la especie: 1 → 2 (ciclo 60) → 3 (ciclo 170) -->

## Qué probar después {#despues}

<!-- 33-SHOTS §5 (releasenrg: al cadáver, con nrg 0, no le saca nada; releasebod: el −6 sobre cadáver ×4 y todo de body; takeven: el −3 paraliza y escribe Vloc/Vval); 31-ENERGIA §0.3 (caparazón, baba, veneno y toxina) -->

- **Comer cadáveres.** El −1 no les saca nada a los muertos, pero el −6 les
  roba cuerpo y es el disparo más rendidor contra cualquier blanco
  ([[simulacion/disparos#cuerpo]]).
- **Veneno y defensas.** Con −3 paralizás al blanco y le escribís en la
  memoria; del otro lado, caparazón, baba, toxina y veneno son las formas de
  que no te hagan esto a vos ([[simulacion/defensas]]).
- **No disparar a los tuyos.** Comparar la firma del otro con la tuya
  ([[.refeye]] contra [[.myeye]]) es la mejora natural de este bot:
  [[tutoriales/reconoce-especie]].
- **Cazar con costos.** En el Partido F1 cada disparo cuesta y las presas
  también se defienden: la misma táctica necesita umbrales y presupuesto
  ([[app/experimentar]]).
