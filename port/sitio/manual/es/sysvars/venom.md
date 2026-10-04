---
titulo: .venom
resumen: "Cuánto veneno tiene el bot: la munición de los disparos -3, que paralizan a la víctima y le pisan una celda de memoria."
etiquetas: [defensas, venom, disparos, sentidos]
estado: revisada
---
El veneno es un arma: no te protege, se dispara. Con `-3` en [[.shoot]] el bot
tira una parte de su veneno (por defecto la vigésima parte; con [[.shootval]]
elegís cuánto, hasta lo que tengas). Al pegar en un bot de otra especie:

- primero lo frena el caparazón ([[.shell]]) de la víctima;
- lo que pasa la paraliza tantos ciclos como la fuerza del golpe ([[.paralyzed]]);
- mientras dure, el motor escribe en cada ciclo tu [[.venval]] en la celda
  [[.vloc]] de la víctima, pisando lo que haya puesto su propio ADN.

Si pega en uno de tu especie, no lo paraliza: lo suma a su propio veneno.

<!-- 33-SHOTS §2.1 (−3: min(|shootval|, venom) o venom/20), §5 (takeven: conespecífico absorbe; shell; Paracount += power; Vloc/Vval); 21-MEMORIA §4.3 -->

El efecto más usado es apuntar `.vloc` a [[.shoot]] y poner `-2` en `.venval`:
la víctima pasa a disparar energía en cada ciclo de la parálisis y se va
vaciando. Así lo hacen _Alga Toxicus_ y _A Packus Toxus_ del Bestiario.

<!-- Bestiario: Alga_Toxicus.txt y A_Packus_Toxus.txt (.shoot .vloc store / -2 .venval store); comprobado con probar-adn: la víctima quieta pierde ~27 de energía por ciclo y su .paralyzed sube -->

```adn
' al nacer: mi veneno hace que la víctima regale energía
cond
*.robage 0 =
start
.shoot .vloc store
-2 .venval store
stop

' cargar y disparar a lo que tengo enfrente
cond
*.venom 100 <
start
100 .strvenom store
stop

cond
*.eye5 0 >
*.venom 50 >
start
-3 .shoot store
stop
```

El veneno también se puede pasar por un lazo con [[.tieloc]] `-3`. La celda se
actualiza al fabricar, al disparar y al recibir veneno; escribir en ella no
cambia nada. Se fabrica con [[.strvenom]].

<!-- sysvars.yaml .venom (storevenom, robshoot −3, ties, takeven conespecífico) -->
