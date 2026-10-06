---
titulo: Chloroplasts and light
resumen: "The sysvars to buy, remove, count and share chloroplasts, and to know how much light is left in the field."
etiquetas: [chloroplasts, light, photosynthesis, vegetables]
estado: revisada
---
<!-- 50-MUNDO §2.2 (fotosíntesis dentro de la banda, de día) -->
Chloroplasts let a bot live off the sun: in daytime cycles, a bot with
chloroplasts that is inside the lit strip gains energy and body without doing
anything. Vegetables are born with them, but any bot can buy them. How that gain is
calculated is covered in [[simulacion/cloroplastos]].

The sysvars in the group are:

- [[.chlr]]: how many chloroplasts the bot has.
- [[.mkchlr]]: buy; costs energy per chloroplast.
- [[.rmchlr]]: remove; free, but gives nothing back.
- [[.light]]: how much light is left free in the field, which drops when it is full of bots.
- [[.sharechlr]]: share chloroplasts with the other bots in an organism.

<!-- 31-ENERGIA §3 (decaimiento 0,5/100^(chlr/16000), masa, reparto en partos); 35-VIRUS §0.2 -->
Before buying, it's worth knowing what comes with them. Chloroplasts are lost on their own a
little each cycle (up to half per cycle when there are few, almost nothing when there are
thousands), they weigh a lot (each one adds almost 1 to [[.mass]], so the bot barely
moves), and they are incompatible with viruses: if a bot with chloroplasts tries to make
one with [[.mkvirus]], it loses all of them. On reproduction, the child takes its percentage.

The most common idea is a bot that keeps itself at a fixed level, replacing what
is lost as long as its energy allows:

```adn
' Keeps about 2000 chloroplasts
cond
 *.chlr 2000 <
 *.nrg 1000 >
start
 100 .mkchlr store
stop
```
