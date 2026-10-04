---
titulo: .waste
resumen: "Los desechos que acumuló el bot: en exceso le escriben números al azar en la memoria; se tiran con un disparo -4."
etiquetas: [desechos, sentido, memoria, disparos]
estado: revisada
---
<!-- 31-ENERGIA §0.3 (costo de transacción → waste), §2 (fuentes y sumideros); 34-TIES §2 -->
Los desechos son un subproducto de la actividad. Los principales orígenes son:

- fabricar defensas: el costo extra de armar caparazón, baba, veneno o toxina
  ([[.mkshell]], [[.mkslime]]…) no desaparece, se vuelve desecho;
- comer: un 1 % de lo que el bot le saca a otro, con disparos o por un lazo;
- recibir desechos ajenos: un disparo −4 de otro bot, o lo que le pasen por un lazo.

<!-- 31-ENERGIA §2 (BadWastelevel 0 → 400; altzheimer si Pwaste + Waste > umbral) -->
**Por qué importan.** Cuando los desechos, sumados a los permanentes de
[[.pwaste]], pasan del límite que fija la opción [[param:opt:56]] (400 si no lo
cambiaste), el bot sufre algo parecido al Alzheimer: cada ciclo el motor escribe
números al azar en direcciones al azar de su memoria, y cuantos más desechos, más
escrituras. Eso le rompe variables, órdenes y contadores.

<!-- 33-SHOTS §2.1 (shot −4: shootval o waste/20; 1 % a Pwaste); 50-MUNDO §2.3 (digestión con cloroplastos) -->
**Cómo se eliminan.**

- Tirándolos con un disparo de tipo −4: `-4 .shoot store` saca la cantidad que
  pongas en [[.shootval]] (o 1/20 de los desechos si está en 0). Un 1 % de lo
  tirado pasa a [[.pwaste]].
- Con cloroplastos: un bot con [[.chlr]] digiere sus desechos y los convierte en
  energía y cuerpo.
- Pasándolos a un compañero de organismo con [[.sharewaste]].
- Si pasan de 32000, el bot los expulsa solo.

```adn
' Tira los desechos cuando pasan de 100
cond
 *.waste 100 >
start
 *.waste .shootval store
 -4 .shoot store
stop
```

Es el patrón que usan muchos bots del Bestiario, como _A. Praxidikae mk2_. Más en
[[simulacion/energia]].
