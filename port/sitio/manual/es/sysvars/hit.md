---
titulo: .hit
resumen: "Vale 1 en el ciclo siguiente a un choque con otro bot o con un obstáculo, venga de donde venga."
etiquetas: [choque, tacto, sentido]
estado: revisada
---
<!-- sysvars.yaml .hit (Repel3 P1, EraseSenses paso 12); 30-FISICA §4.3, §4.4 -->
`.hit` es el aviso general de contacto: el motor la pone en 1 cuando el bot se
superpone con otro bot (de cualquier especie, un vegetal o un cadáver) o con un
obstáculo, sin importar el lado. Para saber de qué lado vino están [[.hitup]],
[[.hitdn]], [[.hitdx]] y [[.hitsx]], que se encienden junto con ella.

El choque se detecta en el paso de física, después de que corrió el ADN, así que tu
ADN lo lee en el ciclo siguiente; enseguida el motor la vuelve a 0. Si el contacto
sigue, se vuelve a encender en cada ciclo. Lo que escribas en `.hit` dura poco: el
motor la borra después de tu ADN aunque no haya habido choque.

El borde del mundo no la enciende ([[.edge]] se ocupa de eso), y los disparos que
recibe el bot tampoco: un disparo no es un choque.

Este bot lleva la cuenta de cuántos ciclos pasó en contacto con algo, en la celda
50 de memoria libre:

```adn
cond
*.hit 0 !=
start
50 inc
stop
```

Junto con un choque llegan los datos del bot tocado en las sysvars `ref*` (ver
[[sysvars/contacto]]).
