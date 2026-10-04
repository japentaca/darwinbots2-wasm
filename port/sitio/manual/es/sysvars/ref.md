---
titulo: Lo que se ve (ref*)
resumen: "Las sysvars ref* describen lo que tiene delante el ojo con foco: la firma de su ADN, su energía y su cuerpo, dónde está y cómo se mueve."
etiquetas: [visión, refvars, reconocimiento, ojos]
estado: revisada
---
<!-- 32-VISION §1-2, §4; 21-MEMORIA §3 (régimen A); core senses.hpp lookoccurr, physics.hpp Repel3 -->
Los ojos ([[.eye5]] y sus vecinos) solo dicen _qué tan cerca_ hay algo. Para
saber _qué_ es, están las sysvars `ref*`: cada ciclo el motor copia en ellas
datos del objeto que ve el ojo con foco, que es [[.eye5]] salvo que lo
cambies con [[.focuseye]]. Si ese ojo ve varias cosas, manda la más cercana.

Se agrupan en tres familias:

- **La firma del ADN.** [[.refup]], [[.refdn]], [[.refsx]], [[.refdx]],
  [[.refaimdx]], [[.refaimsx]], [[.refshoot]], [[.refeye]] y [[.reftie]]
  cuentan cuántas veces aparecen ciertas palabras en el ADN del otro. Los bots
  de una misma especie tienen la misma firma, así que comparándola con la tuya
  ([[sysvars/my|las my*]]) sabés si es de los tuyos.
- **El estado.** [[.refnrg]], [[.refbody]], [[.refshell]], [[.refage]],
  [[.refkills]], [[.refpoison]], [[.refvenom]], [[.refmulti]] y [[.reffixed]].
- **Posición y movimiento.** [[.refxpos]], [[.refypos]], [[.refaim]],
  [[.refvel]], [[.refveldx]], sus opuestos [[.refveldn]] y [[.refvelsx]], y
  [[.refvelscalar]]. [[.reftype]] dice si lo que ves es un bot o una forma.

Las reglas son las mismas para todas. Llegan con un ciclo de atraso, como
cualquier sentido. Se borran a 0 antes de reescribirse, así que si el ojo con
foco no ve nada valen todas 0. Y también se llenan cuando chocás con otro bot,
aunque no lo estés mirando.

La combinación más usada viene de _Animal Minimalis_, de Numsgil, en el
Bestiario: si lo que ve no es de su especie, copia su movimiento para no
perderlo y le dispara. Acá va condensada en un solo gen:

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refveldx .dx store
*.refvel 30 add .up store
-1 .shoot store
stop
```

La visión completa está en [[simulacion/vision]] y el reconocimiento paso a
paso, en [[tutoriales/reconoce-especie]].
