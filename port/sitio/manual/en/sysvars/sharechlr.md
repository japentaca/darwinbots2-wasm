---
titulo: .sharechlr
resumen: "In a multicellular organism, shares chloroplasts with each tied bot: the number is the percentage of the total that this bot keeps."
etiquetas: [chloroplasts, ties, multicellular, action]
estado: revisada
---
<!-- sysvars.yaml .sharechlr (Update_Ties P3, solo multibot, clamp 0..99, =0 cada P3); 34-TIES §2.1; 36-REPRO §4 (umbral 0,25) -->
It only works in a multicellular organism, that is, a bot that has already stiffened at
least one tie (see [[simulacion/lazos]]). For each tie this bot created, the engine
adds up its chloroplasts and the other bot's and splits them again: the value of
`.sharechlr` is the percentage of the total that this bot keeps, and the rest goes to the
other. `50 .sharechlr store` evens them out; `20 .sharechlr store` hands the other bot
most of them.

Details worth knowing:

- The value goes from 1 to 99 (with 0 it doesn't share): a larger number counts as 99.
- It applies in the same cycle and the cell goes back to 0 in all bots, whether they have
  ties or not. To share continuously, write it every cycle.
- It only shares with close relatives. If the DNA of the two bots differs by more than
  25%, there is no sharing and the bot is blocked from sharing chloroplasts for
  8 daytime cycles (the countdown only advances in daytime, not at night).
- Only the ties this bot created count. On a tie the other bot created, the sharing
  is decided by the other bot's `.sharechlr`.

```adn
' Splits chloroplasts evenly with the neighboring cells
cond
 *.chlr 0 >
start
 50 .sharechlr store
stop
```

The other sharing orders work in a similar way: [[.sharenrg]], [[.sharewaste]],
[[.shareshell]] and [[.shareslime]].
