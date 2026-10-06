---
titulo: .mkchlr
resumen: "Buys chloroplasts: adds that amount in the same cycle and charges energy for each one."
etiquetas: [chloroplasts, action, energy]
estado: revisada
---
<!-- comprobado: con 32000 cloroplastos, 1000 .mkchlr cobra 100 (costo 0,1) y no suma nada -->
<!-- 31-ENERGIA §1 (ChangeChlr: cobra solo al añadir, se anula si nrg < 100 o con el techo de población vegetal); port/README A3-10 (negativos no hacen nada); comprobado: con 1050 de energía y costo 10, 100 .mkchlr no compra -->
Write how many chloroplasts you want and the engine adds them in the same cycle,
charging for each one whatever the cost [[param:cost:8]] sets. The command is
cleared afterwards, so a big purchase is made all at once or repeated cycle after
cycle. There is no cap per cycle, apart from the maximum of 32000 chloroplasts
(whatever goes beyond that is charged anyway and lost).

The purchase is all or nothing. It is cancelled entirely, without charging, if:

- after paying for it the bot would be left with less than 100 energy;
- the bot is a vegetable and the total chloroplasts in the field have already
  passed the population limit (this is how the engine keeps vegetables from
  filling everything).

A negative value does nothing (in the original DarwinBots, a −100 in [[.rmchlr]]
together with a purchase added 100 more chloroplasts; the port fixed that). If
you also write [[.rmchlr]] in the same cycle, both things are done and only the
net increase is charged.

```adn
' Buys chloroplasts 100 at a time while it has energy to spare
cond
 *.chlr 1000 <
 *.nrg 500 >
start
 100 .mkchlr store
stop
```

The result is read in [[.chlr]] the next cycle.

:::cuidado
A bot with chloroplasts cannot make viruses: if it tries with [[.mkvirus]], it
loses all its chloroplasts (see [[sysvars/adn-y-virus]]).
:::
