---
titulo: .rmchlr
resumen: "Sheds that amount of chloroplasts in the same cycle, at no cost and recovering nothing."
etiquetas: [chloroplasts, action]
estado: revisada
---
<!-- 31-ENERGIA §1 (ChangeChlr: no cobra ni devuelve al quitar); port/README A3-10 -->
Write how many chloroplasts you want to remove and the engine removes them in the same cycle. It
costs no energy, but it doesn't give any back either: what you paid with [[.mkchlr]] is lost.
If you ask to remove more than there are, they drop to 0. The order is cleared after
it is used. A negative value does nothing and stays written in the cell.

It is useful for lightening the bot (chloroplasts are heavy, see [[.mass]]) or for
ceasing to be a vegetable, for example before making a virus, which requires having
none:

```adn
' It removes all its chloroplasts
cond
 *.chlr 0 >
start
 *.chlr .rmchlr store
stop
```

If in the same cycle you also buy with [[.mkchlr]], both apply and only the net
increase is charged.
