---
titulo: Entradas y salidas
resumen: "Los veinte canales con los que un bot le pasa números a otro: .out y .in por la vista, .tout y .tin por un lazo."
etiquetas: [comunicacion, out, in, lazos, especie]
estado: revisada
---
Un bot puede espiar una dirección de la memoria de otro (con [[.memloc]] o, por un
lazo, con [[.tmemloc]]), pero la forma pensada para comunicarse es _publicar_
números para que otros los lean. Para eso hay dos juegos de diez
canales, cada uno con su salida y su entrada:

| Canal | Escribís en | El otro lee en | Llega a |
|---|---|---|---|
| Por la vista | [[.out1]] … `.out10` | [[.in1]] … `.in10` | quien te tenga en el ojo con foco, o te choque |
| Por un lazo | [[.tout1]] … `.tout10` | [[.tin1]] … `.tin10` | el bot atado a vos, si está escuchando ese lazo |

Las salidas son configuración: el motor no las borra nunca, así que con
escribirlas una vez alcanza y el valor queda publicado hasta que lo cambies. Las
entradas son sentidos: las llena el motor después de que corre el ADN, así que
siempre leés lo que el otro tenía publicado en el ciclo anterior. Un bot recién
nacido arranca con todas en 0; no hereda las salidas del padre.

El uso más común, por lejos, es reconocer a los de tu especie: todos escriben el
mismo código en `.out1` y, antes de disparar, comparan `*.in1` con `*.out1`. Así
lo hace, por ejemplo, _Artemis Minimalis_ del Bestiario. Elegí un código distinto
de 0: 0 es lo que publica cualquier bot que no usa el canal, y también lo que vale
`.in1` cuando no estás viendo a nadie.

```adn
' me identifico con un código
start
555 .out1 store
stop

' disparo solo si lo que tengo enfrente no es de los míos
cond
*.eye5 0 >
*.in1 *.out1 !=
start
-1 .shoot store
stop
```

Los canales por lazo sirven para coordinar a un organismo de varios bots. Por la
vista, `.in1` se borra después de cada ejecución del ADN; por el lazo, `.tin1`
se vuelve a cargar en cada ciclo desde el lazo que estás leyendo y solo pasa a 0
cuando ese lazo deja de existir. El padre y el hijo quedan atados al nacer y
pueden hablarse por ahí casi enseguida: el padre recibe lo del hijo desde el
primer ciclo, y el hijo recibe lo del padre cuando su [[.robage]] llega a 3 (ver
[[sysvars/lazos|las sysvars de lazos]] y [[simulacion/lazos]]). Si lo que querés
es escribir directamente en la memoria del otro, eso lo hacen [[.tieloc]] y
[[.tieval]].
<!-- 34-TIES §1 (maketie: el creador carga los trefvars al crear la tie), §2 (readtie en P1 con newage ≥ 2; EraseTRefVars si no hay lazo); comprobado con probar-adn (padre e hijo con .tout1/.tin1) -->

<!-- sysvars.yaml .out1/.in1/.tout1/.tin1; 21-MEMORIA §3 (in* régimen A: latencia 1, borrado en el paso 12); 10-CICLO §0.2 (lookoccurr también en colisión); 36-REPRO §2 (el hijo no hereda mem) -->
<!-- Artemis_Minimalis.txt: 555 .out1 store / *.in1 *.out1 != ; sysvars.yaml .memloc/.tmemloc (lectura de la memoria del visto / del atado) -->

