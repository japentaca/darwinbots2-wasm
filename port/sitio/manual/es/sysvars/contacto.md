---
titulo: Choques y golpes
resumen: "Las sysvars que avisan que el bot chocó con otro, y de qué lado: el sentido del tacto."
etiquetas: [choque, tacto, contacto, sentidos]
estado: revisada
---
<!-- sysvars.yaml .hit .hitup .hitdn .hitdx .hitsx; 30-FISICA §4.3, §4.4 -->
Los ojos ven a la distancia; estas sysvars son el tacto. Cuando el bot se superpone
con otro bot (vivo, vegetal o cadáver) o con un obstáculo, el motor enciende
[[.hit]] y, además, una de las cuatro direcciones según de qué lado vino el
contacto: [[.hitup]] de frente, [[.hitdn]] por detrás, [[.hitdx]] por la derecha y
[[.hitsx]] por la izquierda, siempre respecto de hacia dónde apunta el bot
([[.aim]]). Todas valen 1 o 0.

Las cinco siguen la regla de los sentidos con un ciclo de atraso: el motor las
escribe en el paso de física, después de que corrió el ADN, tu ADN las lee en el
ciclo siguiente, y justo después se borran. Un choque se ve, entonces, durante un
único ciclo. El borde del mundo no cuenta como choque: para eso está [[.edge]].

<!-- 30-FISICA §4.3 (lookoccurr cruzados en Repel3); 10-CICLO §2 -->
Un choque también llena las sysvars `ref*` con los datos del bot tocado, como si lo
hubiera visto (ver [[sysvars/ref]]). Si en ese momento el bot no ve nada con sus
ojos, los `ref*` del ciclo siguiente describen al que lo chocó, aunque estuviera
detrás.

La forma más común de usarlas es girar hacia el lado del golpe para mirar qué fue.
Este bot se da vuelta cuando lo tocan por detrás:

```adn
cond
*.hitdn 0 !=
start
628 .aimsx store
stop
```

<!-- sysvars.yaml .hitang (nadie la escribe) -->
[[.hitang]] completa el grupo solo de nombre: el motor nunca la escribe.
