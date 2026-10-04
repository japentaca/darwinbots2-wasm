---
titulo: Defensas
resumen: "Las cuatro sustancias que un bot fabrica con su energía (shell, slime, venom y poison) y las celdas que deciden qué le hacen a quien te ataca."
etiquetas: [defensas, shell, slime, venom, poison]
estado: revisada
---
Un bot puede gastar energía en fabricar cuatro sustancias. Cada una tiene una
orden para fabricarla y una celda donde el motor publica cuánto tenés:

| Sustancia | Se fabrica con | Se lee en | Por 1 de energía | Tope por ciclo | Se gasta sola |
|---|---|---|---|---|---|
| Caparazón | [[.mkshell]] | [[.shell]] | 10 | 100 | no |
| Baba | [[.mkslime]] | [[.slime]] | 10 | 200 | 2 % por ciclo |
| Veneno | [[.strvenom]] | [[.venom]] | 1 | 100 | no |
| Toxina | [[.strpoison]] | [[.poison]] | 4 | 100 | 2 % por ciclo |

<!-- 31-ENERGIA §0.3 (1 nrg = 10 shell = 10 slime = 1 venom = 4 poison; topes 100/200/100/100), §1 (slime y poison ×0.98 en P1) -->

Las cuatro sirven para cosas distintas. El _shell_ frena los disparos que roban
cuerpo y los de veneno, pero hace al bot más pesado. La _slime_ hace que no te
puedan atar con un lazo y frena los virus. El _venom_ es munición: se dispara con
`-3` en [[.shoot]] y paraliza. El _poison_ es una defensa pasiva: quien te muerde
con un disparo de energía recibe toxina en vez de comida.

<!-- 33-SHOTS §5 (takeven, releasenrg, releasebod: shell absorbe −3 y −6; poison rebota −1); 34-TIES §0.5 (slime deflecta lazos); 30-FISICA/CalcMass (shell/200 en la masa) -->

Lo que hacen el veneno y la toxina en la víctima lo decidís vos con cuatro celdas
de configuración: [[.vloc]] y [[.venval]] (qué celda de la víctima de tu veneno se
pisa y con qué valor) y [[.ploc]] y [[.pval]] (lo mismo para quien se envenena con
tu toxina). La víctima ve en [[.paralyzed]] y [[.poisoned]] cuántos ciclos le
quedan.

<!-- 21-MEMORIA §4.3, §6 (Vloc/Vval y Ploc/Pval); sysvars.yaml .paralyzed .poisoned -->

Fabricar cuesta la energía de la tabla más un costo de transacción que fija la
simulación y que termina convertido en desecho ([[.waste]]). Un valor negativo en
la orden desarma la sustancia, pero no devuelve energía: también se cobra.

<!-- 31-ENERGIA §0.3 y §1 (coste de transacción a Waste); port/core robots.hpp makeshell/storevenom (nrg -= |Delta|·tasa) -->

Una receta común en el Bestiario, por ejemplo en _Alga Toxicus_: al nacer, fijar
`.vloc`, `.venval` y `.ploc`; después, cargar veneno y toxina cuando sobra
energía y disparar veneno en cada ciclo mientras gira al azar. El mecanismo
completo está en
[[simulacion/defensas]].
