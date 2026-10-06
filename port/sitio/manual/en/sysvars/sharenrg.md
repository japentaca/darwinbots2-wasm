---
titulo: .sharenrg
resumen: "In a multicellular organism, the percentage of the energy pooled with each partner that you want to keep; the engine splits it in the same cycle."
etiquetas: [ties, multicellular, energy, sharing]
estado: revisada
---
Write a percentage from 1 to 100. For each tie, the engine adds your energy and your
partner's and leaves you that percentage of the total; the rest stays with the partner. With 50 both
end up even, with 90 you keep almost everything, with 10 you give it away.

<!-- sysvars.yaml .sharenrg (% del total de nrg que quiero tener; Mod 100, 0 → 100) -->

Conditions and limits:

- It only works if you are multicellular ([[.multi]]) and only through the ties you created
  yourself with [[.tie]]. From the other end, the order does nothing: if the child
  tied itself to the parent, the child is the one that has to ask for the sharing.
- In one cycle no more energy is moved than your body ([[.body]]); if the
  difference is big, it takes several cycles.
- Whoever asks for the sharing pays 1% of what was moved.
- The value is taken modulo 100, and a remainder of 0 (like 200) counts as 100: 100 is "everything for me"
  and 150 is 50. A 0 or a negative does nothing.

<!-- 34-TIES §2 (sharing P3, solo multibot y ties no-back), §2.1 (límite por body, 1 % al iniciador); comprobado con probar-adn: con 90 en los dos, solo el hijo (creador) mueve energía, de a 500 por ciclo (su body) y pagando 5 -->

The engine clears the order every cycle, so you always have to write it. It is one of the
most used cells in the Bestiary: many multicellular bots write `99` or `50`
every cycle.

<!-- 34-TIES §2.1 (celdas de sharing a 0 cada P3); Bestiario: 87 bots con 50 .sharenrg y 55 con 99 .sharenrg -->

```adn
' newborn: tie to the parent and, once multicellular, share evenly
cond
*.robage 1 =
start
7 .tie store
stop

cond
*.multi 1 =
start
50 .sharenrg store
stop
```

[[.sharewaste]], [[.shareshell]], [[.shareslime]] and [[.sharechlr]] do the
same for waste, shell, slime and chloroplasts, respectively.
