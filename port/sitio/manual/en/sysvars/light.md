---
titulo: .light
resumen: "How much light is left available in the field, from 0 to 32000: it drops as bots take up more surface."
etiquetas: [light, chloroplasts, sense, population]
estado: revisada
---
<!-- sysvars.yaml .light (32000 − LightAval·32000); 50-MUNDO §2.2 (LightAval = área de los bots / área del campo menos formas, solo con sol) -->
It measures what part of the field is not covered by bots. The engine adds up the
surface of all living bots, compares it with that of the field and publishes the
remainder on the scale of 0 to 32000: 32000 is an empty field, and the more
populated it is, the lower it goes. It is also called `.availability`.

It matters because photosynthesis depends on it: in a full field, each
chloroplast yields less (see [[simulacion/cloroplastos]]). It is a value for the
whole field, not of where the bot is: everyone reads the same number, whether or
not they are in the sun.

Two details:

- The engine only recalculates it in daytime cycles. At night (see [[.daytime]])
  it keeps publishing the last daytime value, even if the population has
  changed.
- A freshly loaded bot reads it as 0 in its first cycle.

```adn
' Only buys chloroplasts if the field is not saturated
cond
 *.light 24000 >
 *.chlr 500 <
 *.nrg 1000 >
start
 100 .mkchlr store
stop
```

See also [[.chlr]] and [[.mkchlr]].
