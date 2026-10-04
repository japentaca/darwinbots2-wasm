---
titulo: .venval
resumen: "El valor que tu veneno escribe en la celda .vloc de la víctima en cada ciclo de la parálisis."
etiquetas: [defensas, venom, memoria, configuración]
estado: revisada
---
Es la pareja de [[.vloc]]: `.vloc` dice _dónde_ y `.venval` _qué_. Se lee en el
momento en que disparás veneno (o lo pasás por un lazo) y viaja con el disparo,
así que cambiarla después no afecta a los disparos que ya están en el aire ni a
las parálisis que ya empezaron; un golpe nuevo, en cambio, pone su propio par
`.vloc` y `.venval` en la víctima. El motor no la borra; la escribís una vez y
queda, pero un recién nacido arranca con 0.

<!-- sysvars.yaml .venval (newshot copia mem(836) al shot → Vval del golpeado); 33-SHOTS §5 (takeven reescribe Vloc/Vval en cada golpe); 21-MEMORIA §3 (persistente) -->

La combinación clásica del Bestiario es `.vloc` en [[.shoot]] y `-2` acá: la
víctima dispara energía en cada ciclo que dure la parálisis. Otras ideas: un
valor grande en [[.aimdx]] para que gire sin control, o 0 en [[.up]] para que
deje de empujar.

<!-- Bestiario: Alga_Toxicus.txt; comprobado con probar-adn (víctima paralizada pierde energía cada ciclo) -->

```adn
' al nacer: mi veneno hace que la víctima regale energía
cond
*.robage 0 =
start
.shoot .vloc store
-2 .venval store
stop
```

Cuánto dura el efecto lo ve la víctima en su [[.paralyzed]].
