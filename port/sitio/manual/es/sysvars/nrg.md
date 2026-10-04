---
titulo: .nrg
resumen: "La energía del bot, entre 0 y 32000: lo que gasta en cada acción y lo que lo mantiene vivo."
etiquetas: [energía, sentido, muerte]
estado: revisada
---
Es la sysvar más leída de DarwinBots. Todo cuesta energía: ejecutar instrucciones,
moverse, girar, disparar, tener cuerpo y ADN largo, reproducirse. Se gana comiendo
(disparándole a otros, ver [[simulacion/disparos]]), con cloroplastos al sol (ver
[[simulacion/cloroplastos]]) o desarmando cuerpo con [[.fdbody]].

<!-- sysvars.yaml .nrg (WriteSenses P5, clamp 0..32000); 31-ENERGIA §0.2, §1 (muerte energética) -->
El motor la publica al final del ciclo, recortada entre 0 y 32000. Por dentro, la
energía puede quedar negativa mientras se cobran los costos, pero vos nunca vas a
leer un número negativo. Cuando baja de 0,5 el bot muere; si la opción
[[param:opt:50]] está activada, ya por debajo de 15 se convierte en
cadáver (ver [[simulacion/muerte]]).

```adn
' Sin energía de sobra, quieto; con energía, avanza
cond
 *.nrg 1000 >
start
 20 .up store
stop
```

:::cuidado
Un bot recién cargado lee `.nrg` en 0 en su primer ciclo: la publicación todavía no
ocurrió. Una condición como `*.nrg 500 <` es verdadera ahí aunque tenga 3000. Si el
gen hace algo drástico, agregale `*.robage 0 >`. Un hijo, en cambio, nace con su
energía ya publicada.
:::

<!-- 31-ENERGIA §1 (Shock); port/README A1-1 (la energía pasa al cuerpo); comprobado con un disparo −1 de shootval 6000 -->
:::cuidado
Un bot que no es vegetal y pierde más de la mitad de su energía en un solo ciclo,
pero aun así se queda con más de 3000, sufre un _shock_: toda la energía que le
quedaba se le pasa al cuerpo (a razón de 10 por 1) y queda en 0, así que en ese
mismo ciclo muere o queda como cadáver. De 20000 a 8000 hay shock; de 8000 a 2000,
no. Pasa, por ejemplo,
con un disparo de energía muy grande ([[.shootval]] de miles). Gastá de a poco.
:::

Lo que ganó o perdió en el último ciclo está en [[.pleas]] y [[.pain]]; la energía
del bot que tenés enfrente, en [[.refnrg]].
