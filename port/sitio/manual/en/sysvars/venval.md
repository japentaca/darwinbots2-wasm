---
titulo: .venval
resumen: "The value that your venom writes into the victim's .vloc cell on every cycle of the paralysis."
etiquetas: [defenses, venom, memory, configuration]
estado: revisada
---
It is the partner of [[.vloc]]: `.vloc` says _where_ and `.venval` _what_. It is read at the
moment you shoot venom (or pass it through a tie) and travels with the shot,
so changing it afterward doesn't affect shots already in the air or
paralyses that have already begun; a new hit, on the other hand, puts its own
`.vloc` and `.venval` pair on the victim. The engine doesn't clear it; you write it once and
it stays, but a newborn starts with 0.

<!-- sysvars.yaml .venval (newshot copia mem(836) al shot → Vval del golpeado); 33-SHOTS §5 (takeven reescribe Vloc/Vval en cada golpe); 21-MEMORIA §3 (persistente) -->

The classic combination in the Bestiary is `.vloc` at [[.shoot]] and `-2` here: the
victim shoots energy every cycle the paralysis lasts. Other ideas: a large
value in [[.aimdx]] to make it spin out of control, or 0 in [[.up]] to make it
stop pushing.

<!-- Bestiario: Alga_Toxicus.txt; comprobado con probar-adn (víctima paralizada pierde energía cada ciclo) -->

```adn
' at birth: my venom makes the victim give away energy
cond
*.robage 0 =
start
.shoot .vloc store
-2 .venval store
stop
```

How long the effect lasts is something the victim can see in its [[.paralyzed]].
