---
titulo: .shell
resumen: "Cuánto caparazón tiene el bot: frena los disparos que roban cuerpo y los de veneno, y no se gasta solo."
etiquetas: [defensas, shell, sentidos]
estado: revisada
---
El caparazón es la defensa contra dos ataques: los disparos que roban cuerpo
(`-6` en [[.shoot]]) y los de veneno (`-3`). Cada golpe se come primero el
caparazón y solo lo que sobra llega al bot. Contra el veneno rinde menos que
contra los disparos de cuerpo, y no frena los disparos de energía (`-1`); para
esos está [[.poison]].

<!-- 33-SHOTS §5 (releasebod: shell absorbe ÷20; takeven: ×25 VenumEffectivenessVSShell; releasenrg sin shell) -->

No se gasta con el tiempo: lo que fabricaste con [[.mkshell]] queda hasta que te
lo coman los disparos o lo desarmes. El costo escondido es el peso: cada 200 de
shell suman a la masa lo mismo que 1000 de cuerpo, así que un bot muy acorazado
acelera menos con el mismo [[.up]].

<!-- 31-ENERGIA §1 (solo slime y poison decaen); sysvars.yaml .mass (body/1000 + shell/200) -->

La celda se actualiza cuando fabricás, cuando te pega un disparo que la gasta y
cuando un compañero reparte caparazón con [[.shareshell]]. Escribir en ella no
cambia nada.

<!-- sysvars.yaml .shell (makeshell P5, shareshell P3 en ambos bots, shots) -->

```adn
' si me están golpeando, reforzar el caparazón
cond
*.shflav 0 !=
*.shell 500 <
start
100 .mkshell store
stop
```

[[.shflav]] dice de qué tipo fue el disparo que te pegó en el ciclo anterior.
