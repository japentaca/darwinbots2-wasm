---
titulo: Un bot que busca comida
resumen: "El segundo bot, paso a paso: los nueve ojos, un torneo de ADN para ir hacia el que más ve, comer a disparos y reproducirse cuando sobra energía."
etiquetas: [tutorial, ojos, caza, disparos, reproducción]
estado: revisada
---
En [[tutoriales/se-mueve]] terminaste un bot que recorre el mundo virando al
azar: se mueve, pero no va a ningún lado. Acá le agregamos lo que le falta para
ganarse la vida: ojos para encontrar la comida, una manera de decidir hacia
qué lado ir, un modo de comerla y, cuando le sobra energía, hijos.

## Paso 1: un mundo con comida {#comida}

La comida de DarwinBots son los _vegetales_: bots marcados como tales, que
cargan cloroplastos y fabrican energía con el sol
([[simulacion/cloroplastos]]).
<!-- 50-MUNDO §2.2 (feedvegs, el sol); 31-ENERGIA §0.4 -->

1. Abrí una corrida; la del tutorial anterior sirve.
2. En **Observar**, hacé clic en **Sembrar**, en la barra de abajo. En **Bot**, elegí
   el preset **Alga Minimalis (vegetal)**: lo marca como vegetal solo y
   propone 15 copias con 3000 de energía. Si sembrás otro ADN, marcá a mano
   **Vegetal (hace fotosíntesis)**.
3. En el mismo diálogo sembrá tu bot: 5 copias, 3000 de energía, un color que
   se distinga.
<!-- app/observar #sembrar (DialogoSembrar: preset Alga Minimalis, 15 y 3000 si es vegetal; «Vegetal (hace fotosíntesis)») -->

Dos cosas que la simulación hace sola. En la fase del sol, al final de cada
ciclo, todo vegetal con cloroplastos cobra su parte de la luz. Y si los
vegetales escasean, cada tanto siembra más
([[simulacion/cloroplastos#repoblacion]]). Toda la energía del mundo entra
por ahí; tu bot va a vivir robándosela a las algas.
<!-- 10-CICLO §2 (… nacimientos y muertes → el sol); 50-MUNDO §2.1, §2.2 -->

## Paso 2: los ojos {#ojos}

Tu bot tiene nueve ojos, de [[.eye1]] a [[.eye9]], abiertos en abanico de 90
grados alrededor de su rumbo: [[.eye5]] mira justo adelante, los de número
bajo hacia la izquierda y los de número alto hacia la derecha, de a 10 grados
por ojo. Cada uno vale 0 si no ve nada, y más cuanto más cerca está lo que ve:
1 en el límite del alcance (unas 1440 unidades de borde a borde), 100 a unas
134 y 32000 cuando se solapan. El detalle completo está en [[simulacion/vision]].
<!-- 32-VISION §0.2, §0.3, §0.4 -->

Para verlos en acción, empezá por un bot que no hace otra cosa que girar de a
un ojo por ciclo:

```adn
' Girar de a un ojo por ciclo, para ver que ve cada uno
cond
start
 35 .aimdx store
stop
```

[[.aimdx]] gira hacia la derecha la cantidad que escribas; 35 unidades son
unos 10 grados, justo un ojo. Cuando lo corrimos junto a tres vegetales, con
uno a unas 360 unidades de borde a borde, los ojos del bot marcaron esto:

| Ciclo | `.eye1` | `.eye2` | `.eye3` | `.eye4` | `.eye5` | `.eye6` | `.eye7` | `.eye8` | `.eye9` |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 15 | 15 | 15 | 5 | 3 |
| 2 | 0 | 0 | 0 | 15 | 15 | 15 | 5 | 3 | 0 |
| 3 | 0 | 0 | 15 | 15 | 15 | 5 | 3 | 0 | 0 |
| 4 | 0 | 15 | 15 | 15 | 5 | 3 | 0 | 0 | 0 |
| 5 | 15 | 15 | 15 | 5 | 3 | 0 | 0 | 0 | 0 |
| 7 | 15 | 5 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| 9 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

El vegetal entra por la derecha del abanico, cruza el frente y se sale por la
izquierda, un ojo por ciclo: es el mundo el que parece girar, porque el que
gira es el bot. La mancha de 15 ocupa tres ojos seguidos: un bulto grande
llena varios a la vez. Y una vuelta completa son 36 ciclos, así que el vegetal
pasa por el abanico una vez por vuelta; el resto del tiempo, todo ceros.
<!-- probado: un bot que solo gira 35 .aimdx contra 3 vegetales quietos, campo 1200×900, semilla 7 (los 15 son unas 360 unidades de borde a borde) -->
<!-- 32-VISION §0.2 (abanico), §0.3 (1/percentdist²), §2.6 (valor de lo más cercano) -->

En la app lo ves igual: sembrá este bot, hacé clic en él y mirá la pestaña
**Memoria** del inspector: cualquier ojo baja a 0 y vuelve a prenderse mientras
gira (ver [[app/inspector]]).
<!-- app/inspector (pestaña Memoria, consulta de cualquier celda) -->

## Paso 3: el torneo por el ojo que más ve {#maximo}

Para ir hacia la comida hay que girar hacia el ojo que lee el valor más alto, y
el ADN no tiene un máximo que compare nueve valores de una sola tirada
([[op:floor]] compara de a pares). La solución es un torneo, con dos celdas
de [[adn/memoria|memoria libre]]:
<!-- 20-VM §6.2 (floor = max de a pares; no hay máximo de muchos) -->

- la celda **50** guarda el mejor valor visto hasta ahora;
- la celda **51** guarda cuánto habría que girar para que ese ojo quede
  mirando al frente.

Cada ciclo se juega el torneo de vuelta. Primero, la mesa en cero:

```adn
' 50 guarda el mejor valor visto; 51, el giro hasta ese ojo
cond
start
 0 50 store
 0 51 store
stop
```

Después, un gen por ojo: si ese ojo ve más que el mejor hasta ahora, toma su
lugar. El del [[.eye9]], por ejemplo:

```adn
' Si el ojo 9 ve mas que el mejor hasta ahora, tomar su lugar
cond
 *.eye9 *50 >
start
 *.eye9 50 store
 140 51 store
stop
```

El 140 que guarda es el giro que centra al ojo 9: con 35 unidades por ojo, los
ojos están a 35, 70, 105 y 140 del frente. El gen del [[.eye1]] guarda −140,
el del [[.eye2]] −105… y el del [[.eye5]], 0: si lo que más ve es el ojo del
frente, no hay nada que girar.

La comparación es [[op:>]] a secas, no «mayor o igual»: si varios ojos
empatan, gana el primero que llegó a ese valor, el de número más chico. Y como
el gen de arranque deja la celda 50 en 0, esa misma celda te va a servir de
pregunta «¿veo algo?» en el paso que sigue.

Los nueve genes — uno por ojo, iguales salvo el número y el giro — están en el
bot completo del final: el torneo siempre deja en la 50 lo que más se ve, y en
la 51 hacia qué lado.
<!-- probado: la celda 51 queda en −140, 70, 35… según de qué lado esté la comida (corridas del paso siguiente) -->

## Paso 4: girar y avanzar {#girar}

Tres genes más y el bot ya busca:

```adn
' Girar hacia el ojo que mas ve
cond
 *51 0 !=
start
 *51 .aimdx store
stop

' Avanzar siempre
cond
start
 10 .up store
stop

' Nada a la vista: virar al azar para que el abanico barra
cond
 *50 0 =
start
 314 rnd .aimdx store
stop
```

- El primer gen gira lo que diga la celda 51. Un número negativo en
  [[.aimdx]] gira hacia la izquierda, así que el mismo gen sirve para los dos
  lados.
- El segundo es el avance del tutorial anterior.
- El tercero busca: mientras no ve nada, vira hasta un cuarto de vuelta al
  azar en cada ciclo, y así el abanico va barriendo para todos los lados
  mientras camina. Apenas un ojo ve algo, el torneo toma el mando.

Cuando lo corrimos, la corrección se ve así ciclo a ciclo (un vegetal que
entra por la derecha):

| Ciclo | El ADN leyó (ojo 9 / ojo 5) | Orden de giro |
|---|---|---|
| 42 | nada todavía | — |
| 43 | 1072 / 0 | 70 a la derecha |
| 44 | 4814 / 0 | 35 a la derecha |
| 45 | 32000 / 32000 | 0: derecho, lo tiene al frente |

Dos cosas para leer bien en esa tabla. La orden de cada ciclo responde a los
ojos del ciclo anterior: la vista se calcula en la fase de _acciones_, con las
posiciones finales, y tu ADN la lee recién al ciclo siguiente
([[adn/ejecucion#retraso]]). Y en el ciclo 43 el giro es 70 y no 140: los ojos
7, 8 y 9 habían empatado en 1072 y ganó el 7, el primero de los empatados.
<!-- 32-VISION §0.1 (la vista se calcula en acciones; llega al ciclo siguiente) -->
<!-- probado: el mismo bot del paso 5 contra 3 vegetales, campo 1200×900, semilla 5: el ojo 9 marca 1072 en el ciclo 42 (empatado en 7, 8 y 9) → en el 43 la celda 51 vale 70; 4814 en el 43 → 35 en el 44; 32000 en el frente → 0 -->

Qué deberías ver: el bot vira al azar hasta que la comida entra al abanico;
entonces vira hacia ella, se le pega y, como avanza siempre, la empuja. En
nuestras corridas, el primer vegetal que encontró terminó arrinconado contra
una pared. Todavía no sabe comer: la energía del vegetal no baja (en la app
hasta sube, despacito, mientras le dé el sol). Eso es lo que sigue.
<!-- probado: el bot guía (torneo más estos tres genes) contra 3 vegetales, semilla 11: encara al primero en 5 ciclos y lo empuja hasta arrinconarlo -->

## Paso 5: comer {#comer}

Un vegetal no se come hacé clic enndolo: tu bot no tiene boca. Se come a disparos. El
disparo −1 es un _pedido de energía_: cuando le pega a un bot vivo, la víctima
pierde el 90 % de la fuerza del golpe en energía y otro 1 % en cuerpo, y del
punto del golpe vuelve hacia el tirador un disparo de regalo con el botín. Al
llegar, el tirador se queda con el 95 % como energía, un poco como cuerpo y un
1 % que se le vuelve desecho ([[simulacion/disparos#energia]]). Con unos 1000
de cuerpo, cada tiro le saca al vegetal unos 200 y te deja unos 210.
<!-- 33-SHOTS §5 (releasenrg: 90 % nrg, 1 % body, regalo −2; takenrg: 95 % nrg, 4 % body, 1 % waste); probado en [[simulacion/disparos#energia]] con 1000 de cuerpo: −198 / +209 -->

El gen:

```adn
' Comida cerca, adelante: pedirle energia con un disparo
cond
 *.eye5 50 >
start
 -1 .shoot store
stop
```

Disparás solo cuando el ojo del frente pasa de 50, o sea cuando la comida está
a menos de unas 200 unidades de borde a borde (el 100 del ojo son 134). Es
distancia de tiro seguro: el disparo de un bot de 1000 de cuerpo vuela unas
440 y pierde fuerza en el camino, así que de lejos llega vacío. Es, además, el
mismo umbral del _Animal Minimalis_ del Bestiario.
<!-- 32-VISION §0.3 (100 a 134); 33-SHOTS §2.2 (alcance Log(vbody)·60), §3.4 (decaimiento en el vuelo); Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (*.eye5 50 > → −1 .shoot store) -->

Cuando lo corrimos, el vegetal cayó de 3000 a 28 de energía en 40 ciclos y
murió; el cazador, mientras tanto, subió de 3000 a más de 6100. Mientras come
lo empuja contra la pared, así que la víctima no se le escapa. Si al vegetal
no le queda energía, muere y deja un cadáver ([[simulacion/muerte]]); al
cadáver el −1 ya no le saca nada, porque ya no tiene energía. Para vaciar
cuerpos está el disparo −6 ([[simulacion/disparos#cuerpo]]).
<!-- probado: el bot de los pasos 3–5 contra 3 vegetales de 3000, campo 1200×900, semilla 11: la primera víctima baja a 28 en 40 ciclos y muere; el cazador sube a 6136 -->

## Paso 6: el bot completo {#el-bot}

El ciclo ya se sostiene solo: buscar, acercarse, comer. Falta lo último:
cuando la energía sobra, tener hijos. Este es el bot entero:

```adn
' Un bot que busca comida
' 50 = el mayor valor visto esta pasada; 51 = giro hacia ese ojo

' Arrancar cada ciclo sin candidato
cond
start
 0 50 store
 0 51 store
stop

' Ojo por ojo: si ve mas que el mejor hasta ahora, tomar su lugar
cond
 *.eye1 *50 >
start
 *.eye1 50 store
 -140 51 store
stop

cond
 *.eye2 *50 >
start
 *.eye2 50 store
 -105 51 store
stop

cond
 *.eye3 *50 >
start
 *.eye3 50 store
 -70 51 store
stop

cond
 *.eye4 *50 >
start
 *.eye4 50 store
 -35 51 store
stop

cond
 *.eye5 *50 >
start
 *.eye5 50 store
 0 51 store
stop

cond
 *.eye6 *50 >
start
 *.eye6 50 store
 35 51 store
stop

cond
 *.eye7 *50 >
start
 *.eye7 50 store
 70 51 store
stop

cond
 *.eye8 *50 >
start
 *.eye8 50 store
 105 51 store
stop

cond
 *.eye9 *50 >
start
 *.eye9 50 store
 140 51 store
stop

' Girar hacia el ojo que mas ve
cond
 *51 0 !=
start
 *51 .aimdx store
stop

' Avanzar siempre
cond
start
 10 .up store
stop

' Nada a la vista: virar al azar para que el abanico barra
cond
 *50 0 =
start
 314 rnd .aimdx store
stop

' Comida cerca, adelante: dispararle para comer
cond
 *.eye5 50 >
start
 -1 .shoot store
stop

' Energia de sobra: tener un hijo
cond
 *.nrg 5000 >
start
 30 .repro store
stop
end
```

El gen nuevo dice: con más de 5000 de energía, un hijo que se lleva el 30 %
([[.repro]]). Nacés con 3000, así que 5000 es «comí de sobra»: de un padre de
5400, el hijo nace con unos 1600 y el padre queda en unos 3800. El hijo trae
el mismo ADN y caza igual que el padre.
<!-- 36-REPRO §2 (per = 30 %: nrg y body al hijo, 0,1 % de impuesto); sysvars/repro (30 % de 3000/1000 → 899/300 y 2099/700) -->

La corrida de 200 ciclos, contra cuatro vegetales: cruzó los 5000 en el ciclo
40, pero el hijo nació recién cerca del 90. El parto necesita lugar libre
delante del padre, hacia donde apunta; si está ocupado, la orden queda
escrita y se reintenta cada ciclo, y tu bot vive pegado a su comida y a las
paredes. A los 200 ciclos el
padre iba por 7100 con otro parto pendiente, y el hijo — nacido con unos 1600
— ya había comido hasta 3000. En la app, el nacimiento se ve como un destello
al lado del padre, y los saltos de generación de tu linaje aparecen en
**Eventos**.
<!-- 36-REPRO §0.4 (la orden no se consume si el parto falla), §2 (colisión en el punto de parto); app/observar #eventos (generación récord); web2/src/lib/mundo/render-enriquecido.js (nacimiento: destello + línea a la madre) -->
<!-- probado: el bot completo contra 4 vegetales de 3000, campo 1200×900, semilla 11, 200 ciclos: cruza 5000 en el 40, el parto sale cerca del 90 (5→6 bots), el hijo llega a 3024 y el padre a 7189 -->

El _Animal Minimalis_ del Bestiario es este mismo bot con menos piezas: solo
mira el ojo del frente; mientras no ve nada vira al azar; cuando [[.eye5]]
pasa de 50, dispara; y a los 20000 de energía se reproduce con el 10 %. Tiene,
además, un detalle que al nuestro le falta: antes de disparar, comprueba que
lo que ve no sea de su especie. Buen punto de partida para lo que sigue.
<!-- Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (gira con 314 rnd .aimdx si *.eye5 0 =; dispara con *.eye5 50 > y *.refeye *.myeye !=; 10 .repro con *.nrg 20000 >) -->

## Qué probar después {#despues}

- **Dispararle solo a los de afuera.** Hoy tu bot le pide energía a cualquiera
  que tenga delante, sea un vegetal o un pariente. Las celdas `ref*` dicen
  qué es lo que está viendo el ojo con foco: la prueba clásica es comparar
  [[.refeye]] con tu [[.myeye]]. El paso a paso, en [[tutoriales/dispara]] y
  en [[tutoriales/reconoce-especie]].
  <!-- 32-VISION §2 (firma del ADN: refeye/myeye) -->
- **Comer cadáveres.** Al cadáver tu −1 ya no le saca nada; el −6 vacía su
  cuerpo y es el disparo más rendidor. Sembrá pocos vegetales y hacé que tu
  bot limpie el campo: hace falta otro gen y otro umbral.
  <!-- 33-SHOTS §5 (releasebod: cadáver ×4, todo de body) -->
- **La noche.** Con el reloj de día y noche encendido, de noche los ojos ven
  un 20 % menos y los vegetales no fabrican. ¿Encuentra tu bot la comida igual
  cuando todo está más oscuro y más flaco?
  ([[simulacion/cloroplastos#dia-y-noche]], [[simulacion/vision#alcance]])
  <!-- 32-VISION §0.4 (noche: 20 % menos alcance); 50-MUNDO §2.2 (de noche no toca comer) -->
- **Ojos panorámicos.** El abanico deja 270 grados de punto ciego: la comida
  que entra por atrás aparece recién cuando ya la pasaste. Un ojo bien ancho
  ve poquísimo pero en todas direcciones: la idea está en
  [[simulacion/vision#ancho]].
  <!-- 32-VISION §0.2, §0.4 (width: más ancho, menos alcance) -->
