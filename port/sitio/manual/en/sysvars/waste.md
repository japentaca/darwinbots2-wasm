---
titulo: .waste
resumen: "The waste the bot has accumulated: in excess it writes random numbers into its memory; it is thrown away with a -4 shot."
etiquetas: [waste, sense, memory, shots]
estado: revisada
---
<!-- 31-ENERGIA §0.3 (costo de transacción → waste), §2 (fuentes y sumideros); 34-TIES §2 -->
Waste is a byproduct of activity. The main sources are:

- making defenses: the extra cost of building shell, slime, venom or poison
  ([[.mkshell]], [[.mkslime]]…) doesn't vanish, it becomes waste;
- eating: 1 % of what the bot takes from another, by shooting or through a tie;
- receiving other bots' waste: a −4 shot from another bot, or whatever is passed to it
  through a tie.

<!-- 31-ENERGIA §2 (BadWastelevel 0 → 400; altzheimer si Pwaste + Waste > umbral) -->
**Why it matters.** When the waste, added to the permanent waste in
[[.pwaste]], goes past the limit set by the option [[param:opt:56]] (400 if you
haven't changed it), the bot suffers something like Alzheimer's: every cycle the engine
writes random numbers into random addresses of its memory, and the more waste, the more
writes. That breaks its variables, commands and counters.

<!-- 33-SHOTS §2.1 (shot −4: shootval o waste/20; 1 % a Pwaste); 50-MUNDO §2.3 (digestión con cloroplastos) -->
**How to get rid of it.**

- By throwing it away with a −4 shot: `-4 .shoot store` shoots out the amount you
  put in [[.shootval]] (or 1/20 of the waste if it is 0). 1 % of what is thrown stays in
  `.waste` and another 1 % goes to [[.pwaste]].
- With chloroplasts: a bot with [[.chlr]] digests its waste and turns it into
  energy and body.
- By passing it to a partner in the same organism with [[.sharewaste]].
- If it goes past 32000, the bot expels it on its own.

```adn
' Throws away the waste when it goes past 100
cond
 *.waste 100 >
start
 *.waste .shootval store
 -4 .shoot store
stop
```

It's the pattern many Bestiary bots use, such as _A. Praxidikae mk2_. More in
[[simulacion/energia]].
