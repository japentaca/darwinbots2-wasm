---
titulo: .poison
resumen: "Cuánta toxina tiene el bot: castiga a quien lo muerde con un disparo de energía o le roba por un lazo; se evapora un 2 % por ciclo."
etiquetas: [defensas, poison, disparos, lazos, sentidos]
estado: revisada
---
La toxina es una defensa pasiva: no se dispara, actúa cuando te atacan.

- **Disparos de energía.** Si te pega un `-1` de [[.shoot]] y tu toxina supera la
  fuerza del golpe, no perdés energía: el motor devuelve un disparo de toxina al
  atacante y te descuenta toxina.
- **Disparos de memoria.** Un disparo que intenta escribir en tu memoria (tipo
  positivo) no escribe si tu toxina alcanza a frenarlo: también rebota como toxina.
- **Lazos.** Si un bot de otra especie te chupa energía o cuerpo por un lazo
  ([[.tieloc]] `-1` o `-6`) y tenés suficiente toxina, en vez de comer se
  envenena.

Los disparos que roban cuerpo (`-6`) no se frenan con toxina: para esos está
[[.shell]].

<!-- 33-SHOTS §3.4 (tipo positivo: bloqueo por poison con rebote −5), §5 (releasenrg: poison > power → rebote −5; releasebod sin poison); 34-TIES §2 (−1/−6 con retaliación por poison) -->

Quien se envenena queda marcado en su [[.poisoned]] y, mientras dure, el motor
escribe tu [[.pval]] en su celda [[.ploc]] en cada ciclo. Esas dos celdas son las
tuyas, las del bot tóxico.

<!-- 21-MEMORIA §4.3, §6; 33-SHOTS §2.3 (createshot lleva ploc y pval del emisor del rebote) -->

La toxina se evapora un 2 % por ciclo y el motor publica el valor nuevo en cada
ciclo. Se fabrica con [[.strpoison]]. A uno de tu especie no lo envenena: si le
llega un disparo de tu toxina, la suma a la suya.

<!-- 31-ENERGIA §1 (poison ×0.98); 33-SHOTS §5 (takepoison: conespecífico absorbe) -->

```adn
' quien me muerda va a girar sin parar
cond
*.robage 0 =
start
.aimdx .ploc store
50 .pval store
stop

cond
*.poison 500 <
start
100 .strpoison store
stop
```

Con este bot, un atacante que le dispara `-1` queda girando 50 por ciclo mientras
le dure la toxina.

<!-- comprobado con probar-adn: un mordedor que dispara −1 pasa a .poisoned > 500 y su .aim baja 50 por ciclo -->
