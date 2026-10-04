---
titulo: .refvel
resumen: "Con qué velocidad se aleja (positivo) o se acerca (negativo) lo que estás viendo, en la dirección en que mirás y relativa a la tuya."
etiquetas: [visión, refvars, velocidad, persecución]
estado: revisada
---
<!-- sysvars.yaml 699 (alias refvelup); core senses.hpp lookoccurr (vel del visto proyectada sobre mi aim, menos mi velup); probado: mira.txt contra firma.txt, sigue.txt contra huye.txt; revisor: sigue.txt contra huye.txt en 4000x3000, lo ve del ciclo 7 al 60 salvo el 44 -->
`.refvel`, también llamada `.refvelup`, es la velocidad del bot que ve tu ojo
con foco medida a lo largo de tu dirección de mirada, y relativa a la tuya:
el motor le resta tu propia [[.velup]]. Positiva quiere decir que se aleja
de vos hacia adelante; negativa, que se acerca.

Su opuesta exacta es [[.refveldn]], la componente de costado es
[[.refveldx]] y el total, [[.refvelscalar]].

Usa la misma convención que [[.up]], y por eso el truco clásico es copiarla
ahí: si el otro se aleja, empujás para no quedarte atrás. _Animal Minimalis_
le suma un poco para además ir acercándose:

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refveldx .dx store
*.refvel 30 add .up store
stop
```

Con este gen, más uno que gira cuando no ve nada, el bot persiguió a un
blanco que huía y lo tuvo en el [[.eye5]] casi sin perderlo durante unos 50
ciclos.

Si no ves nada, vale 0. Contra una forma, mide la velocidad de la forma.
